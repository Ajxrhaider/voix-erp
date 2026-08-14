import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import db from './db.js';

// Import Modular Routes (You must create these files in server/routes/)
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import salesRoutes from './routes/sales.js';
import deploymentRoutes from './routes/deployments.js';
import ticketRoutes from './routes/tickets.js';
import teamRoutes from './routes/teams.js';
import inventoryRoutes from './routes/inventory.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://voix-erp.vercel.app',
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS Blocking: Origin unauthorized.'));
  },
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
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
app.use('/api/crm', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/inventory', inventoryRoutes);

// --- ACCOUNTING LEDGER ROUTES ---

// GET: Fetch all ledger transactions for the Accounting Module and AppContext
app.get('/api/accounting/ledger', (req, res) => {
  try {
    const ledger = db.prepare(`SELECT * FROM accounting_ledger ORDER BY entry_date DESC, id DESC`).all();
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: General Ledger route helper for manual income entries
app.post('/api/accounting/ledger', (req, res) => {
  try {
    const {
      entry_date, inv_no, customer_name, customer_type, type, category, description,
      gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode,
      duration_months, next_due_date, received_by
    } = req.body;

    db.prepare(`
      INSERT INTO accounting_ledger (
        entry_date, inv_no, customer_name, customer_type, type, category, description,
        gross_amount, is_vat_exempt, vat_rate, vat_amount, net_amount, payment_mode,
        duration_months, next_due_date, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry_date, inv_no, customer_name || '', customer_type || 'FTTH', type || 'Income',
      category, description, gross_amount, is_vat_exempt || 0, vat_rate || 7.5,
      vat_amount || 0, net_amount, payment_mode || 'Bank Transfer', duration_months || 1,
      next_due_date || '-', received_by || 'Finance Desk'
    );

    io.emit('erp-data-changed');
    res.status(201).json({ message: 'Transaction posted to General Ledger' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const APP_PORT = process.env.PORT || 5000;
server.listen(APP_PORT, () => console.log(`Voix ERP Production Kernel Engine online on port ${APP_PORT}`));