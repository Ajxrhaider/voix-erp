import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM tickets ORDER BY created_at DESC`).all());
});

router.post('/', authenticateToken, (req, res) => {
  const { customer_id, customer_name, title, description, category, priority, date_received, time_received, customer_ip, query_type, location, service_type, whatsapp_sos_sent, assigned_to } = req.body;
  const tktId = generateId('ticket', 'TKT');
  
  db.prepare(`
    INSERT INTO tickets (
      id, customer_id, customer_name, title, description, category, priority, status,
      date_received, time_received, customer_ip, query_type, location, service_type,
      whatsapp_sos_sent, assigned_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tktId, customer_id || null, customer_name, title || query_type, description || '', category || query_type, priority || 'Medium',
    date_received || new Date().toISOString().split('T')[0], time_received || '', customer_ip || '', query_type || '', location || '',
    service_type || 'FTTH', whatsapp_sos_sent ? 1 : 0, assigned_to || ''
  );

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: tktId });
});

router.patch('/:id/escalate', authenticateToken, (req, res) => {
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  db.prepare(`UPDATE tickets SET status = 'Escalated', priority = 'High' WHERE id = ?`).run(ticket.id);

  const managers = db.prepare(`SELECT email FROM users WHERE (roles LIKE '%"Management"%' OR roles LIKE '%"GM"%') AND email IS NOT NULL AND email != ''`).all();
  const emails = managers.map(m => m.email).join(',');
  if (emails) {
    sendEmail(emails, `URGENT ESCALATION: Ticket ${ticket.id}`, `Ticket for ${ticket.customer_name} has been escalated to HIGH priority by ${req.user.fullname}. Immediate attention required.`);
  }

  req.io.emit('erp-data-changed');
  res.json({ message: 'Ticket Escalated' });
});

router.post('/:id/convert-to-work-order', authenticateToken, requireRoles(['HOD NOC', 'HOD Fiber', 'Management', 'GM', 'Dev']), (req, res) => {
  const { team_id, objective, location, assigned_materials } = req.body;
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

  const woId = generateId('work_order', 'WO');
  db.prepare(`INSERT INTO work_orders (id, ticket_id, team_id, objective, location, assigned_materials, status) VALUES (?, ?, ?, ?, ?, ?, 'Assigned')`)
    .run(woId, ticket.id, team_id, objective, location || 'On-Site Location', JSON.stringify(assigned_materials || []));

  db.prepare(`UPDATE tickets SET status = 'Converted to Work Order' WHERE id = ?`).run(ticket.id);

  const team = db.prepare(`SELECT * FROM daily_teams WHERE id = ?`).get(team_id);
  if (team) {
    const members = JSON.parse(team.member_ids || '[]');
    const allStaffIds = [team.leader_id, ...members];
    
    const placeholders = allStaffIds.map(() => '?').join(',');
    const staffRecords = db.prepare(`SELECT id, email FROM users WHERE id IN (${placeholders})`).all(...allStaffIds);
    
    staffRecords.forEach(staff => {
      db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Work Order')`).run(staff.id, 'New Work Order', `Assigned ${woId}: ${objective}`);
    });

    const emails = staffRecords.filter(s => s.email).map(s => s.email).join(',');
    if (emails) {
      sendEmail(emails, 'New Work Order Dispatch', `Your team (${team.name}) has been assigned Work Order ${woId}: ${objective} at ${location}.`);
    }
  }

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: woId });
});

router.get('/work-orders/list', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM work_orders ORDER BY created_at DESC`).all());
});

router.patch('/work-orders/:id/complete', authenticateToken, (req, res) => {
  const { leftover_materials, return_to_inventory } = req.body;
  const wo = db.prepare(`SELECT * FROM work_orders WHERE id = ?`).get(req.params.id);

  db.prepare(`UPDATE work_orders SET status = 'Fulfilled', leftover_materials = ? WHERE id = ?`)
    .run(JSON.stringify(leftover_materials || []), req.params.id);

  if (return_to_inventory && leftover_materials && leftover_materials.length > 0) {
    for (const item of leftover_materials) {
      if (item.itemId) db.prepare(`UPDATE inventory SET qty = qty + ? WHERE id = ?`).run(parseInt(item.qty) || 0, item.itemId);
    }
  }

  if (wo && wo.ticket_id) {
    db.prepare(`UPDATE tickets SET status = 'Resolved' WHERE id = ?`).run(wo.ticket_id);
    
    const nocs = db.prepare(`SELECT email FROM users WHERE (roles LIKE '%"NOC"%' OR roles LIKE '%"Customer Service"%') AND email IS NOT NULL AND email != ''`).all();
    const nocEmails = nocs.map(n => n.email).join(',');
    if (nocEmails) {
      sendEmail(nocEmails, 'Field Work Order Resolved', `Work Order ${wo.id} has been successfully fulfilled by the field team. Related Ticket ${wo.ticket_id} is now ready for final verification and closure.`);
    }
  }
  
  req.io.emit('erp-data-changed');
  res.json({ message: 'Work Order fulfilled.' });
});

router.patch('/:id/close', authenticateToken, (req, res) => {
  const { resolution_datetime, mttr, customer_feedback, closure_notes, resolution_by, status } = req.body;
  db.prepare(`UPDATE tickets SET status = ?, resolution_datetime = ?, mttr = ?, resolution_by = ?, customer_feedback = ?, closure_notes = ?, ticket_closed_by = ? WHERE id = ?`)
    .run(status || 'Closed', resolution_datetime || new Date().toISOString().replace('T', ' ').substring(0, 19), mttr || '', resolution_by || '', customer_feedback || '', closure_notes || '', req.user.fullname, req.params.id);
  req.io.emit('erp-data-changed');
  res.json({ message: 'Ticket Closed.' });
});

router.get('/cc-reports', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM customer_care_reports ORDER BY created_at DESC`).all());
});

router.post('/cc-reports', authenticateToken, (req, res) => {
  const { report_date, channels, interactions, ticketing, financial, social, summary } = req.body;
  const rptId = generateId('cc_report', 'CCR');
  
  db.prepare(`
    INSERT INTO customer_care_reports (
      id, user_id, fullname, report_date, channels_json, interaction_log, 
      ticketing_json, financial_json, social_json, summary_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rptId, req.user.id, req.user.fullname, report_date, 
    JSON.stringify(channels || {}), JSON.stringify(interactions || []), 
    JSON.stringify(ticketing || {}), JSON.stringify(financial || {}), 
    JSON.stringify(social || {}), JSON.stringify(summary || {})
  );

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: rptId, message: 'Daily CC Report Logged' });
});

export default router;