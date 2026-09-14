import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM customers ORDER BY name ASC`).all());
});

// Fully detailed Manual Customer Creation Endpoint
router.post('/', authenticateToken, (req, res) => {
  const {
    voix_no, name, mac_address, customer_type, payment_schedule, amount_payable,
    amount_paid, bank_received, last_payment_date, next_due_date, outstanding_balance,
    address, email, phone
  } = req.body;
  
  const custId = generateId('customer', 'CUST');
  const vNo = voix_no || `VX-${Math.floor(100000 + Math.random() * 900000)}`;

  db.prepare(`
    INSERT INTO customers (
      id, voix_no, name, mac_address, customer_type, payment_schedule, amount_payable,
      amount_paid, bank_received, last_payment_date, next_due_date, outstanding_balance,
      address, email, phone, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
  `).run(
    custId, vNo, name, mac_address||'', customer_type||'FTTH', payment_schedule||'Monthly',
    parseFloat(amount_payable)||0, parseFloat(amount_paid)||0, bank_received||'',
    last_payment_date||null, next_due_date||null, parseFloat(outstanding_balance)||0,
    address||'', email||'', phone||''
  );

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: custId });
});

router.post('/bulk-import', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Excel or CSV file required' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO customers (id, voix_no, name, customer_type, address, phone, email, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
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

        insertStmt.run(custId, voixNo, name, type, address, phone, email);
        importedCount++;
      }
    });

    insertMany(rawData);
    req.io.emit('erp-data-changed');
    res.json({ message: `Successfully imported ${importedCount} customer profiles from spreadsheet.` });
  } catch (err) {
    res.status(500).json({ message: `Import error: ${err.message}` });
  }
});

router.post('/:id/pay', authenticateToken, (req, res) => {
  const { amount, description } = req.body;
  const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  
  // Update Customer's Financial Tracking arrays
  db.prepare(`UPDATE customers SET amount_paid = amount_paid + ?, outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?`).run(amount, amount, cust.id);

  // Auto Income
  const invNo = `INV-SUB-${Date.now().toString().slice(-4)}`;
  const net = amount / 1.075;
  const vat = amount - net;
  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO accounting_ledger (entry_date, inv_no, customer_name, customer_type, type, category, description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode, reference_id)
    VALUES (?, ?, ?, ?, 'Income', 'Monthly Bandwidth Subscription', ?, ?, 0, 7.5, ?, ?, 'Bank Transfer', ?)
  `).run(today, invNo, cust.name, cust.customer_type, description, amount, vat, net, cust.id);
  
  req.io.emit('erp-data-changed');
  res.json({ message: 'Payment recorded and Ledger updated' });
});

export default router;