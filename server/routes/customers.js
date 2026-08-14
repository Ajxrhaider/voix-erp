import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/crm/customers (List all customers)
router.get('/customers', authenticateToken, (req, res) => {
  const customers = db.prepare(`SELECT * FROM customers ORDER BY name ASC`).all();
  res.json(customers);
});

// GET /api/crm/customers/:id (Rich Customer Profile)
router.get('/customers/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const payments = db.prepare(`SELECT * FROM accounting_ledger WHERE reference_id = ? OR customer_name = ? ORDER BY entry_date DESC`).all(id, customer.name);
  const tickets = db.prepare(`SELECT * FROM tickets WHERE customer_id = ? OR customer_name = ? ORDER BY created_at DESC`).all(id, customer.name);
  const deployments = db.prepare(`SELECT * FROM deployments WHERE customer_name = ? ORDER BY created_at DESC`).all(customer.name);

  res.json({
    ...customer,
    payments,
    tickets,
    deployments
  });
});

// POST /api/crm/customers (Manual Creation)
router.post('/customers', authenticateToken, (req, res) => {
  const { name, customer_type, email, phone, address, mac_address, service_plan, ip_address } = req.body;
  if (!name) return res.status(400).json({ message: 'Customer name is mandatory' });

  const custId = generateId('customer', 'CUST');
  const voixNo = `VX-${Math.floor(100000 + Math.random() * 900000)}`;

  const stmt = db.prepare(`
    INSERT INTO customers (id, voix_no, name, customer_type, email, phone, address, mac_address, service_plan, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(custId, voixNo, name, customer_type || 'FTTH', email || '', phone || '', address || '', mac_address || '', service_plan || '50Mbps Standard', ip_address || 'Unassigned');

  const created = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(custId);
  res.status(201).json(created);
});

// POST /api/crm/customers/import (Excel/CSV Bulk Importer supporting Profiles.xlsx & Client List)
router.post('/customers/import', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Excel or CSV file required' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;
    const insertStmt = db.prepare(`
      INSERT INTO customers (id, voix_no, name, customer_type, email, phone, address, mac_address, service_plan, ip_address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        const custId = generateId('customer', 'CUST');
        const voixNo = row['Voix Number'] || row['VOIX NO'] || `VX-${Math.floor(100000 + Math.random() * 900000)}`;
        const name = row['Customer Name'] || row['Name'] || row['CLIENT NAME'] || 'Unknown Subscriber';
        const type = (row['Type'] || row['Category'] || '').toUpperCase().includes('ENT') ? 'Enterprise' : 'FTTH';
        const email = row['Email'] || row['EMAIL ADDRESS'] || '';
        const phone = row['Phone'] || row['PHONE NUMBER'] || '';
        const address = row['Address'] || row['LOCATION'] || '';
        const mac = row['MAC'] || row['MAC ADDRESS'] || row['ONU MAC'] || '';
        const plan = row['Plan'] || row['SERVICE PLAN'] || row['Package'] || '50Mbps Unlimited';
        const ip = row['IP'] || row['IP ADDRESS'] || 'Unassigned';

        insertStmt.run(custId, voixNo, name, type, email, phone, address, mac, plan, ip, 'Active');
        importedCount++;
      }
    });

    insertMany(rawData);
    res.json({ message: `Successfully imported ${importedCount} customer profiles from spreadsheet.` });
  } catch (err) {
    res.status(500).json({ message: `Import error: ${err.message}` });
  }
});

// POST /api/crm/customers/:id/pay (Record Subscription / One-time Payment -> Auto Income Day Book)
router.post('/customers/:id/pay', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { amount, category, description, durationMonths, isVatExempt, paymentMode } = req.body;

  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  if (!customer) return res.status(404).json({ message: 'Customer record not found' });

  const gross = parseFloat(amount) || 0;
  if (gross <= 0) return res.status(400).json({ message: 'Valid payment amount required' });

  // 7.5% VAT Engine
  let vatAmount = 0;
  let netAmount = gross;
  if (!isVatExempt) {
    netAmount = gross / 1.075;
    vatAmount = gross - netAmount;
  }

  // Calculate Next Due Date
  let nextDueDate = '-';
  const months = parseInt(durationMonths) || 0;
  if (months > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    nextDueDate = d.toISOString().split('T')[0];
  }

  const invNo = `INV-VN-2026-${Date.now().toString().slice(-4)}`;
  const today = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    INSERT INTO accounting_ledger (
      entry_date, inv_no, customer_name, customer_type, type, category, description,
      gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode,
      duration_months, next_due_date, received_by, reference_id
    ) VALUES (?, ?, ?, ?, 'Income', ?, ?, ?, ?, 7.5, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    today, invNo, customer.name, customer.customer_type,
    category || 'Monthly Bandwidth Subscription',
    description || `${customer.service_plan} Renewal (${months} Mo)`,
    gross, isVatExempt ? 1 : 0, vatAmount, netAmount,
    paymentMode || 'Bank Transfer', months, nextDueDate,
    req.user.fullname, customer.id
  );

  res.json({ message: 'Payment recorded and posted to Accounting Income Day Book successfully', invNo, nextDueDate });
});

export default router;