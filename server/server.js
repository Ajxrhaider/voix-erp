import 'dotenv/config';
// ... rest of your imports
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import http from 'http';
import { Server } from 'socket.io';
import db from './db.js';

const app = express();
const SECRET_KEY = process.env.JWT_SECRET || 'voix-enterprise-production-super-cipher-2026';
// ... rest of your server.js code continues ...



const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://voix-erp.vercel.app',
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS Blocking: Origin unauthorized.'));
    }
  },
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

io.on('connection', (socket) => {
  console.log(`Real-time engine sync link node online: ${socket.id}`);
});

// --- HELPER FUNCTION: ATOMIC FORMATTED ID GENERATION ---
function generateNextCustomId(sequenceName, prefix) {
  const transaction = db.transaction(() => {
    const row = db.prepare("SELECT next_val FROM id_sequences WHERE seq_name = ?").get(sequenceName);
    const currentVal = row.next_val;
    const newVal = currentVal + 1;
    db.prepare("UPDATE id_sequences SET next_val = ? WHERE seq_name = ?").run(newVal, sequenceName);
    const padSize = 3;
    const formattedNum = String(currentVal).padStart(padSize, '0');
    return `${prefix}-${formattedNum}`;
  });
  return transaction();
}

// --- SECURE ARBITRATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token omitted' });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expired or fraudulent token structure' });
    req.user = user;
    next();
  });
}

function verifyRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(432).json({ error: 'Administrative denial: Role parameters insufficient.' });
    }
    next();
  };
}

// --- 1. STAFF MANAGEMENT MODULE ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password, fullname, role } = req.body;
  try {
    const employeeId = generateNextCustomId('staff', 'EMP');
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO users (id, username, password, role, fullname) VALUES (?, ?, ?, ?, ?)")
      .run(employeeId, username, hashedPassword, role, fullname);
    io.emit('erp-data-changed');
    res.json({ success: true, employeeId });
  } catch (err) {
    res.status(400).json({ error: 'Username structurally conflicted or already taken' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Verify JSON body was parsed
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // 2. Execute the query
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    // 3. Handle user not found (Prevent bcrypt from hanging on a null hash)
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 4. Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 5. Generate Token & Respond
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
    
    // Explicitly return to close the request cycle
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });

  } catch (error) {
    console.error("Login Error:", error);
    // Ensure the server responds with a 500 instead of timing out
    return res.status(500).json({ error: "Internal server error during authentication" });
  }
});

app.get('/api/hr/staff', authenticateToken, (req, res) => {
  const profiles = db.prepare("SELECT id, username, role, fullname, created_at FROM users ORDER BY id ASC").all();
  res.json(profiles);
});

