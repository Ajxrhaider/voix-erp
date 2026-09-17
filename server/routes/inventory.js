import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM inventory ORDER BY item_name ASC`).all());
});

router.post('/', authenticateToken, requireRoles(['Accounting']), (req, res) => {
  const { item_name, category, qty, unit_cost, min_alert_qty } = req.body;
  const itemId = generateId('inventory', 'INV');
  const totalCost = (parseInt(qty) || 0) * (parseFloat(unit_cost) || 0);

  db.prepare(`INSERT INTO inventory (id, item_name, category, qty, unit_cost, min_alert_qty) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(itemId, item_name, category || 'Active Equipment', parseInt(qty), parseFloat(unit_cost), parseInt(min_alert_qty) || 5);

  const today = new Date().toISOString().split('T')[0];
  const invNo = `EXP-INV-${Date.now().toString().slice(-4)}`;

  db.prepare(`INSERT INTO accounting_ledger (entry_date, inv_no, type, category, description, gross_amount, net_amount, is_vat_exempt, received_by, reference_id) VALUES (?, ?, 'Expense', 'Inventory Stock Procurement', ?, ?, ?, 1, ?, ?)`)
    .run(today, invNo, `Procured ${qty} units of ${item_name}`, totalCost, totalCost, req.user.fullname, itemId);

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: itemId });
});

router.get('/requisitions', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM requisitions ORDER BY created_at DESC`).all());
});

router.post('/requisitions', authenticateToken, (req, res) => {
  const { type, purpose, amount, materials_list, work_order_id } = req.body;
  const reqId = generateId('requisition', 'REQ');
  const user = db.prepare(`SELECT department FROM users WHERE id = ?`).get(req.user.id);

  db.prepare(`INSERT INTO requisitions (id, type, requested_by, department, purpose, amount, materials_list, approval_stage, work_order_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Accounting', ?)`)
    .run(reqId, type, req.user.id, user?.department || 'General', purpose, parseFloat(amount) || 0, JSON.stringify(materials_list || []), work_order_id || null);

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: reqId });
});

// Requisition Rejection Route
router.patch('/requisitions/:id/reject', authenticateToken, (req, res) => {
  db.prepare(`UPDATE requisitions SET approval_stage = 'Rejected' WHERE id = ?`).run(req.params.id);
  const reqRecord = db.prepare(`SELECT * FROM requisitions WHERE id = ?`).get(req.params.id);
  const requester = db.prepare(`SELECT email FROM users WHERE id = ?`).get(reqRecord.requested_by);
  
  if (requester?.email) sendEmail(requester.email, 'Requisition Rejected', `Your requisition ${req.params.id} has been formally rejected by management or accounting.`);
  
  req.io.emit('erp-data-changed');
  res.json({ message: 'Requisition Rejected' });
});

