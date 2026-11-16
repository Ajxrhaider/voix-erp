import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();
const APPROVAL_ROLES = {
  'Pending Accounting': ['Accounting'],
  'Pending HR': ['HR'],
  'Pending GM': ['GM'],
  'Pending Inventory': ['Inventory']
};

function userRoles(user) {
  if (Array.isArray(user?.roles)) return user.roles;
  try {
    return JSON.parse(user?.roles || '[]');
  } catch {
    return [];
  }
}

function canApproveStage(user, stage) {
  const roles = userRoles(user);
  return roles.some((role) => [
    ...(APPROVAL_ROLES[stage] || []), 'Management', 'GM', 'Dev'
  ].includes(role));
}

function emitChange(req) {
  req.io?.emit('erp-data-changed');
}

function parseMaterials(materials) {
  if (!Array.isArray(materials) || materials.length === 0) return null;
  const normalized = [];
  for (const item of materials) {
    const itemId = String(item?.itemId || '').trim();
    const quantity = Number(item?.qty);
    if (!itemId || !Number.isInteger(quantity) || quantity < 1) return null;
    normalized.push({ itemId, itemName: String(item.itemName || '').trim(), qty: quantity });
  }
  return normalized;
}

router.get('/', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM inventory ORDER BY item_name ASC').all());
});

router.post('/', authenticateToken, requireRoles(['Accounting', 'Admin']), (req, res) => {
  const itemName = String(req.body.item_name || '').trim();
  const category = String(req.body.category || 'Active Equipment').trim();
  const quantity = Number(req.body.qty);
  const unitCost = Number(req.body.unit_cost);
  const minAlertQty = req.body.min_alert_qty === undefined || req.body.min_alert_qty === ''
    ? 5
    : Number(req.body.min_alert_qty);

  if (!itemName || !category || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Enter an item name, category, and a positive whole-number quantity.' });
  }
  if (!Number.isFinite(unitCost) || unitCost <= 0) {
    return res.status(400).json({ message: 'Unit cost must be greater than zero.' });
  }
  if (!Number.isInteger(minAlertQty) || minAlertQty < 0) {
    return res.status(400).json({ message: 'Minimum alert quantity must be zero or a positive whole number.' });
  }

  try {
    const createStock = db.transaction(() => {
      const itemId = generateId('inventory', 'INV');
      const totalCost = quantity * unitCost;
      db.prepare(`
        INSERT INTO inventory (id, item_name, category, qty, unit_cost, min_alert_qty)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(itemId, itemName, category, quantity, unitCost, minAlertQty);

      const today = new Date().toISOString().slice(0, 10);
      db.prepare(`
        INSERT INTO accounting_ledger (
          entry_date, inv_no, type, category, description, gross_amount,
          net_amount, is_vat_exempt, received_by, reference_id
        ) VALUES (?, ?, 'Expense', 'Inventory Stock Procurement', ?, ?, ?, 1, ?, ?)
      `).run(
        today,
        `EXP-INV-${itemId}`,
        `Procured ${quantity} units of ${itemName}`,
        totalCost,
        totalCost,
        req.user.fullname || 'Finance Desk',
        itemId
      );
      return itemId;
    });

    const id = createStock();
    emitChange(req);
    res.status(201).json({ id, message: 'Stock added and procurement expense posted.' });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'Stock could not be added because a linked record already exists.' });
    }
    console.error('Inventory stock creation failed:', error.message);
    res.status(500).json({ message: 'Stock could not be added.' });
  }
});

router.get('/requisitions', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM requisitions ORDER BY created_at DESC').all());
});

router.post('/requisitions', authenticateToken, (req, res) => {
  const type = req.body.type;
  const purpose = String(req.body.purpose || '').trim();
  const amount = req.body.amount === undefined || req.body.amount === '' ? 0 : Number(req.body.amount);
  const materials = type === 'Materials' ? parseMaterials(req.body.materials_list) : [];
  const workOrderId = String(req.body.work_order_id || '').trim();

  if (!['Cash', 'Materials'].includes(type) || !purpose) {
    return res.status(400).json({ message: 'Select a valid requisition type and enter a purpose.' });
  }
  if (type === 'Cash' && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ message: 'Cash requisition amount must be greater than zero.' });
  }
  if (type === 'Materials' && !materials) {
    return res.status(400).json({ message: 'Add one or more valid inventory items and quantities.' });
  }
  if (workOrderId && !db.prepare('SELECT id FROM work_orders WHERE id = ?').get(workOrderId)) {
    return res.status(404).json({ message: 'The linked work order was not found.' });
  }

  try {
    const createRequest = db.transaction(() => {
      const requisitionId = generateId('requisition', 'REQ');
      const requester = db.prepare('SELECT department FROM users WHERE id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO requisitions (
          id, type, requested_by, department, purpose, amount, materials_list,
          approval_stage, work_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Accounting', ?)
      `).run(
        requisitionId,
        type,
        req.user.id,
        requester?.department || 'General',
        purpose,
        type === 'Cash' ? amount : 0,
        JSON.stringify(materials || []),
        workOrderId || null
      );
      return requisitionId;
    });

    const id = createRequest();
    emitChange(req);
    res.status(201).json({ id });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The requisition could not be saved because a linked record is invalid.' });
    }
    console.error('Requisition creation failed:', error.message);
    res.status(500).json({ message: 'The requisition could not be saved.' });
  }
});

