import express from 'express';
import cors from 'cors';
import db from './db.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());

app.use(express.json());

const SECRET_KEY = 'voix-super-secret-erp-key';

// --- MIDDLEWARE ---
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

// --- AUTHENTICATION ---
app.post('/api/register', (req, res) => {
  const { username, password, fullname, role } = req.body;
  try {
    db.prepare("INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)").run(username, password, fullname, role);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username taken or invalid data' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (user && user.password === password) {
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- CUSTOMER & CRM ---
app.get('/api/customers', authenticateToken, (req, res) => {
  const rows = db.prepare("SELECT * FROM customers").all();
  res.json(rows.map(r => ({ ...r, interactionHistory: JSON.parse(r.interactionHistory || '[]') })));
});

app.post('/api/customers/interaction', authenticateToken, (req, res) => {
  const { id, interaction } = req.body;
  const customer = db.prepare("SELECT interactionHistory FROM customers WHERE id = ?").get(id);
  
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const history = JSON.parse(customer.interactionHistory || '[]');
  history.push(interaction);

  db.prepare("UPDATE customers SET interactionHistory = ? WHERE id = ?")
    .run(JSON.stringify(history), id);
  
  res.json({ success: true });
});

// --- INVENTORY ---
app.get('/api/inventory', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM inventory").all());
});

app.post('/api/inventory', authenticateToken, (req, res) => {
  const { id, item, qty, unit, cost } = req.body;
  db.prepare("INSERT INTO inventory (id, item, qty, unit, cost) VALUES (?, ?, ?, ?, ?)").run(id, item, qty, unit, cost);
  res.json({ success: true });
});

// --- WORK ORDERS ---
app.get('/api/work-orders', authenticateToken, (req, res) => {
  const rows = db.prepare("SELECT * FROM work_orders").all();
  res.json(rows);
});

app.post('/api/work-orders', authenticateToken, (req, res) => {
  const { id, teamId, objective, status } = req.body;
  db.prepare("INSERT INTO work_orders (id, teamId, objective, status) VALUES (?, ?, ?, ?)")
    .run(id, teamId, objective, status);
  res.json({ success: true });
});

// --- REQUISITIONS ---
app.get('/api/requisitions', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM requisitions").all());
});

app.post('/api/requisitions', authenticateToken, (req, res) => {
  const { id, dept, item, qty, estCost, reason, status } = req.body;
  db.prepare("INSERT INTO requisitions (id, dept, item, qty, estCost, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, dept, item, qty, estCost, reason, status);
  res.json({ success: true });
});

// ADDED: Route to update requisition status
app.put('/api/requisitions/:id', authenticateToken, (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE requisitions SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ success: true });
});

// --- EMPLOYEES ---
app.get('/api/employees', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM employees").all());
});

app.post('/api/employees', authenticateToken, (req, res) => {
  const { id, name, dept, baseSalary } = req.body;
  db.prepare("INSERT INTO employees (id, name, dept, baseSalary) VALUES (?, ?, ?, ?)").run(id, name, dept, baseSalary);
  res.json({ success: true });
});

// server.js - Append these routes alongside existing routes
// Ensure authenticateToken middleware is used to safeguard endpoints

// --- UNIFIED QUERY TICKETS ENDPOINTS ---
app.get('/api/query-tickets', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM query_tickets ORDER BY ticketNo DESC").all());
});

app.post('/api/query-tickets', authenticateToken, (req, res) => {
  const { ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus } = req.body;
  db.prepare(`
    INSERT INTO query_tickets (ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus, resolutionDateTime, mttr, resolutionBy, customerFeedback, closureNotes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'Pending', '', '', '')
  `).run(ticketNo, dateReceived, timeReceived, customerIp, customerName, queryType, location, serviceType, issueDescription, ticketOpenedBy, whatsappSosSent, assignedTo, queryStatus);
  res.json({ success: true });
});

app.put('/api/query-tickets/:ticketNo/resolve', authenticateToken, (req, res) => {
  const { ticketNo } = req.params;
  const { closureNotes, resolutionBy, mttr } = req.body;
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
  db.prepare(`
    UPDATE query_tickets 
    SET queryStatus = 'Resolved', resolutionDateTime = ?, closureNotes = ?, resolutionBy = ?, mttr = ?
    WHERE ticketNo = ?
  `).run(nowStr, closureNotes, resolutionBy, mttr, ticketNo);
  res.json({ success: true });
});

// --- PENDING DEPLOYMENTS ENDPOINTS ---
app.get('/api/pending-deployments', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM pending_deployments").all());
});

