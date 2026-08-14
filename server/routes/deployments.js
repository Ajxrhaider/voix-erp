import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/deployments
router.get('/', authenticateToken, (req, res) => {
  const deployments = db.prepare(`SELECT * FROM deployments ORDER BY created_at DESC`).all();
  res.json(deployments);
});

// POST /api/deployments (Manual Deployment creation allowed)
router.post('/', authenticateToken, (req, res) => {
  const { customer_name, customer_type, phone, location, plan, amount } = req.body;
  if (!customer_name || !location) return res.status(400).json({ message: 'Customer name and installation address required' });

  const depId = generateId('deployment', 'DEP');
  db.prepare(`
    INSERT INTO deployments (id, customer_name, customer_type, phone, location, plan, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Awaiting Splicing')
  `).run(depId, customer_name, customer_type || 'FTTH', phone || '', location, plan || '50Mbps Standard', parseFloat(amount) || 0);

  res.status(201).json({ id: depId, message: 'Deployment initialized' });
});

// PATCH /api/deployments/:id/resolve (Resolve/Complete deployment -> Auto Customer Profile)
router.patch('/:id/resolve', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { fat_box, splitter_port, onu_mac, assigned_ip } = req.body;

  const dep = db.prepare(`SELECT * FROM deployments WHERE id = ?`).get(id);
  if (!dep) return res.status(404).json({ message: 'Deployment not found' });

  db.prepare(`
    UPDATE deployments 
    SET status = 'Completed', fat_box = ?, splitter_port = ?, onu_mac = ?, assigned_ip = ? 
    WHERE id = ?
  `).run(fat_box || 'FAT-01', splitter_port || 'Port 4', onu_mac || '00:1A:2B:3C:4D:5E', assigned_ip || '192.168.100.25', id);

  // AUTOMATED FLOW: Finished deployment creates or updates Customer Profile
  const existingCust = db.prepare(`SELECT id FROM customers WHERE name = ?`).get(dep.customer_name);
  if (!existingCust) {
    const custId = generateId('customer', 'CUST');
    const voixNo = `VX-${Math.floor(100000 + Math.random() * 900000)}`;
    
    db.prepare(`
      INSERT INTO customers (id, voix_no, name, customer_type, phone, address, mac_address, service_plan, ip_address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(custId, voixNo, dep.customer_name, dep.customer_type, dep.phone, dep.location, onu_mac || '00:1A:2B:3C:4D:5E', dep.plan, assigned_ip || '192.168.100.25');
  }

  // AUTOMATED FLOW: Record installation fee in Accounting Income if amount > 0
  if (dep.amount > 0) {
    const invNo = `INV-DEP-${Date.now().toString().slice(-4)}`;
    const today = new Date().toISOString().split('T')[0];
    const net = dep.amount / 1.075;
    const vat = dep.amount - net;

    db.prepare(`
      INSERT INTO accounting_ledger (
        entry_date, inv_no, customer_name, customer_type, type, category, description,
        gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode,
        duration_months, next_due_date, received_by, reference_id
      ) VALUES (?, ?, ?, ?, 'Income', 'Installation & Setup Fee', ?, ?, 0, 7.5, ?, ?, 'Bank Transfer', 0, '-', 'System Auto', ?)
    `).run(today, invNo, dep.customer_name, dep.customer_type, `Fiber Installation for ${dep.location}`, dep.amount, vat, net, dep.id);
  }

  res.json({ message: 'Deployment completed and customer profile automatically active.' });
});

export default router;