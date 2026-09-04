import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM inventory ORDER BY item_name ASC`).all());
});

// STRICT INVENTORY CONTROL: ONLY 'Accounting' can add items. Not even GM can bypass this directly without the role.
router.post('/', authenticateToken, requireRoles(['Accounting']), (req, res) => {
  const { item_name, category, qty, unit_cost, min_alert_qty } = req.body;
  const itemId = generateId('inventory', 'INV');
  const totalCost = (parseInt(qty) || 0) * (parseFloat(unit_cost) || 0);

  db.prepare(`INSERT INTO inventory (id, item_name, category, qty, unit_cost, min_alert_qty) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(itemId, item_name, category || 'Active Equipment', parseInt(qty), parseFloat(unit_cost), parseInt(min_alert_qty) || 5);

  const today = new Date().toISOString().split('T')[0];
  const invNo = `EXP-INV-${Date.now().toString().slice(-4)}`;

  db.prepare(`
    INSERT INTO accounting_ledger (entry_date, inv_no, type, category, description, gross_amount, net_amount, is_vat_exempt, received_by, reference_id) 
    VALUES (?, ?, 'Expense', 'Inventory Stock Procurement', ?, ?, ?, 1, ?, ?)
  `).run(today, invNo, `Procured ${qty} units of ${item_name}`, totalCost, totalCost, req.user.fullname, itemId);

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: itemId });
});

router.get('/requisitions', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM requisitions ORDER BY created_at DESC`).all());
});

router.post('/requisitions', authenticateToken, (req, res) => {
  const { type, purpose, amount, materials_list } = req.body;
  const reqId = generateId('requisition', 'REQ');
  const user = db.prepare(`SELECT department FROM users WHERE id = ?`).get(req.user.id);

  db.prepare(`
    INSERT INTO requisitions (id, type, requested_by, department, purpose, amount, materials_list, approval_stage)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Accounting')
  `).run(reqId, type, req.user.id, user?.department || 'General', purpose, parseFloat(amount) || 0, JSON.stringify(materials_list || '[]'));

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: reqId });
});

// FULL MULTI-LEVEL REQUISITION APPROVAL
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
      
      // Auto Expense Entry
      const today = new Date().toISOString().split('T')[0];
      const invNo = `EXP-CASH-${Date.now().toString().slice(-4)}`;
      db.prepare(`
        INSERT INTO accounting_ledger (entry_date, inv_no, type, category, description, gross_amount, net_amount, is_vat_exempt, received_by, reference_id) 
        VALUES (?, ?, 'Expense', 'Approved Cash Requisition', ?, ?, ?, 1, ?, ?)
      `).run(today, invNo, `${reqRecord.purpose} (${reqRecord.department})`, reqRecord.amount, reqRecord.amount, req.user.fullname, reqRecord.id);
      
      if (requester?.email) sendEmail(requester.email, 'Requisition Approved', `Your Cash Requisition ${reqRecord.id} has been fully approved.`);
    } else {
      db.prepare(`UPDATE requisitions SET approval_stage = 'Pending Inventory' WHERE id = ?`).run(reqRecord.id);
      if (requester?.email) sendEmail(requester.email, 'Requisition Approved', `Your Materials Requisition ${reqRecord.id} is approved and pending Inventory issuance.`);
    }
    
    req.io.emit('erp-data-changed');
    return res.json({ message: 'GM Approved.' });
  }

  // Inventory Material Issuance
  if (reqRecord.approval_stage === 'Pending Inventory' && (isGodMode || userRoles.includes('Inventory'))) {
    db.prepare(`UPDATE requisitions SET approval_stage = 'Completed' WHERE id = ?`).run(reqRecord.id);
    const materials = JSON.parse(reqRecord.materials_list || '[]');
    for (const item of materials) {
      db.prepare(`UPDATE inventory SET qty = MAX(0, qty - ?) WHERE id = ?`).run(item.qty, item.itemId);
    }
    if (requester?.email) sendEmail(requester.email, 'Materials Issued', `Your materials for ${reqRecord.id} have been issued by Inventory.`);
    req.io.emit('erp-data-changed');
    return res.json({ message: 'Materials Issued & Completed.' });
  }

  res.status(403).json({ message: 'Unauthorized for this approval stage.' });
});

export default router;