import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM tickets ORDER BY created_at DESC`).all());
});

router.post('/', authenticateToken, (req, res) => {
  const { customer_id, customer_name, title, description, category, priority } = req.body;
  const tktId = generateId('ticket', 'TKT');
  db.prepare(`
    INSERT INTO tickets (id, customer_id, customer_name, title, description, category, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
  `).run(tktId, customer_id || null, customer_name, title, description || '', category, priority || 'Medium');

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: tktId });
});

router.post('/:id/convert-to-work-order', authenticateToken, requireRoles(['HOD NOC', 'HOD Fiber', 'Management', 'GM', 'Dev']), (req, res) => {
  const { team_id, objective, location, assigned_materials } = req.body;
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  const woId = generateId('work_order', 'WO');
  db.prepare(`INSERT INTO work_orders (id, ticket_id, team_id, objective, location, assigned_materials, status) VALUES (?, ?, ?, ?, ?, ?, 'Assigned')`)
    .run(woId, ticket.id, team_id, objective, location || 'On-Site Location', JSON.stringify(assigned_materials || '[]'));

  db.prepare(`UPDATE tickets SET status = 'Converted to Work Order' WHERE id = ?`).run(ticket.id);

  const team = db.prepare(`SELECT leader_id FROM daily_teams WHERE id = ?`).get(team_id);
  if (team) {
    db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Work Order')`)
      .run(team.leader_id, 'New Work Order Assigned', `You have been assigned ${woId}: ${objective}`);
    
    // EMAIL NOTIFICATION
    const leadUser = db.prepare(`SELECT email FROM users WHERE id = ?`).get(team.leader_id);
    if (leadUser?.email) sendEmail(leadUser.email, 'New Work Order Dispatch', `You have been assigned Work Order ${woId}: ${objective} at ${location}.`);
  }

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: woId });
});

router.get('/work-orders/list', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM work_orders ORDER BY created_at DESC`).all());
});

router.patch('/work-orders/:id/complete', authenticateToken, (req, res) => {
  const wo = db.prepare(`SELECT * FROM work_orders WHERE id = ?`).get(req.params.id);
  db.prepare(`UPDATE work_orders SET status = 'Fulfilled', leftover_materials = ? WHERE id = ?`)
    .run(JSON.stringify(req.body.leftover_materials || '[]'), req.params.id);

  if (wo && wo.ticket_id) {
    db.prepare(`UPDATE tickets SET status = 'Resolved' WHERE id = ?`).run(wo.ticket_id);
    // Alert NOC/CS
    const nocs = db.prepare(`SELECT email FROM users WHERE roles LIKE '%"NOC"%' OR roles LIKE '%"Customer Service"%'`).all();
    nocs.forEach(n => {
      if (n.email) sendEmail(n.email, 'Ticket Resolved', `Work Order ${wo.id} fulfilled by field team. Ticket ${wo.ticket_id} is ready for final closure.`);
    });
  }
  
  // Leftover materials logging logic handled via JSON payload storage in leftover_materials
  req.io.emit('erp-data-changed');
  res.json({ message: 'Work Order fulfilled.' });
});

router.patch('/:id/close', authenticateToken, (req, res) => {
  db.prepare(`UPDATE tickets SET status = 'Closed' WHERE id = ?`).run(req.params.id);
  req.io.emit('erp-data-changed');
  res.json({ message: 'Ticket Closed.' });
});

export default router;