router.patch('/requisitions/:id/approve', authenticateToken, (req, res) => {
  const reqRecord = db.prepare(`SELECT * FROM requisitions WHERE id = ?`).get(req.params.id);
  if (!reqRecord) return res.status(404).json({ message: 'Requisition not found' });

  const userRoles = Array.isArray(req.user.roles) ? req.user.roles : JSON.parse(req.user.roles || '[]');
  const isGodMode = userRoles.some(r => ['Management', 'GM', 'Dev'].includes(r));
  const requester = db.prepare(`SELECT email FROM users WHERE id = ?`).get(reqRecord.requested_by);

  if (reqRecord.approval_stage === 'Pending Accounting' && (isGodMode || userRoles.includes('Accounting'))) {
    db.prepare(`UPDATE requisitions SET approval_stage = 'Pending HR' WHERE id = ?`).run(reqRecord.id);
    req.io.emit('erp-data-changed');
    return res.json({ message: 'Accounting approved. Forwarded to HR.' });
  }

  if (reqRecord.approval_stage === 'Pending HR' && (isGodMode || userRoles.includes('HR'))) {
    db.prepare(`UPDATE requisitions SET approval_stage = 'Pending GM' WHERE id = ?`).run(reqRecord.id);
    req.io.emit('erp-data-changed');
    return res.json({ message: 'HR approved. Forwarded to GM.' });
  }

  if (reqRecord.approval_stage === 'Pending GM' && (isGodMode || userRoles.includes('GM'))) {
    if (reqRecord.type === 'Cash') {
      db.prepare(`UPDATE requisitions SET approval_stage = 'Completed' WHERE id = ?`).run(reqRecord.id);
      const today = new Date().toISOString().split('T')[0];
      const invNo = `EXP-CASH-${Date.now().toString().slice(-4)}`;
      db.prepare(`INSERT INTO accounting_ledger (entry_date, inv_no, type, category, description, gross_amount, net_amount, is_vat_exempt, received_by, reference_id) VALUES (?, ?, 'Expense', 'Approved Cash Requisition', ?, ?, ?, 1, ?, ?)`)
        .run(today, invNo, `${reqRecord.purpose} (${reqRecord.department})`, reqRecord.amount, reqRecord.amount, req.user.fullname, reqRecord.id);
      
      // EMAIL: Final Cash Approval
      if (requester?.email) sendEmail(requester.email, 'Requisition Approved', `Your Cash Requisition ${reqRecord.id} has been fully approved by GM.`);
    } else {
      db.prepare(`UPDATE requisitions SET approval_stage = 'Pending Inventory' WHERE id = ?`).run(reqRecord.id);
      if (requester?.email) sendEmail(requester.email, 'Requisition Approved', `Your Materials Requisition ${reqRecord.id} has been approved by GM and is pending Inventory issuance.`);
    }
    req.io.emit('erp-data-changed');
    return res.json({ message: 'GM Approved.' });
  }

  if (reqRecord.approval_stage === 'Pending Inventory' && (isGodMode || userRoles.includes('Inventory'))) {
    db.prepare(`UPDATE requisitions SET approval_stage = 'Completed' WHERE id = ?`).run(reqRecord.id);
    const materials = JSON.parse(reqRecord.materials_list || '[]');
    
    for (const item of materials) {
      db.prepare(`UPDATE inventory SET qty = MAX(0, qty - ?) WHERE id = ?`).run(item.qty, item.itemId);
    }

    // TIGHT INVENTORY FLOW: Issue to WO and strictly notify the Field Team Lead
    if (reqRecord.work_order_id) {
      const wo = db.prepare(`SELECT assigned_materials, team_id FROM work_orders WHERE id = ?`).get(reqRecord.work_order_id);
      if (wo) {
        let currentAssigned = JSON.parse(wo.assigned_materials || '[]');
        materials.forEach(m => currentAssigned.push(m));
        db.prepare(`UPDATE work_orders SET assigned_materials = ? WHERE id = ?`).run(JSON.stringify(currentAssigned), reqRecord.work_order_id);
        
        const team = db.prepare(`SELECT leader_id FROM daily_teams WHERE id = ?`).get(wo.team_id);
        if (team) {
          db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Materials')`)
            .run(team.leader_id, 'Materials Issued', `Materials for ${reqRecord.work_order_id} have been issued.`);
          
          const leadUser = db.prepare(`SELECT email FROM users WHERE id = ?`).get(team.leader_id);
          if (leadUser?.email) {
            sendEmail(leadUser.email, 'Materials Issued to Work Order', `Inventory has officially issued the requested materials for Work Order ${reqRecord.work_order_id}. You may now proceed with the field task.`);
          }
        }
      }
    }

    if (requester?.email) sendEmail(requester.email, 'Materials Issued', `Inventory has officially issued the materials for Requisition ${reqRecord.id}.`);
    
    req.io.emit('erp-data-changed');
    return res.json({ message: 'Materials Issued & Work Order Updated.' });
  }

  res.status(403).json({ message: 'Unauthorized for this approval stage.' });
});

export default router;