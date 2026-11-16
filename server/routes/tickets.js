import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();
const CAN_DISPATCH_WORK_ORDER = ['NOC', 'HOD NOC', 'HOD Fiber', 'Management', 'GM', 'Dev'];
const DISPATCHABLE_TICKET_STATUSES = new Set(['open', 'escalated', 'on hold']);
const ESCALATABLE_TICKET_STATUSES = new Set(['open', 'on hold']);

function emitChange(req) {
  req.io?.emit('erp-data-changed');
}

function validIsoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? value : null;
}

router.get('/', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all());
});

router.post('/', authenticateToken, (req, res) => {
  const {
    customer_id, customer_name, title, description, category, priority,
    date_received, time_received, customer_ip, query_type, location,
    service_type, whatsapp_sos_sent, assigned_to
  } = req.body;
  const cleanName = String(customer_name || '').trim() || 'Unidentified customer';
  const cleanTitle = String(title || query_type || '').trim() || 'Customer query';
  const cleanCategory = String(category || query_type || '').trim() || 'General inquiry';
  const receivedDate = date_received ? validIsoDate(date_received) : new Date().toISOString().slice(0, 10);
  if (!receivedDate) return res.status(400).json({ message: 'Enter a valid date received.' });

  const linkedCustomer = customer_id
    ? db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id)
    : db.prepare(`
        SELECT id FROM customers
        WHERE (trim(?) <> '' AND lower(trim(name)) = lower(trim(?)))
          OR (trim(?) <> '' AND trim(ip_address) = trim(?))
        LIMIT 1
      `).get(cleanName, cleanName, customer_ip || '', customer_ip || '');
  if (customer_id && !linkedCustomer) return res.status(400).json({ message: 'Selected customer profile was not found.' });

  try {
    const ticketId = generateId('ticket', 'TKT');
    db.prepare(`
      INSERT INTO tickets (
        id, customer_id, customer_name, title, description, category, priority, status,
        date_received, time_received, customer_ip, query_type, location, service_type,
        opened_by, whatsapp_sos_sent, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      linkedCustomer?.id || null,
      cleanName,
      cleanTitle,
      String(description || '').trim(),
      cleanCategory,
      String(priority || 'Medium'),
      receivedDate,
      String(time_received || '').trim(),
      String(customer_ip || '').trim(),
      String(query_type || '').trim(),
      String(location || '').trim(),
      String(service_type || 'FTTH').trim(),
      req.user.fullname || req.user.username || 'System',
      whatsapp_sos_sent ? 1 : 0,
      String(assigned_to || '').trim()
    );
    emitChange(req);
    res.status(201).json({ id: ticketId });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The ticket could not be saved because a linked record is invalid.' });
    }
    console.error('Ticket creation failed:', error.message);
    res.status(500).json({ message: 'The ticket could not be saved.' });
  }
});

router.patch('/:id/escalate', authenticateToken, (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (String(ticket.status || '').trim().toLowerCase() === 'escalated') {
    return res.json({ message: 'Ticket is already escalated.' });
  }
  if (!ESCALATABLE_TICKET_STATUSES.has(String(ticket.status || '').trim().toLowerCase())) {
    return res.status(409).json({ message: 'Only open or on-hold tickets can be escalated.' });
  }

  db.prepare("UPDATE tickets SET status = 'Escalated', priority = 'High' WHERE id = ?").run(ticket.id);
  const managers = db.prepare(`
    SELECT email FROM users
    WHERE (roles LIKE '%"Management"%' OR roles LIKE '%"GM"%')
      AND email IS NOT NULL AND email <> ''
  `).all();
  const emails = managers.map((manager) => manager.email).join(',');
  if (emails) {
    sendEmail(emails, `URGENT ESCALATION: Ticket ${ticket.id}`, `Ticket for ${ticket.customer_name} has been escalated by ${req.user.fullname || req.user.username}. Immediate attention required.`);
  }
  emitChange(req);
  res.json({ message: 'Ticket escalated.' });
});

router.post('/:id/convert-to-work-order', authenticateToken, requireRoles(CAN_DISPATCH_WORK_ORDER), (req, res) => {
  const { team_id, objective, location } = req.body;
  const cleanObjective = String(objective || '').trim();
  const cleanLocation = String(location || '').trim();
  const untrackedMaterials = Array.isArray(req.body.assigned_materials) ? req.body.assigned_materials : [];
  if (!team_id || !cleanObjective) {
    return res.status(400).json({ message: 'Select a field team and provide a work-order objective.' });
  }
  if (untrackedMaterials.length > 0) {
    return res.status(400).json({ message: 'Request materials through a linked inventory requisition so stock is tracked correctly.' });
  }

  let result;
  try {
    const dispatch = db.transaction(() => {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
      if (!ticket) return { notFound: true };

      const existing = db.prepare('SELECT id FROM work_orders WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1').get(ticket.id);
      if (existing) return { id: existing.id, alreadyDispatched: true };

      if (!DISPATCHABLE_TICKET_STATUSES.has(String(ticket.status || '').trim().toLowerCase())) {
        return { conflict: true, message: 'Only open, escalated, or on-hold tickets without an existing work order can be dispatched.' };
      }

      const team = db.prepare('SELECT * FROM daily_teams WHERE id = ? AND is_active = 1').get(team_id);
      if (!team) return { invalidTeam: true };

      const workOrderId = generateId('work_order', 'WO');
      db.prepare(`
        INSERT INTO work_orders (id, ticket_id, team_id, objective, location, assigned_materials, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Assigned')
      `).run(workOrderId, ticket.id, team.id, cleanObjective, cleanLocation || ticket.location || 'On-Site Location', '[]');
      db.prepare("UPDATE tickets SET status = 'Converted to Work Order' WHERE id = ?").run(ticket.id);
      return { id: workOrderId, team, objective: cleanObjective, location: cleanLocation || ticket.location || 'On-Site Location' };
    });
    result = dispatch();
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The work order could not be created because a linked record is invalid.' });
    }
    console.error('Work order dispatch failed:', error.message);
    return res.status(500).json({ message: 'The work order could not be created.' });
  }

  if (result.notFound) return res.status(404).json({ message: 'Ticket not found.' });
  if (result.invalidTeam) return res.status(400).json({ message: 'The selected field team is not active.' });
  if (result.conflict) return res.status(409).json({ message: result.message });
  if (result.alreadyDispatched) return res.json({ id: result.id, message: 'A work order already exists for this ticket.' });

  const members = (() => {
    try { return JSON.parse(result.team.member_ids || '[]'); } catch { return []; }
  })();
  const staffIds = [...new Set([result.team.leader_id, ...members].filter(Boolean))];
  if (staffIds.length > 0) {
    const staff = db.prepare(`SELECT id, email FROM users WHERE id IN (${staffIds.map(() => '?').join(',')})`).all(...staffIds);
    for (const person of staff) {
      db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Work Order')")
        .run(person.id, 'New Work Order', `Assigned ${result.id}: ${result.objective}`);
    }
    const emails = staff.filter((person) => person.email).map((person) => person.email).join(',');
    if (emails) sendEmail(emails, 'New Work Order Dispatch', `Your team (${result.team.name}) has been assigned Work Order ${result.id}: ${result.objective} at ${result.location}.`);
  }

  emitChange(req);
  res.status(201).json({ id: result.id });
});

router.get('/work-orders/list', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM work_orders ORDER BY created_at DESC').all());
});

router.patch('/work-orders/:id/complete', authenticateToken, (req, res) => {
  const leftoverMaterials = Array.isArray(req.body.leftover_materials) ? req.body.leftover_materials : [];
  const returnToInventory = req.body.return_to_inventory === true || req.body.return_to_inventory === 1;
  const itemsToReturn = [];
  for (const item of leftoverMaterials) {
    const quantity = Number(item?.qty || 0);
    const itemId = String(item?.itemId || '').trim();
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'Leftover material quantities must be whole numbers greater than or equal to zero.' });
    }
    if (returnToInventory && quantity > 0) itemsToReturn.push({ itemId, quantity });
  }

  let result;
  try {
    const complete = db.transaction(() => {
      const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id);
      if (!workOrder) return { notFound: true };
      if (workOrder.status === 'Fulfilled') return { alreadyCompleted: true };

      const returnTotals = new Map();
      for (const item of itemsToReturn) {
        if (!item.itemId) return { missingItemId: true };
        returnTotals.set(item.itemId, (returnTotals.get(item.itemId) || 0) + item.quantity);
      }

      let assignedMaterials;
      try { assignedMaterials = JSON.parse(workOrder.assigned_materials || '[]'); } catch { return { invalidAllocation: true }; }
      if (!Array.isArray(assignedMaterials)) return { invalidAllocation: true };
      const issuedTotals = new Map();
      for (const material of assignedMaterials) {
        const itemId = String(material?.itemId || '').trim();
        const quantity = Number(material?.qty);
        if (!itemId || !Number.isInteger(quantity) || quantity < 0) return { invalidAllocation: true };
        issuedTotals.set(itemId, (issuedTotals.get(itemId) || 0) + quantity);
      }

      for (const [itemId, quantity] of returnTotals) {
        const issuedQuantity = issuedTotals.get(itemId) || 0;
        if (quantity > issuedQuantity) return { excessReturn: true, itemId, issuedQuantity, requested: quantity };
        if (!db.prepare('SELECT id FROM inventory WHERE id = ?').get(itemId)) {
          return { invalidItem: true, itemId };
        }
      }
      for (const [itemId, quantity] of returnTotals) {
        db.prepare('UPDATE inventory SET qty = qty + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
          .run(quantity, itemId);
      }

      db.prepare("UPDATE work_orders SET status = 'Fulfilled', leftover_materials = ? WHERE id = ?")
        .run(JSON.stringify(leftoverMaterials), workOrder.id);
      if (workOrder.ticket_id) {
        db.prepare("UPDATE tickets SET status = 'Resolved' WHERE id = ?").run(workOrder.ticket_id);
      }
      return { workOrder };
    });
    result = complete();
  } catch (error) {
    console.error('Work order completion failed:', error.message);
    return res.status(500).json({ message: 'The work order could not be completed.' });
  }

  if (result.notFound) return res.status(404).json({ message: 'Work order not found.' });
  if (result.invalidItem) return res.status(400).json({ message: `Inventory item ${result.itemId} was not found.` });
  if (result.missingItemId) return res.status(400).json({ message: 'Select an inventory item for every leftover quantity being returned.' });
  if (result.invalidAllocation) return res.status(409).json({ message: 'The work order has invalid issued-material records. Verify its inventory allocations before returning stock.' });
  if (result.excessReturn) return res.status(409).json({ message: `Cannot return ${result.requested} unit(s) of ${result.itemId}; only ${result.issuedQuantity} were issued to this work order.` });
  if (result.alreadyCompleted) return res.json({ message: 'Work order was already fulfilled.' });

  const workOrder = result.workOrder;
  if (workOrder.ticket_id) {
    const supportUsers = db.prepare(`
      SELECT email FROM users
      WHERE (roles LIKE '%"NOC"%' OR roles LIKE '%"Customer Service"%')
        AND email IS NOT NULL AND email <> ''
    `).all();
    const emails = supportUsers.map((person) => person.email).join(',');
    if (emails) {
      sendEmail(emails, 'Field Work Order Resolved', `Work Order ${workOrder.id} has been fulfilled. Related Ticket ${workOrder.ticket_id} is now ready for final verification and closure.`);
    }
  }
  emitChange(req);
  res.json({ message: 'Work order fulfilled.' });
});

router.patch('/:id/close', authenticateToken, (req, res) => {
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  const requestedStatus = req.body.status || 'Closed';
  if (!['Closed', 'Resolved'].includes(requestedStatus)) {
    return res.status(400).json({ message: 'Ticket status must be Closed or Resolved.' });
  }
  const { resolution_datetime, mttr, customer_feedback, closure_notes, resolution_by } = req.body;
  db.prepare(`
    UPDATE tickets
    SET status = ?, resolution_datetime = ?, mttr = ?, resolution_by = ?,
        customer_feedback = ?, closure_notes = ?, ticket_closed_by = ?
    WHERE id = ?
  `).run(
    requestedStatus,
    String(resolution_datetime || new Date().toISOString().replace('T', ' ').slice(0, 19)),
    String(mttr || ''),
    String(resolution_by || ''),
    String(customer_feedback || ''),
    String(closure_notes || ''),
    req.user.fullname || req.user.username || 'System',
    ticket.id
  );
  emitChange(req);
  res.json({ message: 'Ticket updated.' });
});

router.get('/cc-reports', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM customer_care_reports ORDER BY created_at DESC').all());
});

router.post('/cc-reports', authenticateToken, (req, res) => {
  const reportDate = validIsoDate(req.body.report_date);
  if (!reportDate) return res.status(400).json({ message: 'Enter a valid report date.' });

  try {
    const reportId = generateId('cc_report', 'CCR');
    db.prepare(`
      INSERT INTO customer_care_reports (
        id, user_id, fullname, report_date, channels_json, interaction_log,
        ticketing_json, financial_json, social_json, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      req.user.id,
      req.user.fullname || req.user.username || 'System',
      reportDate,
      JSON.stringify(req.body.channels || {}),
      JSON.stringify(req.body.interactions || []),
      JSON.stringify(req.body.ticketing || {}),
      JSON.stringify(req.body.financial || {}),
      JSON.stringify(req.body.social || {}),
      JSON.stringify(req.body.summary || {})
    );
    emitChange(req);
    res.status(201).json({ id: reportId, message: 'Daily customer-care report logged.' });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The report could not be saved because a linked record is invalid.' });
    }
    console.error('Customer-care report creation failed:', error.message);
    res.status(500).json({ message: 'The report could not be saved.' });
  }
});

export default router;