router.patch('/requisitions/:id/reject', authenticateToken, (req, res) => {
  let result;
  try {
    const rejectRequest = db.transaction(() => {
      const requisition = db.prepare('SELECT * FROM requisitions WHERE id = ?').get(req.params.id);
      if (!requisition) return { notFound: true };
      if (!APPROVAL_ROLES[requisition.approval_stage]) return { conflict: true };
      if (!canApproveStage(req.user, requisition.approval_stage)) return { forbidden: true };
      db.prepare("UPDATE requisitions SET approval_stage = 'Rejected' WHERE id = ?").run(requisition.id);
      return { requisition };
    });
    result = rejectRequest();
  } catch (error) {
    console.error('Requisition rejection failed:', error.message);
    return res.status(500).json({ message: 'The requisition could not be rejected.' });
  }

  if (result.notFound) return res.status(404).json({ message: 'Requisition not found.' });
  if (result.forbidden) return res.status(403).json({ message: 'You are not authorized to reject this approval stage.' });
  if (result.conflict) return res.status(409).json({ message: 'This requisition is no longer awaiting approval.' });

  const requester = db.prepare('SELECT email FROM users WHERE id = ?').get(result.requisition.requested_by);
  if (requester?.email) {
    sendEmail(requester.email, 'Requisition Rejected', `Your requisition ${result.requisition.id} has been formally rejected.`);
  }
  emitChange(req);
  res.json({ message: 'Requisition rejected.' });
});

