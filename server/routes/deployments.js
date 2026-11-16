import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';

const router = express.Router();
const CAN_CREATE_DEPLOYMENT = ['Sales', 'NOC', 'Management', 'GM', 'Dev'];
const CAN_COMPLETE_DEPLOYMENT = ['HOD NOC', 'NOC', 'HOD Fiber', 'Fiber', 'Management', 'GM', 'Dev'];

const numericValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return NaN;
  return Number(String(value).replace(/[₦,$,\s]/g, ''));
};

function validIsoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function emitChange(req) {
  req.io?.emit('erp-data-changed');
}

router.get('/', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM deployments ORDER BY created_at DESC').all());
});

router.post('/', authenticateToken, requireRoles(CAN_CREATE_DEPLOYMENT), (req, res) => {
  const customerName = String(req.body.customer_name || '').trim();
  const email = String(req.body.email || '').trim();
  const location = String(req.body.location || '').trim();
  const plan = String(req.body.plan || '').trim();
  const amount = numericValue(req.body.amount);
  const paymentDate = req.body.date_of_payment ? validIsoDate(req.body.date_of_payment) : null;
  const startDate = req.body.start_date ? validIsoDate(req.body.start_date) : null;
  const endDate = req.body.end_date ? validIsoDate(req.body.end_date) : null;

  if (!customerName || !location || !plan) {
    return res.status(400).json({ message: 'Customer name, exact location, and service plan are required.' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Enter a deployment payment amount greater than zero.' });
  }
  if ((req.body.date_of_payment && !paymentDate) || (req.body.start_date && !startDate) || (req.body.end_date && !endDate)) {
    return res.status(400).json({ message: 'Enter valid deployment dates.' });
  }

  try {
    const createDeployment = db.transaction(() => {
      const existingCustomer = req.body.customer_id
        ? db.prepare('SELECT id FROM customers WHERE id = ?').get(req.body.customer_id)
        : db.prepare('SELECT id FROM customers WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1').get(customerName);
      const depId = generateId('deployment', 'DEP');
      db.prepare(`
        INSERT INTO deployments (
          id, customer_id, customer_name, customer_type, email, phone, location, plan, amount,
          payment_mode, status, date_of_payment, priority, start_date, end_date,
          sales_made_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Awaiting Splicing', ?, ?, ?, ?, ?, ?)
      `).run(
        depId,
        existingCustomer?.id || null,
        customerName,
        String(req.body.customer_type || 'FTTH').trim(),
        email,
        String(req.body.phone || '').trim(),
        location,
        plan,
        amount,
        String(req.body.payment_mode || 'Bank Transfer').trim(),
        paymentDate,
        String(req.body.priority || 'Medium').trim(),
        startDate,
        endDate,
        String(req.body.sales_made_by || '').trim(),
        String(req.body.notes || '').trim()
      );
      return depId;
    });

    const id = createDeployment();
    emitChange(req);
    res.status(201).json({ id });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The deployment could not be saved because a linked record is invalid.' });
    }
    console.error('Deployment creation failed:', error.message);
    res.status(500).json({ message: 'The deployment could not be saved.' });
  }
});

router.patch('/:id/resolve', authenticateToken, requireRoles(CAN_COMPLETE_DEPLOYMENT), (req, res) => {
  const invoiceNumber = `INV-DEP-${req.params.id}`;
  const entryDateNow = new Date().toISOString().slice(0, 10);

  try {
    const completeDeployment = db.transaction(() => {
      const dep = db.prepare('SELECT * FROM deployments WHERE id = ?').get(req.params.id);
      if (!dep) return { notFound: true };

      const completedAt = validIsoDate(dep.date_of_payment) || entryDateNow;
      const customerById = dep.customer_id
        ? db.prepare('SELECT * FROM customers WHERE id = ?').get(dep.customer_id)
        : null;
      const customerByName = customerById || db.prepare(`
        SELECT * FROM customers WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1
      `).get(dep.customer_name);
      let customer = customerByName;

      if (!customer) {
        const customerId = generateId('customer', 'CUST');
        const voixNo = `VX-${Math.floor(100000 + Math.random() * 900000)}`;
        db.prepare(`
          INSERT INTO customers (
            id, voix_no, name, customer_type, email, phone, address, mac_address,
            service_plan, ip_address, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
        `).run(
          customerId,
          voixNo,
          dep.customer_name,
          dep.customer_type || 'FTTH',
          dep.email || '',
          dep.phone || '',
          dep.location || '',
          String(req.body.onu_mac || '').trim(),
          dep.plan || '',
          String(req.body.assigned_ip || '').trim() || 'Unassigned'
        );
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      } else if (dep.email && !String(customer.email || '').trim()) {
        db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(dep.email, customer.id);
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
      }

      db.prepare(`
        UPDATE deployments
        SET status = 'Completed', customer_id = ?, fat_box = ?, splitter_port = ?,
            onu_mac = ?, assigned_ip = ?
        WHERE id = ?
      `).run(
        customer.id,
        String(req.body.fat_box || dep.fat_box || 'FAT-01').trim(),
        String(req.body.splitter_port || dep.splitter_port || 'Port 4').trim(),
        String(req.body.onu_mac || dep.onu_mac || '').trim(),
        String(req.body.assigned_ip || dep.assigned_ip || '').trim(),
        dep.id
      );

      let paymentCreated = false;
      if (Number(dep.amount) > 0) {
        const existingPayment = db.prepare(`
          SELECT * FROM accounting_ledger
          WHERE type = 'Income' AND category = 'Installation & Setup Fee'
            AND (reference_id = ? OR inv_no = ?)
          ORDER BY id ASC LIMIT 1
        `).get(dep.id, invoiceNumber);

        if (existingPayment) {
          // Repair old completed deployments whose payment was posted before it
          // could be attached to the customer profile, without duplicating it.
          db.prepare(`
            UPDATE accounting_ledger
            SET customer_id = ?, customer_name = ?, customer_type = ?,
                reference_id = coalesce(nullif(reference_id, ''), ?)
            WHERE id = ?
          `).run(customer.id, customer.name, customer.customer_type || dep.customer_type || 'FTTH', dep.id, existingPayment.id);
          const priorPaymentDate = validIsoDate(existingPayment.entry_date) || completedAt;
          if (!customer.last_payment_date || priorPaymentDate >= String(customer.last_payment_date).slice(0, 10)) {
            db.prepare(`
              UPDATE customers SET amount_paid = ?, last_payment_date = ?, status = 'Active'
              WHERE id = ?
            `).run(Number(existingPayment.gross_amount || dep.amount), priorPaymentDate, customer.id);
          }
        } else {
          const grossAmount = Number(dep.amount);
          const netAmount = grossAmount / 1.075;
          const vatAmount = grossAmount - netAmount;
          db.prepare(`
            INSERT INTO accounting_ledger (
              customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
              description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
              payment_mode, duration_months, next_due_date, received_by, reference_id
            ) VALUES (?, ?, ?, ?, ?, 'Income', 'Installation & Setup Fee', ?, ?, 0, 7.5, ?, ?, ?, 0, NULL, ?, ?)
          `).run(
            customer.id,
            completedAt,
            invoiceNumber,
            customer.name,
            customer.customer_type || dep.customer_type || 'FTTH',
            `Deployment payment for ${dep.location}`,
            grossAmount,
            vatAmount,
            netAmount,
            String(dep.payment_mode || 'Bank Transfer'),
            dep.sales_made_by || 'System Auto',
            dep.id
          );

          // amount_paid represents the most recently recorded payment in the
          // current customer UI; do not move that summary backward for delayed
          // deployment completion.
          if (!customer.last_payment_date || completedAt >= String(customer.last_payment_date).slice(0, 10)) {
            db.prepare(`
              UPDATE customers
              SET amount_paid = ?, last_payment_date = ?, status = 'Active',
                  outstanding_balance = max(0, coalesce(outstanding_balance, 0) - ?)
              WHERE id = ?
            `).run(grossAmount, completedAt, grossAmount, customer.id);
          } else {
            db.prepare(`
              UPDATE customers
              SET outstanding_balance = max(0, coalesce(outstanding_balance, 0) - ?)
              WHERE id = ?
            `).run(grossAmount, customer.id);
          }
          paymentCreated = true;
        }
      }

      const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id);
      const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(dep.id);
      return { deployment, customer: updatedCustomer, paymentCreated };
    });

    const result = completeDeployment();
    if (result.notFound) return res.status(404).json({ message: 'Deployment not found.' });
    emitChange(req);
    res.json({
      message: result.paymentCreated
        ? 'Deployment completed and the initial payment was recorded on the customer profile.'
        : 'Deployment completed and the customer profile is linked.',
      deployment: result.deployment,
      customer: result.customer,
      payment_created: result.paymentCreated
    });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The deployment could not be completed because of a duplicate or invalid linked record.' });
    }
    console.error('Deployment completion failed:', error.message);
    res.status(500).json({ message: 'The deployment could not be completed.' });
  }
});

export default router;
