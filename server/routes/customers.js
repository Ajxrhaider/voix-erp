import express from 'express';
import multer from 'multer';
import path from 'path';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { getPaymentReminderDays, notifyPaymentReceived, syncUpcomingPaymentNotifications } from '../services/paymentReminders.js';
import { importLegacyFiles } from '../utils/dataMigration.js';

const router = express.Router();
const allowedImportExtensions = new Set(['.csv', '.xlsx', '.xls', '.html', '.htm']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedImportExtensions.has(extension)) {
      return callback(new Error('Upload CSV, XLSX, XLS, or HTML spreadsheet exports only.'));
    }
    callback(null, true);
  }
});

const importFields = upload.fields([
  { name: 'files', maxCount: 10 },
  { name: 'file', maxCount: 1 }
]);

function handleImportUpload(req, res, next) {
  importFields(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.message });
    next();
  });
}

const numericValue = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(/[₦,$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validIsoDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === value ? value : null;
};

function addMonthsClamped(isoDate, months) {
  const baseMatch = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!baseMatch) return null;
  const year = Number(baseMatch[1]);
  const monthIndex = Number(baseMatch[2]) - 1;
  const day = Number(baseMatch[3]);
  const targetMonthIndex = monthIndex + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function emitChange(req) {
  req.io?.emit('erp-data-changed');
}

// Get all customer accounts for CRM and customer-service pickers.
router.get('/', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC').all());
});

// Due and overdue accounts for a dashboard reminder list.
router.get('/payment-due', authenticateToken, (req, res) => {
  const requestedDays = Number.parseInt(req.query.days, 10);
  const noticeDays = Number.isFinite(requestedDays)
    ? Math.min(Math.max(requestedDays, 1), 60)
    : getPaymentReminderDays();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + noticeDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  syncUpcomingPaymentNotifications(req.io);
  const customers = db.prepare(`
    SELECT id, voix_no, name, phone, email, status, payment_schedule,
      amount_payable, amount_paid, outstanding_balance, next_due_date
    FROM customers
    WHERE next_due_date IS NOT NULL
      AND trim(next_due_date) <> ''
      AND date(next_due_date) <= date(?)
      AND lower(trim(coalesce(status, 'active'))) NOT IN ('inactive', 'suspended', 'cancelled', 'canceled')
    ORDER BY date(next_due_date) ASC, name COLLATE NOCASE ASC
  `).all(cutoffIso);
  res.json({ notice_days: noticeDays, customers });
});

// The full account view is served from the database, not inferred from the
// current screen's already-filtered lists.
router.get('/:id/profile', authenticateToken, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const queries = db.prepare(`
    SELECT * FROM tickets
    WHERE customer_id = ?
      OR lower(trim(customer_name)) = lower(trim(?))
      OR (customer_ip IS NOT NULL AND trim(customer_ip) <> '' AND trim(customer_ip) = trim(?))
    ORDER BY coalesce(date_received, substr(created_at, 1, 10)) DESC, created_at DESC, id DESC
  `).all(customer.id, customer.name, customer.ip_address || '');

  const payments = db.prepare(`
    SELECT * FROM accounting_ledger
    WHERE customer_id = ? OR reference_id = ?
      OR lower(trim(coalesce(customer_name, ''))) = lower(trim(?))
    ORDER BY CASE
      WHEN type = 'Income' AND category = 'Installation & Setup Fee' THEN 0
      ELSE 1
    END, entry_date DESC, id DESC
  `).all(customer.id, customer.id, customer.name);

  const deployments = db.prepare(`
    SELECT * FROM deployments
    WHERE customer_id = ? OR lower(trim(customer_name)) = lower(trim(?))
    ORDER BY coalesce(start_date, created_at) DESC, created_at DESC
  `).all(customer.id, customer.name);

  res.json({ customer, queries, payments, deployments });
});

