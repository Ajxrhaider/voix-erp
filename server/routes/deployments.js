import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM deployments ORDER BY created_at DESC`).all());
});

router.post('/', authenticateToken, (req, res) => {
  // Captures all original spreadsheet columns
  const { 
    customer_name, customer_type, phone, location, plan, amount,
    date_of_payment, priority, start_date, end_date, sales_made_by, notes 
  } = req.body;
  
  const depId = generateId('deployment', 'DEP');
  
  db.prepare(`
    INSERT INTO deployments (
      id, customer_name, customer_type, phone, location, plan, amount, status,
      date_of_payment, priority, start_date, end_date, sales_made_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Awaiting Splicing', ?, ?, ?, ?, ?, ?)
  `).run(
    depId, customer_name, customer_type || 'FTTH', phone || '', location, plan, parseFloat(amount) || 0,
    date_of_payment || null, priority || 'Medium', start_date || null, end_date || null, sales_made_by || '', notes || ''
  );

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: depId });
});

router.patch('/:id/resolve', authenticateToken, requireRoles(['HOD NOC', 'NOC', 'HOD Fiber', 'Fiber', 'Management', 'GM', 'Dev']), (req, res) => {
  const { fat_box, splitter_port, onu_mac, assigned_ip } = req.body;
  const dep = db.prepare(`SELECT * FROM deployments WHERE id = ?`).get(req.params.id);
  if (!dep) return res.status(404).json({ message: 'Deployment not found' });

  db.prepare(`UPDATE deployments SET status = 'Completed', fat_box = ?, splitter_port = ?, onu_mac = ?, assigned_ip = ? WHERE id = ?`)
    .run(fat_box || 'FAT-01', splitter_port || 'Port 4', onu_mac || '', assigned_ip || '', dep.id);

  // AUTOMATED FLOW: Creates Customer Profile
  const existingCust = db.prepare(`SELECT id FROM customers WHERE name = ?`).get(dep.customer_name);
  if (!existingCust) {
    const custId = generateId('customer', 'CUST');
    const voixNo = `VX-${Math.floor(100000 + Math.random() * 900000)}`;
    
    db.prepare(`
      INSERT INTO customers (id, voix_no, name, customer_type, phone, address, mac_address, service_plan, ip_address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(custId, voixNo, dep.customer_name, dep.customer_type, dep.phone || '', dep.location, onu_mac || '', dep.plan, assigned_ip || '');
  }

  // AUTOMATED FLOW: Income Record
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

  req.io.emit('erp-data-changed');
  res.json({ message: 'Deployment completed and customer profile automatically active.' });
});

export default router;