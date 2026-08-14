import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';

const router = express.Router();

// GET /api/inventory (Stock Table)
router.get('/', authenticateToken, (req, res) => {
  const items = db.prepare(`SELECT * FROM inventory ORDER BY item_name ASC`).all();
  res.json(items);
});

// POST /api/inventory (ONLY Accounting can add items -> cost goes to Expenses)
router.post('/', authenticateToken, requireRoles(['Accounting', 'Management']), (req, res) => {
  const { item_name, category, qty, unit_cost, min_alert_qty } = req.body;
  if (!item_name || !qty || !unit_cost) {
    return res.status(400).json({ message: 'Item name, quantity, and unit cost required' });
  }

  const itemId = generateId('inventory', 'INV');
  const totalCost = (parseInt(qty) || 0) * (parseFloat(unit_cost) || 0);

  // 1. Insert Inventory Master
  db.prepare(`
    INSERT INTO inventory (id, item_name, category, qty, unit_cost, min_alert_qty)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(itemId, item_name, category || 'Active Equipment', parseInt(qty), parseFloat(unit_cost), parseInt(min_alert_qty) || 5);

  // 2. AUTOMATED FLOW: Post expense immediately to Accounting
  const today = new Date().toISOString().split('T')[0];
  const invNo = `EXP-INV-${Date.now().toString().slice(-4)}`;

  db.prepare(`
    INSERT INTO accounting_ledger (
      entry_date, inv_no, type, category, description, gross_amount, is_vat_exempt, vat_amount, net_amount, received_by, reference_id
    ) VALUES (?, ?, 'Expense', 'Inventory Stock Procurement', ?, ?, 1, 0, ?, ?, ?)
  `).run(today, invNo, `Procured ${qty} units of ${item_name}`, totalCost, totalCost, req.user.fullname, itemId);

  res.status(201).json({ id: itemId, message: 'Stock added and expense posted to ledger.' });
});

// GET /api/requisitions (Available to all teams)
router.get('/requisitions', authenticateToken, (req, res) => {
  const reqs = db.prepare(`SELECT * FROM requisitions ORDER BY created_at DESC`).all();
  res.json(reqs);
});

// POST /api/requisitions (Cash or Materials Requisition)
router.post('/requisitions', authenticateToken, (req, res) => {
  const { type, purpose, amount, materials_list } = req.body;
  if (!type || !purpose) return res.status(400).json({ message: 'Requisition type and purpose required' });

  const reqId = generateId('requisition', 'REQ');
  const user = db.prepare(`SELECT department FROM users WHERE id = ?`).get(req.user.id);

  db.prepare(`
    INSERT INTO requisitions (id, type, requested_by, department, purpose, amount, materials_list, approval_stage)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Accounting')
  `).run(reqId, type, req.user.id, user?.department || 'General', purpose, parseFloat(amount) || 0, JSON.stringify(materials_list || []));

  res.status(201).json({ id: reqId, message: 'Requisition submitted for multi-level approval' });
});

// PATCH /api/requisitions/:id/approve (Workflow: Accounting -> HR -> GM)
router.patch('/requisitions/:id/approve', authenticateToken, (req, res) => {
  const { id } = req.params;
  const reqRecord = db.prepare(`SELECT * FROM requisitions WHERE id = ?`).get(id);
  if (!reqRecord) return res.status(404).json({ message: 'Requisition not found' });

  const role = req.user.role;

  if (reqRecord.approval_stage === 'Pending Accounting') {
    if (role !== 'Accounting' && role !== 'Management') {
      return res.status(403).json({ message: 'Stage requires Accounting approval' });
    }
    db.prepare(`UPDATE requisitions SET accounting_approved = 1, approval_stage = 'Pending HR' WHERE id = ?`).run(id);
    return res.json({ message: 'Accounting approved. Forwarded to HR.' });
  }

  if (reqRecord.approval_stage === 'Pending HR') {
    if (role !== 'HR' && role !== 'Management') {
      return res.status(403).json({ message: 'Stage requires HR approval' });
    }
    db.prepare(`UPDATE requisitions SET hr_approved = 1, approval_stage = 'Pending GM' WHERE id = ?`).run(id);
    return res.json({ message: 'HR approved. Forwarded to GM for final signoff.' });
  }

  if (reqRecord.approval_stage === 'Pending GM') {
    if (role !== 'GM' && role !== 'Management') {
      return res.status(403).json({ message: 'Stage requires GM signoff' });
    }

    db.prepare(`UPDATE requisitions SET gm_approved = 1, approval_stage = 'Approved' WHERE id = ?`).run(id);

    // AUTOMATED FLOW: Approved cash requisition reflects in Accounting Expenses
    if (reqRecord.type === 'Cash' && reqRecord.amount > 0) {
      const today = new Date().toISOString().split('T')[0];
      const invNo = `EXP-CASH-${Date.now().toString().slice(-4)}`;

      db.prepare(`
        INSERT INTO accounting_ledger (
          entry_date, inv_no, type, category, description, gross_amount, is_vat_exempt, vat_amount, net_amount, received_by, reference_id
        ) VALUES (?, ?, 'Expense', 'Approved Cash Requisition', ?, ?, 1, 0, ?, ?, ?)
      `).run(today, invNo, `${reqRecord.purpose} (${reqRecord.department})`, reqRecord.amount, reqRecord.amount, req.user.fullname, reqRecord.id);
    }

    // AUTOMATED FLOW: Approved materials requisition deducts stock from inventory[cite: 9]
    if (reqRecord.type === 'Materials') {
      const materials = JSON.parse(reqRecord.materials_list || '[]');
      for (const item of materials) {
        db.prepare(`UPDATE inventory SET qty = MAX(0, qty - ?) WHERE id = ?`).run(item.qty, item.itemId);
      }
    }

    return res.json({ message: 'Requisition fully approved. Actions executed.' });
  }

  res.status(400).json({ message: 'Requisition is already processed.' });
});

export default router;