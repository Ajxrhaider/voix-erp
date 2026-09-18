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

// Update Customer Balances & Trigger Notification
router.patch('/:id/payment', authenticateToken, (req, res) => {
  const { amount_paid, last_payment_date, next_due_date } = req.body;
  const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!cust) return res.status(404).json({ message: 'Customer not found' });

  const newAmountPaid = (parseFloat(cust.amount_paid) || 0) + parseFloat(amount_paid);
  const newBalance = Math.max(0, (parseFloat(cust.outstanding_balance) || 0) - parseFloat(amount_paid));

  // Update profile
  db.prepare(`UPDATE customers SET amount_paid = ?, outstanding_balance = ?, last_payment_date = ?, next_due_date = ?, status = 'Active' WHERE id = ?`)
    .run(newAmountPaid, newBalance, last_payment_date, next_due_date, req.params.id);

  // Distribute Notification to Management & Accounting
  const oversightTeam = db.prepare(`SELECT id FROM users WHERE roles LIKE '%"Management"%' OR roles LIKE '%"Accounting"%' OR roles LIKE '%"GM"%'`).all();
  oversightTeam.forEach(staff => {
    db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Payment')`)
      .run(staff.id, 'Subscription Payment Received', `₦${parseFloat(amount_paid).toLocaleString()} logged for ${cust.name}`);
  });

  req.io.emit('erp-data-changed');
  res.json({ message: 'Payment recorded, profile updated, and notifications dispatched.' });
});

export default router;