app.post('/api/pending-deployments/:id/activate', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { assignedIpAddress, opticalReading, oltProfile } = req.body;
  
  db.prepare(`
    UPDATE pending_deployments 
    SET status = 'Active IP Assigned', assignedIpAddress = ?, opticalReading = ?, oltProfile = ?
    WHERE id = ?
  `).run(assignedIpAddress, opticalReading, oltProfile, id);
  
  res.json({ success: true });
});

// --- SURVEY & PRE-SALES PIPELINE ENDPOINTS ---
app.get('/api/survey-tickets', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM survey_tickets").all());
});

app.post('/api/survey-tickets', authenticateToken, (req, res) => {
  const { id, customer, location, contactPerson, proposedPlan, marketerName } = req.body;
  db.prepare(`
    INSERT INTO survey_tickets (id, customer, location, contactPerson, proposedPlan, marketerName, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Pending Survey')
  `).run(id, customer, location, contactPerson, proposedPlan, marketerName);
  res.json({ success: true });
});

app.put('/api/survey-tickets/:id/field-quote', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { distanceMeters, polesRequired, cableType, technicianNotes, surveyedBy, materialCost, routerCost, installationLabour, totalQuote } = req.body;
  db.prepare(`
    UPDATE survey_tickets 
    SET status = 'Survey Completed (AQ Issued)', distanceMeters = ?, polesRequired = ?, cableType = ?, technicianNotes = ?, surveyedBy = ?, materialCost = ?, routerCost = ?, installationLabour = ?, totalQuote = ?
    WHERE id = ?
  `).run(distanceMeters, polesRequired, cableType, technicianNotes, surveyedBy, materialCost, routerCost, installationLabour, totalQuote, id);
  res.json({ success: true });
});

app.put('/api/survey-tickets/:id/invoice', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { invoiceRef } = req.body;
  db.prepare("UPDATE survey_tickets SET status = 'Invoiced & Paid', invoiceRef = ? WHERE id = ?").run(invoiceRef, id);
  
  // Simultaneously move customer to pending physical deployments pipeline
  const survey = db.prepare("SELECT * FROM survey_tickets WHERE id = ?").get(id);
  db.prepare(`
    INSERT INTO pending_deployments (id, customer, plan, location, amountPaid, paidDate, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Awaiting Splicing')
  `).run(`DEP-${Date.now().toString().slice(-3)}`, survey.customer, survey.proposedPlan, survey.location, survey.totalQuote, new Date().toISOString().substring(0, 10));
  
  res.json({ success: true });
});

// --- DAILY CREW REPORTS ENDPOINTS ---
app.get('/api/daily-reports', authenticateToken, (req, res) => {
  res.json(db.prepare("SELECT * FROM daily_reports").all());
});

app.post('/api/daily-reports', authenticateToken, (req, res) => {
  const { id, submittedBy, dept, date, summary, highlights } = req.body;
  db.prepare("INSERT INTO daily_reports (id, submittedBy, dept, date, summary, highlights, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending Review')")
    .run(id, submittedBy, dept, date, summary, highlights);
  res.json({ success: true });
});

app.put('/api/daily-reports/:id/review', authenticateToken, (req, res) => {
  db.prepare("UPDATE daily_reports SET status = 'Reviewed' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- HR & PERFORMANCE METRICS ENDPOINTS ---
app.get('/api/hr/employees', authenticateToken, (req, res) => {
  res.json(db.prepare(`
    SELECT e.*, a.hrScore, a.hodScore, a.gmScore, pa.* FROM employees e
    LEFT JOIN appraisals a ON e.id = a.employeeId
    LEFT JOIN payroll_adjustments pa ON e.id = pa.employeeId
  `).all());
});

app.put('/api/hr/appraisals/:employeeId', authenticateToken, (req, res) => {
  const { employeeId } = req.params;
  const { hrScore, hodScore, gmScore } = req.body;
  db.prepare("UPDATE appraisals SET hrScore = ?, hodScore = ?, gmScore = ? WHERE employeeId = ?")
    .run(hrScore, hodScore, gmScore, employeeId);
  
  // Calculate average for Employee scorecard record
  const avg = Math.round((hrScore + hodScore + gmScore) / 3);
  db.prepare("UPDATE employees SET currentScore = ? WHERE id = ?").run(avg, employeeId);
  res.json({ success: true });
});

app.put('/api/hr/payroll-adjustments/:employeeId', authenticateToken, (req, res) => {
  const { employeeId } = req.params;
  const fields = ['penalties', 'spoilage', 'lateComing', 'absenteeism', 'damagedProperty', 'salaryAdvance', 'bonuses', 'commissions', 'overtime', 'taxRate', 'healthInsurance', 'rentAdvance'];
  
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f] || 0);
  values.push(employeeId);

  db.prepare(`UPDATE payroll_adjustments SET ${sets} WHERE employeeId = ?`).run(...values);
  res.json({ success: true });
});

app.listen(5000, () => console.log('Server running on port 5000'));