// Create a new customer profile manually.
router.post('/', authenticateToken, requireRoles(['Customer Service', 'Accounting', 'Admin', 'Management', 'GM', 'Dev']), (req, res) => {
  const {
    voix_no, name, mac_address, customer_type, service_plan, ip_address,
    payment_schedule, amount_payable, amount_paid, bank_received,
    last_payment_date, next_due_date, outstanding_balance, address, email,
    phone, status
  } = req.body;

  const cleanName = String(name || '').trim();
  if (!cleanName) return res.status(400).json({ message: 'Customer name is required.' });

  const customerId = generateId('customer', 'CUST');
  const voixNo = String(voix_no || '').trim() || `VX-${Math.floor(100000 + Math.random() * 900000)}`;
  try {
    db.prepare(`
      INSERT INTO customers (
        id, voix_no, name, mac_address, customer_type, service_plan, ip_address,
        payment_schedule, amount_payable, amount_paid, bank_received,
        last_payment_date, next_due_date, outstanding_balance, address, email,
        phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      voixNo,
      cleanName,
      String(mac_address || '').trim(),
      customer_type || 'FTTH',
      String(service_plan || '').trim(),
      String(ip_address || '').trim() || 'Unassigned',
      payment_schedule || 'Monthly',
      numericValue(amount_payable),
      numericValue(amount_paid),
      String(bank_received || '').trim(),
      validIsoDate(last_payment_date),
      validIsoDate(next_due_date),
      numericValue(outstanding_balance),
      String(address || '').trim(),
      String(email || '').trim(),
      String(phone || '').trim(),
      status || 'Active'
    );
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'That Voix Number is already assigned to a customer.' });
    }
    throw error;
  }

  emitChange(req);
  res.status(201).json({ id: customerId });
});

// Import and merge the legacy customer, payment, query, deployment and day-book
// sheets. Re-importing a file updates stable source rows instead of duplicating them.
router.post(
  ['/import', '/bulk-import'],
  authenticateToken,
  requireRoles(['Customer Service', 'Accounting', 'Admin', 'Management', 'GM', 'Dev']),
  handleImportUpload,
  (req, res) => {
    const files = [
      ...(req.files?.files || []),
      ...(req.files?.file || [])
    ];
    if (files.length === 0) return res.status(400).json({ message: 'Select at least one CSV, Excel, or HTML spreadsheet export.' });

    const result = importLegacyFiles(files);
    const successfulImports = result.summaries.filter((summary) => !['Import error', 'Not recognized'].includes(summary.type));
    if (successfulImports.length > 0) {
      syncUpcomingPaymentNotifications(req.io);
      emitChange(req);
    }
    res.json({ message: 'Legacy data import finished.', ...result });
  }
);

function recordSubscriptionPayment(req, res) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });

  const grossAmount = numericValue(req.body.gross_amount ?? req.body.amount_paid ?? req.body.amount, NaN);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return res.status(400).json({ message: 'Payment amount must be greater than zero.' });
  }

  const entryDate = validIsoDate(req.body.entry_date || req.body.date) || new Date().toISOString().slice(0, 10);
  const durationMonths = Math.max(0, Math.min(120, Number.parseInt(req.body.duration_months ?? req.body.durationMonths ?? 1, 10) || 0));
  const invoiceNumber = String(req.body.inv_no || req.body.reference || `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`).trim();
  const isVatExempt = req.body.is_vat_exempt === true || req.body.is_vat_exempt === 1 || req.body.isVatExempt === true ? 1 : 0;
  const vatRate = isVatExempt ? 0 : numericValue(req.body.vat_rate, 7.5);
  const vatAmount = isVatExempt ? 0 : numericValue(req.body.vat_amount, 0);
  const netAmount = numericValue(req.body.net_amount, Math.max(0, grossAmount - vatAmount));
  const currentDueDate = validIsoDate(customer.next_due_date);
  const nextDueDate = durationMonths > 0
    ? addMonthsClamped(currentDueDate && currentDueDate > entryDate ? currentDueDate : entryDate, durationMonths)
    : currentDueDate;

  if (db.prepare('SELECT id FROM accounting_ledger WHERE inv_no = ?').get(invoiceNumber)) {
    return res.status(409).json({ message: 'That payment reference has already been recorded.' });
  }

  try {
    const insertPayment = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO accounting_ledger (
          customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
          description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
          payment_mode, duration_months, next_due_date, received_by, reference_id
        ) VALUES (?, ?, ?, ?, ?, 'Income', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.id,
        entryDate,
        invoiceNumber,
        customer.name,
        customer.customer_type || 'FTTH',
        req.body.category || 'Monthly Bandwidth Subscription',
        req.body.description || `Subscription renewal (${durationMonths || 'one-off'} month${durationMonths === 1 ? '' : 's'})`,
        grossAmount,
        isVatExempt,
        vatRate,
        vatAmount,
        netAmount,
        req.body.payment_mode || req.body.method || 'Bank Transfer',
        durationMonths,
        nextDueDate,
        req.body.received_by || req.body.receivedBy || 'Customer Service',
        customer.id
      );

      db.prepare(`
        UPDATE customers
        SET amount_paid = ?,
            outstanding_balance = max(0, coalesce(outstanding_balance, 0) - ?),
            last_payment_date = ?,
            next_due_date = ?,
            status = 'Active'
        WHERE id = ?
      `).run(grossAmount, grossAmount, entryDate, nextDueDate, customer.id);
      db.prepare(`
        UPDATE notifications SET is_read = 1
        WHERE reference_id = ? AND type = 'Payment Due' AND is_read = 0
      `).run(customer.id);
      return result.lastInsertRowid;
    });

    const paymentId = insertPayment();
    const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
    notifyPaymentReceived({ customer: updatedCustomer, amount: grossAmount, invoiceNumber }, req.io);
    syncUpcomingPaymentNotifications(req.io);
    emitChange(req);
    return res.status(201).json({
      message: 'Payment saved to the customer profile and accounting ledger.',
      payment_id: paymentId,
      next_due_date: nextDueDate,
      customer: updatedCustomer
    });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'That payment reference has already been recorded.' });
    }
    console.error('Payment recording failed:', error.message);
    return res.status(500).json({ message: 'Could not record the payment.' });
  }
}

router.post(
  '/:id/payments',
  authenticateToken,
  requireRoles(['Customer Service', 'Accounting', 'Admin', 'NOC', 'Management', 'GM', 'Dev']),
  recordSubscriptionPayment
);

// Backward-compatible balance update for clients running an older frontend.
router.patch('/:id/payment', authenticateToken, requireRoles(['Customer Service', 'Accounting', 'Admin', 'NOC', 'Management', 'GM', 'Dev']), (req, res) => {
  const amount = numericValue(req.body.amount_paid, NaN);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than zero.' });
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });

  const nextDue = validIsoDate(req.body.next_due_date) || customer.next_due_date;
  db.prepare(`
    UPDATE customers
    SET amount_paid = ?,
        outstanding_balance = max(0, coalesce(outstanding_balance, 0) - ?),
        last_payment_date = ?, next_due_date = ?, status = 'Active'
    WHERE id = ?
  `).run(amount, amount, validIsoDate(req.body.last_payment_date) || new Date().toISOString().slice(0, 10), nextDue, customer.id);
  db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE reference_id = ? AND type = 'Payment Due' AND is_read = 0
  `).run(customer.id);

  syncUpcomingPaymentNotifications(req.io);
  emitChange(req);
  res.json({ message: 'Customer balance updated.' });
});

export default router;