app.put('/api/hr/staff/role', authenticateToken, verifyRoles(['HR', 'GM', 'Management']), (req, res) => {
  const { targetStaffId, newRole } = req.body;
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, targetStaffId);
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 2. CUSTOMER CRM DESK WITH MASS BULK CSV/EXCEL PARSING ---
app.get('/api/crm/customers', authenticateToken, (req, res) => {
  const records = db.prepare("SELECT * FROM customers ORDER BY name ASC").all();
  const formatted = records.map(r => ({ ...r, history: JSON.parse(r.history || '[]') }));
  res.json(formatted);
});

app.post('/api/crm/customers', authenticateToken, (req, res) => {
  const { name, email, phone, location, plan } = req.body;
  const custId = `CUST-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO customers (id, name, email, phone, location, plan) VALUES (?, ?, ?, ?, ?, ?)")
    .run(custId, name, email, phone, location, plan || 'None');
  io.emit('erp-data-changed');
  res.json({ success: true, custId });
});

app.post('/api/crm/customers/bulk-import', authenticateToken, (req, res) => {
  const { rows } = req.body; // Expects sanitized payload array of JSON rows parsed directly from CSV
  const insertStmt = db.prepare("INSERT OR REPLACE INTO customers (id, name, email, phone, location, plan, ip_address, status, balance, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const transaction = db.transaction((data) => {
    for (const record of data) {
      const fallbackId = record.id || `CUST-IMP-${Math.floor(1000 + Math.random() * 9000)}`;
      insertStmt.run(
        fallbackId,
        record.name || 'Unknown Ledger Record',
        record.email || '',
        record.phone || '',
        record.location || '',
        record.plan || 'None',
        record.ip_address || 'Unassigned',
        record.status || 'Active',
        parseFloat(record.balance) || 0.0,
        record.history || '[]'
      );
    }
  });
  transaction(rows);
  io.emit('erp-data-changed');
  res.json({ success: true, count: rows.length });
});

app.post('/api/crm/customers/payment', authenticateToken, verifyRoles(['Customer Service', 'Accounting', 'Management']), (req, res) => {
  const { customerId, amount, description } = req.body;
  const transaction = db.transaction(() => {
    const cust = db.prepare("SELECT history, name FROM customers WHERE id = ?").get(customerId);
    const existingHistory = JSON.parse(cust.history || '[]');
    existingHistory.push({ date: new Date().toISOString().slice(0,10), type: 'Payment', amount, note: description });
    
    db.prepare("UPDATE customers SET history = ?, balance = balance + ? WHERE id = ?")
      .run(JSON.stringify(existingHistory), amount, customerId);
      
    db.prepare("INSERT INTO accounting_ledger (type, amount, category, reference_id) VALUES ('Income', ?, ?, ?)")
      .run(amount, 'Customer Subscription', customerId);
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 3. DYNAMIC SALES PIPELINE ENGINE (AUTOMATED DEPLOYMENT FORWARDING) ---
app.get('/api/sales/pipeline', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM sales_pipeline ORDER BY created_at DESC").all());
});

app.post('/api/sales/pipeline', authenticateToken, (req, res) => {
  const { name, location, contact, proposedPlan, stage, amount } = req.body;
  const saleId = `SALE-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO sales_pipeline (id, customer_name, location, contact, proposed_plan, stage, amount) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(saleId, name, location, contact, proposedPlan, stage, amount || 0);
  io.emit('erp-data-changed');
  res.json({ success: true, saleId });
});

app.put('/api/sales/pipeline/stage', authenticateToken, (req, res) => {
  const { saleId, targetStage } = req.body;
  const transaction = db.transaction(() => {
    db.prepare("UPDATE sales_pipeline SET stage = ? WHERE id = ?").run(targetStage, saleId);
    
    if (targetStage === 'Won') {
      const sale = db.prepare("SELECT * FROM sales_pipeline WHERE id = ?").get(saleId);
      const deploymentId = `DEP-${Date.now().toString().slice(-4)}`;
      
      db.prepare("INSERT INTO deployments (id, sale_id, customer_name, location, plan, amount, status) VALUES (?, ?, ?, ?, ?, ?, 'Awaiting Splicing')")
        .run(deploymentId, sale.id, sale.customer_name, sale.location, sale.proposed_plan, sale.amount);
        
      db.prepare("INSERT INTO accounting_ledger (type, amount, category, reference_id) VALUES ('Income', ?, 'Closed Sale', ?)")
        .run(sale.amount, saleId);
    }
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 4. DEPLOYMENTS LAYER ---
app.get('/api/deployments', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM deployments ORDER BY created_at DESC").all());
});

app.post('/api/deployments/manual', authenticateToken, (req, res) => {
  const { customerName, location, plan, amount } = req.body;
  const depId = `DEP-MAN-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO deployments (id, customer_name, location, plan, amount, status) VALUES (?, ?, ?, ?, ?, 'Awaiting Splicing')")
    .run(depId, customerName, location, plan, amount || 0);
  io.emit('erp-data-changed');
  res.json({ success: true, depId });
});

app.put('/api/deployments/:id/complete', authenticateToken, (req, res) => {
  const depId = req.params.id;
  const { ipAddress } = req.body;
  const transaction = db.transaction(() => {
    db.prepare("UPDATE deployments SET status = 'Completed' WHERE id = ?").run(depId);
    const dep = db.prepare("SELECT * FROM deployments WHERE id = ?").get(depId);
    const newCustId = `CUST-DEP-${Date.now().toString().slice(-3)}`;
    const historyTemplate = JSON.stringify([{ date: new Date().toISOString().slice(0,10), type: 'System Provisioning', note: 'Deployment loop completed successfully.' }]);
    
    db.prepare("INSERT INTO customers (id, name, location, plan, ip_address, status, balance, history) VALUES (?, ?, ?, ?, ?, 'Active', 0.0, ?)")
      .run(newCustId, dep.customer_name, dep.location, dep.plan, ipAddress || 'Unassigned DHCP', historyTemplate);
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 5. REQUISITIONS AND ACCOUNTING PORTAL ---
app.get('/api/accounting/ledger', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM accounting_ledger ORDER BY id DESC").all());
});

app.get('/api/requisitions', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM requisitions ORDER BY created_at DESC").all());
});

app.post('/api/requisitions', authenticateToken, (req, res) => {
  const { type, department, purpose, amount, materialsList } = req.body;
  const reqId = `REQ-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO requisitions (id, type, requested_by, department, purpose, amount, materials_list, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')")
    .run(reqId, type, req.user.id, department, purpose, amount || 0, JSON.stringify(materialsList || []));
  io.emit('erp-data-changed');
  res.json({ success: true, reqId });
});

app.put('/api/requisitions/:id/review', authenticateToken, verifyRoles(['Accounting', 'HR', 'GM', 'Management']), (req, res) => {
  const reqId = req.params.id;
  const { action } = req.body; // 'Approved' or 'Rejected'
  const transaction = db.transaction(() => {
    db.prepare("UPDATE requisitions SET status = ? WHERE id = ?").run(action, reqId);
    if (action === 'Approved') {
      const reqRecord = db.prepare("SELECT * FROM requisitions WHERE id = ?").get(reqId);
      if (reqRecord.type === 'Cash') {
        db.prepare("INSERT INTO accounting_ledger (type, amount, category, reference_id) VALUES ('Expense', ?, 'Requisition Approval', ?)")
          .run(reqRecord.amount, reqId);
      }
    }
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 6. TICKETS & TECHNICAL WORK ORDERS (DYNAMIC TEAMS COMPONENT) ---
app.get('/api/tickets', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM tickets ORDER BY created_at DESC").all());
});

app.post('/api/tickets', authenticateToken, (req, res) => {
  const { customerId, title, description, type } = req.body;
  const tktId = `TKT-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO tickets (id, customer_id, title, description, type, status) VALUES (?, ?, ?, ?, ?, 'Open')")
    .run(tktId, customerId || null, title, description, type);
  io.emit('erp-data-changed');
  res.json({ success: true, tktId });
});

app.get('/api/teams/daily', authenticateToken, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(db.prepare("SELECT * FROM daily_teams WHERE created_date = ?").all(today));
});

app.post('/api/teams/daily', authenticateToken, (req, res) => {
  const { leaderId, members } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  const teamId = `TEAM-${Date.now().toString().slice(-4)}`;
  db.prepare("INSERT INTO daily_teams (id, leader_id, member_ids, created_date) VALUES (?, ?, ?, ?)")
    .run(teamId, leaderId, JSON.stringify(members), today);
  io.emit('erp-data-changed');
  res.json({ success: true, teamId });
});

app.get('/api/work-orders', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM work_orders ORDER BY created_at DESC").all());
});

app.post('/api/work-orders', authenticateToken, (req, res) => {
  const { ticketId, deploymentId, teamId, objective, assignedMaterials } = req.body;
  const woId = `WO-${Date.now().toString().slice(-4)}`;
  
  const transaction = db.transaction(() => {
    db.prepare("INSERT INTO work_orders (id, ticket_id, deployment_id, team_id, objective, assigned_materials, status) VALUES (?, ?, ?, ?, ?, ?, 'Assigned')")
      .run(woId, ticketId || null, deploymentId || null, teamId, objective, JSON.stringify(assignedMaterials || []));
      
    if (ticketId) db.prepare("UPDATE tickets SET status = 'In Progress' WHERE id = ?").run(ticketId);
    if (deploymentId) db.prepare("UPDATE deployments SET status = 'In Progress' WHERE id = ?").run(deploymentId);
    
    // Deduct warehouse material levels immediately on allocation
    if (assignedMaterials && assignedMaterials.length > 0) {
      const updateInventory = db.prepare("UPDATE inventory SET qty = qty - ? WHERE id = ?");
      for (const material of assignedMaterials) {
        updateInventory.run(parseInt(material.qty), material.id);
      }
    }
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true, woId });
});

app.post('/api/work-orders/:id/complete', authenticateToken, (req, res) => {
  const woId = req.params.id;
  const { leftovers } = req.body; // Expects layout array: [{id: 'INV-001', qty: 2}]
  const transaction = db.transaction(() => {
    db.prepare("UPDATE work_orders SET status = 'Completed', leftover_materials = ? WHERE id = ?")
      .run(JSON.stringify(leftovers || []), woId);
    
    const wo = db.prepare("SELECT ticket_id, deployment_id FROM work_orders WHERE id = ?").get(woId);
    if (wo.ticket_id) db.prepare("UPDATE tickets SET status = 'Resolved' WHERE id = ?").run(wo.ticket_id);
    
    if (leftovers && leftovers.length > 0) {
      const returnInventory = db.prepare("UPDATE inventory SET qty = qty + ? WHERE id = ?");
      for (const item of leftovers) {
        returnInventory.run(parseInt(item.qty), item.id);
      }
    }
  });
  transaction();
  io.emit('erp-data-changed');
  res.json({ success: true });
});

// --- 7. INVENTORY SYSTEM ---
app.get('/api/inventory', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM inventory ORDER BY id ASC").all());
});

app.post('/api/inventory', authenticateToken, verifyRoles(['Accounting', 'Management']), (req, res) => {
  const { name, qty, costPerUnit } = req.body;
  const transaction = db.transaction(() => {
    const invId = generateNextCustomId('inventory', 'INV');
    db.prepare("INSERT INTO inventory (id, item_name, qty, cost_per_unit) VALUES (?, ?, ?, ?)")
      .run(invId, name, qty, costPerUnit);
      
    const totalCost = qty * costPerUnit;
    db.prepare("INSERT INTO accounting_ledger (type, amount, category, reference_id) VALUES ('Expense', ?, 'Inventory Restock', ?)")
      .run(totalCost, invId);
    return invId;
  });
  const newId = transaction();
  io.emit('erp-data-changed');
  res.json({ success: true, id: newId });
});

const APP_PORT = process.env.PORT || 5000;
server.listen(APP_PORT, () => console.log(`Voix ERP Production Kernal Engine online on port ${APP_PORT}`));