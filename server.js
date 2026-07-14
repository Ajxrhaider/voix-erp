import express from 'express';
import cors from 'cors';
import db from './db.js';
import jwt from 'jsonwebtoken';

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://voix-erp.vercel.app', // Your Vercel domain
  process.env.FRONTEND_URL       // Your Render environment variable
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const SECRET_KEY = 'voix-super-secret-erp-key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401); 
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403); 
    req.user = user;
    next();
  });
}

// --- AUTH ---
app.post('/api/register', (req, res) => {
  const { username, password, fullname, role } = req.body;
  try {
    db.prepare("INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)").run(username, password, fullname, role);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: 'Username taken' }); }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (user && user.password === password) {
    res.json({ token: jwt.sign({ username: user.username, role: user.role }, SECRET_KEY) });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- CRM & DEPLOYMENTS ---
app.get('/api/customers', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM customers").all().map(r => ({ ...r, interactionHistory: JSON.parse(r.interactionHistory || '[]') }))));
app.post('/api/customers/interaction', authenticateToken, (req, res) => {
  const { id, interaction } = req.body;
  const customer = db.prepare("SELECT interactionHistory FROM customers WHERE id = ?").get(id);
  const history = JSON.parse(customer.interactionHistory || '[]');
  history.push(interaction);
  db.prepare("UPDATE customers SET interactionHistory = ? WHERE id = ?").run(JSON.stringify(history), id);
  res.json({ success: true });
});

app.get('/api/query-tickets', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM query_tickets ORDER BY ticketNo DESC").all()));
app.post('/api/query-tickets', authenticateToken, (req, res) => {
  const { ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus } = req.body;
  db.prepare("INSERT INTO query_tickets (ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus, resolutionDateTime, mttr, resolutionBy, customerFeedback, closureNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'Pending', '', '', '')").run(ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus);
  res.json({ success: true });
});

app.get('/api/pending-deployments', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM pending_deployments").all()));
app.post('/api/pending-deployments/:id/activate', authenticateToken, (req, res) => {
  const { assignedIpAddress, opticalReading, oltProfile } = req.body;
  db.prepare("UPDATE pending_deployments SET status = 'Active IP Assigned', assignedIpAddress = ?, opticalReading = ?, oltProfile = ? WHERE id = ?").run(assignedIpAddress, opticalReading, oltProfile, req.params.id);
  res.json({ success: true });
});

// --- SALES PIPELINE ---
app.get('/api/survey-tickets', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM survey_tickets").all()));
app.post('/api/survey-tickets', authenticateToken, (req, res) => {
  const { id, customer, location, contactPerson, proposedPlan, marketerName } = req.body;
  db.prepare("INSERT INTO survey_tickets (id, customer, location, contactPerson, proposedPlan, marketerName, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending Survey')").run(id, customer, location, contactPerson, proposedPlan, marketerName);
  res.json({ success: true });
});
app.put('/api/survey-tickets/:id/field-quote', authenticateToken, (req, res) => {
  const { distanceMeters, polesRequired, cableType, technicianNotes, surveyedBy, materialCost, routerCost, installationLabour, totalQuote } = req.body;
  db.prepare("UPDATE survey_tickets SET status = 'Survey Completed (AQ Issued)', distanceMeters = ?, polesRequired = ?, cableType = ?, technicianNotes = ?, surveyedBy = ?, materialCost = ?, routerCost = ?, installationLabour = ?, totalQuote = ? WHERE id = ?").run(distanceMeters, polesRequired, cableType, technicianNotes, surveyedBy, materialCost, routerCost, installationLabour, totalQuote, req.params.id);
  res.json({ success: true });
});
app.put('/api/survey-tickets/:id/invoice', authenticateToken, (req, res) => {
  const { invoiceRef } = req.body;
  db.prepare("UPDATE survey_tickets SET status = 'Invoiced & Paid', invoiceRef = ? WHERE id = ?").run(invoiceRef, req.params.id);
  const survey = db.prepare("SELECT * FROM survey_tickets WHERE id = ?").get(req.params.id);
  db.prepare("INSERT INTO pending_deployments (id, customer, plan, location, amountPaid, paidDate, status) VALUES (?, ?, ?, ?, ?, ?, 'Awaiting Splicing')").run(`DEP-${Date.now().toString().slice(-3)}`, survey.customer, survey.proposedPlan, survey.location, survey.totalQuote, new Date().toISOString().substring(0, 10));
  db.prepare("INSERT INTO installation_tickets (id, type, customer, package, step, createdAt, assignedTeam, costMaterials, costFuel, revenue, monthlySub, notes) VALUES (?, 'installation', ?, ?, 1, ?, 'Unassigned', ?, 8000, ?, 85000, ?)").run(`INST-${Date.now().toString().slice(-4)}`, survey.customer, survey.proposedPlan, new Date().toISOString().substring(0, 10), survey.materialCost, survey.totalQuote, `Survey Ref: ${survey.id}`);
  res.json({ success: true });
});

// --- CTO OPERATIONS & TICKETS ---
app.get('/api/installation-tickets', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM installation_tickets").all()));
app.put('/api/installation-tickets/:id/step', authenticateToken, (req, res) => {
  db.prepare("UPDATE installation_tickets SET step = ?, notes = ? WHERE id = ?").run(req.body.step, req.body.notes, req.params.id);
  res.json({ success: true });
});

app.get('/api/daily-work-plans', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM daily_work_plans").all().map(p => ({ ...p, selectedTickets: JSON.parse(p.selectedTickets || '[]') })));
});
app.post('/api/daily-work-plans', authenticateToken, (req, res) => {
  const { date, objective, selectedTickets, status } = req.body;
  db.prepare("INSERT INTO daily_work_plans (date, objective, selectedTickets, status) VALUES (?, ?, ?, ?)").run(date, objective, JSON.stringify(selectedTickets), status);
  res.json({ success: true });
});

app.get('/api/work-orders', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM work_orders").all().map(wo => ({ ...wo, materialsRequired: JSON.parse(wo.materialsRequired || '[]') })));
});
app.post('/api/work-orders', authenticateToken, (req, res) => {
  const { id, teamId, ticketId, objective, materialsRequired, status } = req.body;
  db.prepare("INSERT INTO work_orders (id, teamId, ticketId, objective, materialsRequired, status) VALUES (?, ?, ?, ?, ?, ?)").run(id, teamId, ticketId, objective, JSON.stringify(materialsRequired), status);
  res.json({ success: true });
});
app.put('/api/work-orders/:id/status', authenticateToken, (req, res) => {
  db.prepare("UPDATE work_orders SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
  res.json({ success: true });
});

// --- INVENTORY DEPLETION ALGORITHM ---
app.get('/api/inventory', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM inventory").all()));
app.post('/api/inventory/checkout', authenticateToken, (req, res) => {
  const { materials } = req.body; // Expects array: [{ item: "Router", qty: 1 }]
  const deduct = db.prepare("UPDATE inventory SET qty = qty - ? WHERE item = ?");
  const transaction = db.transaction((mats) => {
    for (const mat of mats) { deduct.run(mat.qty, mat.item); }
  });
  transaction(materials);
  res.json({ success: true });
});

// --- REQUISITIONS, DAILY REPORTS, HR ---
app.get('/api/requisitions', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM requisitions").all()));
app.post('/api/requisitions', authenticateToken, (req, res) => {
  const { id, dept, item, qty, estCost, reason, status } = req.body;
  db.prepare("INSERT INTO requisitions (id, dept, item, qty, estCost, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, dept, item, qty, estCost, reason, status);
  res.json({ success: true });
});
app.put('/api/requisitions/:id', authenticateToken, (req, res) => {
  db.prepare("UPDATE requisitions SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
  res.json({ success: true });
});

app.get('/api/daily-reports', authenticateToken, (req, res) => res.json(db.prepare("SELECT * FROM daily_reports").all()));
app.post('/api/daily-reports', authenticateToken, (req, res) => {
  const { id, submittedBy, dept, date, summary, highlights } = req.body;
  db.prepare("INSERT INTO daily_reports (id, submittedBy, dept, date, summary, highlights, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending Review')").run(id, submittedBy, dept, date, summary, highlights);
  res.json({ success: true });
});
app.put('/api/daily-reports/:id/review', authenticateToken, (req, res) => {
  db.prepare("UPDATE daily_reports SET status = 'Reviewed' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get('/api/hr/employees', authenticateToken, (req, res) => res.json(db.prepare("SELECT e.*, a.hrScore, a.hodScore, a.gmScore, pa.* FROM employees e LEFT JOIN appraisals a ON e.id = a.employeeId LEFT JOIN payroll_adjustments pa ON e.id = pa.employeeId").all()));
app.put('/api/hr/appraisals/:employeeId', authenticateToken, (req, res) => {
  const { hrScore, hodScore, gmScore } = req.body;
  db.prepare("UPDATE appraisals SET hrScore = ?, hodScore = ?, gmScore = ? WHERE employeeId = ?").run(hrScore, hodScore, gmScore, req.params.employeeId);
  db.prepare("UPDATE employees SET currentScore = ? WHERE id = ?").run(Math.round((hrScore + hodScore + gmScore) / 3), req.params.employeeId);
  res.json({ success: true });
});
app.put('/api/hr/payroll-adjustments/:employeeId', authenticateToken, (req, res) => {
  const fields = ['penalties', 'spoilage', 'lateComing', 'absenteeism', 'damagedProperty', 'salaryAdvance', 'bonuses', 'commissions', 'overtime', 'taxRate', 'healthInsurance', 'rentAdvance'];
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f] || 0);
  values.push(req.params.employeeId);
  db.prepare(`UPDATE payroll_adjustments SET ${sets} WHERE employeeId = ?`).run(...values);
  res.json({ success: true });
});
// --- VEHICLES / FLEET ---
app.get('/api/vehicles', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM vehicles").all());
});
app.post('/api/vehicles', authenticateToken, (req, res) => {
  const { plateNumber, model, fuelLevel, lastMaintenance } = req.body;
  const result = db.prepare("INSERT INTO vehicles (plateNumber, model, fuelLevel, lastMaintenance) VALUES (?, ?, ?, ?)").run(plateNumber, model, fuelLevel, lastMaintenance);
  res.json({ id: result.lastInsertRowid });
});

// --- DAILY FIELD REPORTS ---
app.get('/api/daily-reports', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM daily_reports ORDER BY id DESC").all());
});
app.post('/api/daily-reports', authenticateToken, (req, res) => {
  const { crewId, date, splices, locations, highlights } = req.body;
  const result = db.prepare("INSERT INTO daily_reports (crewId, date, splices, locations, highlights, submittedBy) VALUES (?, ?, ?, ?, ?, ?)").run(crewId, date, splices, locations, highlights, req.user.username);
  res.json({ success: true, id: result.lastInsertRowid });
});

// --- REQUISITIONS ---
app.get('/api/requisitions', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM requisitions ORDER BY id DESC").all());
});
app.post('/api/requisitions', authenticateToken, (req, res) => {
  const { department, item, quantity, estimatedCost } = req.body;
  const result = db.prepare("INSERT INTO requisitions (department, item, quantity, estimatedCost, requestedBy) VALUES (?, ?, ?, ?, ?)").run(department, item, quantity, estimatedCost, req.user.username);
  res.json({ success: true, id: result.lastInsertRowid });
});
app.put('/api/requisitions/:id', authenticateToken, (req, res) => {
  db.prepare("UPDATE requisitions SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
  res.json({ success: true });
});
// Change the listen block to this:
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Update CORS to allow your Vercel deployment dynamically
