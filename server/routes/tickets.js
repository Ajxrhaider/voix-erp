import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/tickets
router.get('/', authenticateToken, (req, res) => {
  const tickets = db.prepare(`SELECT * FROM tickets ORDER BY created_at DESC`).all();
  res.json(tickets);
});

// POST /api/tickets (Addable by NOC and Customer Service)
router.post('/', authenticateToken, (req, res) => {
  const { customer_id, customer_name, title, description, category, priority } = req.body;
  if (!customer_name || !title || !category) {
    return res.status(400).json({ message: 'Customer name, issue title, and category required' });
  }

  const tktId = generateId('ticket', 'TKT');
  db.prepare(`
    INSERT INTO tickets (id, customer_id, customer_name, title, description, category, priority, created_by, created_by_role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')
  `).run(tktId, customer_id || null, customer_name, title, description || '', category, priority || 'Medium', req.user.id, req.user.role);

  res.status(201).json({ id: tktId, message: 'Query registered successfully' });
});

// POST /api/tickets/:id/convert-to-work-order (Queries -> Tickets -> Work Orders for Fiber Team)
router.post('/:id/convert-to-work-order', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { team_id, objective, location, assigned_materials } = req.body;

  if (!team_id || !objective) {
    return res.status(400).json({ message: 'Active fiber team and work objective required' });
  }

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  const woId = generateId('work_order', 'WO');

  // Insert Work Order
  db.prepare(`
    INSERT INTO work_orders (id, ticket_id, team_id, objective, location, assigned_materials, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Assigned')
  `).run(woId, ticket.id, team_id, objective, location || 'On-Site Location', JSON.stringify(assigned_materials || []));

  // Update Ticket Status
  db.prepare(`UPDATE tickets SET status = 'Converted to Work Order' WHERE id = ?`).run(ticket.id);

  // In-App Notification to Team Lead
  const team = db.prepare(`SELECT leader_id FROM daily_teams WHERE id = ?`).get(team_id);
  if (team) {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'Work Order')
    `).run(team.leader_id, 'New Work Order Assigned', `You have been assigned ${woId}: ${objective}`, 'Work Order');
  }

  res.status(201).json({ id: woId, message: 'Converted to Work Order and dispatched to Fiber team.' });
});

// GET /api/work-orders (Visible to NOC, CS, Fiber)
router.get('/work-orders/list', authenticateToken, (req, res) => {
  const orders = db.prepare(`SELECT * FROM work_orders ORDER BY created_at DESC`).all();
  res.json(orders);
});

// PATCH /api/work-orders/:id/complete (Fiber reports fulfillment -> NOC/CS can close ticket)
router.patch('/work-orders/:id/complete', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { leftover_materials } = req.body;

  const wo = db.prepare(`SELECT * FROM work_orders WHERE id = ?`).get(id);
  if (!wo) return res.status(404).json({ message: 'Work Order not found' });

  db.prepare(`
    UPDATE work_orders 
    SET status = 'Fulfilled', leftover_materials = ? 
    WHERE id = ?
  `).run(JSON.stringify(leftover_materials || []), id);

  if (wo.ticket_id) {
    db.prepare(`UPDATE tickets SET status = 'Resolved' WHERE id = ?`).run(wo.ticket_id);
  }

  res.json({ message: 'Work Order fulfilled. Ticket marked Resolved for NOC/CS closure.' });
});

export default router;