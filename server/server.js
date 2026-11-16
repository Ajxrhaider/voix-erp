import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import db from './db.js';

// Import Modular Routes (You must create these files in server/routes/)
import authRoutes, { authenticateToken, requireRoles } from './routes/auth.js';
import { startPaymentReminderScheduler } from './services/paymentReminders.js';
import customerRoutes from './routes/customers.js';
import salesRoutes from './routes/sales.js';
import deploymentRoutes from './routes/deployments.js';
import ticketRoutes from './routes/tickets.js';
import teamRoutes from './routes/teams.js';
import inventoryRoutes from './routes/inventory.js';

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'https://voix-erp.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean));

const isAllowedOrigin = (origin, callback) => {
  const isVercelPreview = /^https:\/\/voix-(?:erp-[a-z0-9-]+|[a-z0-9-]+-ajxrhaiders-projects)\.vercel\.app$/i.test(origin || '');
  const isArenaPreview = process.env.NODE_ENV !== 'production'
    && /^https:\/\/\d+-[a-z0-9-]+\.e2b\.app$/i.test(origin || '');
  if (!origin || allowedOrigins.has(origin) || isVercelPreview || isArenaPreview) callback(null, true);
  else callback(new Error('CORS Blocking: Origin unauthorized.'));
};

app.use(cors({ origin: isAllowedOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: isAllowedOrigin, credentials: true }
});

// Pass IO instance to all routes for real-time syncing
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log(`Real-time engine sync link node online: ${socket.id}`);
});

// Mount Modular Endpoints
app.use('/api/auth', authRoutes);
// Keep the original CRM root available while matching the customer URLs used
// by the current frontend and the legacy Sales dashboard.
app.use('/api/crm', customerRoutes);
app.use('/api/crm/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/inventory', inventoryRoutes);

// --- ACCOUNTING LEDGER ROUTES ---

app.get('/api/accounting/ledger', authenticateToken, (req, res) => {
  try {
    const ledger = db.prepare(`SELECT * FROM accounting_ledger ORDER BY entry_date DESC, id DESC`).all();
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/accounting/ledger', authenticateToken, requireRoles(['Accounting', 'Management', 'GM', 'Dev']), (req, res) => {
  try {
    const {
      customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
      description, gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount,
      payment_mode, duration_months, next_due_date, received_by, approved_by, reference_id
    } = req.body;
    const amount = Number(gross_amount);
    const normalizedType = type || 'Income';
    if (!entry_date || !Number.isFinite(amount) || amount < 0 || !['Income', 'Expense'].includes(normalizedType)) {
      return res.status(400).json({ message: 'A valid date, transaction type, and amount are required.' });
    }

    const result = db.prepare(`
      INSERT INTO accounting_ledger (
        customer_id, entry_date, inv_no, customer_name, customer_type, type,
        category, description, gross_amount, is_vat_exempt, vat_rate,
        vat_amount, net_amount, payment_mode, duration_months, next_due_date,
        received_by, approved_by, reference_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer_id || null,
      entry_date,
      inv_no || null,
      customer_name || '',
      customer_type || 'FTTH',
      normalizedType,
      category || 'General',
      description || 'Manual ledger entry',
      amount,
      is_vat_exempt ? 1 : 0,
      vat_rate ?? 7.5,
      vat_amount ?? 0,
      net_amount ?? amount,
      payment_mode || 'Bank Transfer',
      duration_months ?? 1,
      next_due_date || null,
      received_by || 'Finance Desk',
      approved_by || null,
      reference_id || customer_id || null
    );

    io.emit('erp-data-changed');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Transaction posted to General Ledger.' });
  } catch (err) {
    if (err.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'That invoice/reference number has already been recorded.' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'voix-erp-api', time: new Date().toISOString() });
});

const APP_PORT = Number(process.env.PORT) || 5000;
startPaymentReminderScheduler(io);
server.listen(APP_PORT, '0.0.0.0', () => console.log(`Voix ERP API online on port ${APP_PORT}`));