router.patch('/requisitions/:id/approve', authenticateToken, (req, res) => {
  let result;
  try {
    const approveRequest = db.transaction(() => {
      const requisition = db.prepare('SELECT * FROM requisitions WHERE id = ?').get(req.params.id);
      if (!requisition) return { notFound: true };
      const currentStage = requisition.approval_stage;
      if (!APPROVAL_ROLES[currentStage]) return { conflict: true };
      if (!canApproveStage(req.user, currentStage)) return { forbidden: true };

      const requester = db.prepare('SELECT email FROM users WHERE id = ?').get(requisition.requested_by);
      let nextStage;
      let message;
      let notification = null;

      if (currentStage === 'Pending Accounting') {
        nextStage = 'Pending HR';
        message = 'Accounting approved. Forwarded to HR.';
      } else if (currentStage === 'Pending HR') {
        nextStage = 'Pending GM';
        message = 'HR approved. Forwarded to GM.';
      } else if (currentStage === 'Pending GM' && requisition.type === 'Cash') {
        nextStage = 'Completed';
        const today = new Date().toISOString().slice(0, 10);
        db.prepare(`
          INSERT INTO accounting_ledger (
            entry_date, inv_no, type, category, description, gross_amount,
            net_amount, is_vat_exempt, received_by, reference_id
          ) VALUES (?, ?, 'Expense', 'Approved Cash Requisition', ?, ?, ?, 1, ?, ?)
        `).run(
          today,
          `EXP-CASH-${requisition.id}`,
          `${requisition.purpose} (${requisition.department})`,
          requisition.amount,
          requisition.amount,
          req.user.fullname || 'Finance Desk',
          requisition.id
        );
        message = 'Cash requisition fully approved and posted to the expense ledger.';
        if (requester?.email) notification = { to: requester.email, subject: 'Requisition Approved', body: `Your Cash Requisition ${requisition.id} has been fully approved.` };
      } else if (currentStage === 'Pending GM') {
        nextStage = 'Pending Inventory';
        message = 'GM approved. The materials request is pending Inventory issuance.';
        if (requester?.email) notification = { to: requester.email, subject: 'Requisition Approved', body: `Your Materials Requisition ${requisition.id} has been approved and is pending Inventory issuance.` };
      } else if (currentStage === 'Pending Inventory') {
        const materials = parseMaterials(JSON.parse(requisition.materials_list || '[]'));
        if (!materials) return { conflict: true, detail: 'The materials list is empty or invalid.' };

        const quantities = new Map();
        for (const material of materials) quantities.set(material.itemId, (quantities.get(material.itemId) || 0) + material.qty);
        const stock = [];
        for (const [itemId, quantity] of quantities) {
          const item = db.prepare('SELECT id, item_name, qty FROM inventory WHERE id = ?').get(itemId);
          if (!item) return { conflict: true, detail: `Inventory item ${itemId} no longer exists.` };
          if (item.qty < quantity) return { insufficientStock: true, itemName: item.item_name, available: item.qty, requested: quantity };
          stock.push({ ...item, quantity });
        }

        for (const item of stock) {
          db.prepare('UPDATE inventory SET qty = qty - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
            .run(item.quantity, item.id);
        }

        const workOrder = requisition.work_order_id
          ? db.prepare('SELECT assigned_materials, team_id FROM work_orders WHERE id = ?').get(requisition.work_order_id)
          : null;
        if (workOrder) {
          const assigned = JSON.parse(workOrder.assigned_materials || '[]');
          assigned.push(...materials);
          db.prepare('UPDATE work_orders SET assigned_materials = ? WHERE id = ?')
            .run(JSON.stringify(assigned), requisition.work_order_id);
          if (workOrder.team_id) {
            const team = db.prepare('SELECT leader_id FROM daily_teams WHERE id = ?').get(workOrder.team_id);
            if (team?.leader_id) {
              db.prepare(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Materials Issued', ?, 'Materials')
              `).run(team.leader_id, `Materials for ${requisition.work_order_id} have been issued.`);
              const lead = db.prepare('SELECT email FROM users WHERE id = ?').get(team.leader_id);
              if (lead?.email) notification = { to: lead.email, subject: 'Materials Issued to Work Order', body: `Inventory issued the requested materials for Work Order ${requisition.work_order_id}.` };
            }
          }
        }

        nextStage = 'Completed';
        message = 'Materials issued and inventory stock updated.';
        if (!notification && requester?.email) notification = { to: requester.email, subject: 'Materials Issued', body: `Inventory issued the materials for Requisition ${requisition.id}.` };
      }

      if (!nextStage) return { conflict: true };
      db.prepare('UPDATE requisitions SET approval_stage = ? WHERE id = ?').run(nextStage, requisition.id);
      return { requisition, message, notification };
    });
    result = approveRequest();
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The requisition could not be approved because of a duplicate or invalid linked record.' });
    }
    console.error('Requisition approval failed:', error.message);
    return res.status(500).json({ message: 'The requisition could not be approved.' });
  }

  if (result.notFound) return res.status(404).json({ message: 'Requisition not found.' });
  if (result.forbidden) return res.status(403).json({ message: 'You are not authorized to approve this stage.' });
  if (result.insufficientStock) {
    return res.status(409).json({ message: `Not enough ${result.itemName} in stock: ${result.available} available, ${result.requested} requested.` });
  }
  if (result.conflict) return res.status(409).json({ message: result.detail || 'This requisition is no longer awaiting approval.' });

  if (result.notification) sendEmail(result.notification.to, result.notification.subject, result.notification.body);
  emitChange(req);
  res.json({ message: result.message });
});

export default router;
