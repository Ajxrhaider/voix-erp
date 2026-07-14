import Database from 'better-sqlite3';
const db = new Database('voix_erp.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, fullname TEXT, role TEXT);
  CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT, ipAddress TEXT, plan TEXT, status TEXT);
  CREATE TABLE IF NOT EXISTS query_tickets (ticketNo TEXT PRIMARY KEY, dateReceived TEXT, timeReceived TEXT, customerIp TEXT, customerName TEXT, queryType TEXT, location TEXT, serviceType TEXT, issueDescription TEXT, ticketOpenedBy TEXT, whatsappSosSent TEXT, assignedTo TEXT, queryStatus TEXT, resolutionDateTime TEXT, mttr TEXT, resolutionBy TEXT, customerFeedback TEXT, closureNotes TEXT);
  CREATE TABLE IF NOT EXISTS pending_deployments (id TEXT PRIMARY KEY, customer TEXT, plan TEXT, location TEXT, amountPaid REAL, paidDate TEXT, status TEXT, assignedIpAddress TEXT, opticalReading TEXT, oltProfile TEXT);
  CREATE TABLE IF NOT EXISTS survey_tickets (id TEXT PRIMARY KEY, customer TEXT, location TEXT, contactPerson TEXT, proposedPlan TEXT, marketerName TEXT, status TEXT, distanceMeters INTEGER, polesRequired INTEGER, cableType TEXT, technicianNotes TEXT, surveyedBy TEXT, materialCost REAL, routerCost REAL, installationLabour REAL, totalQuote REAL, invoiceRef TEXT);
  CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT, role TEXT, dept TEXT, baseSalary REAL, currentScore INTEGER, salesComm REAL);
  CREATE TABLE IF NOT EXISTS appraisals (employeeId TEXT PRIMARY KEY, hrScore INTEGER, hodScore INTEGER, gmScore INTEGER);
  CREATE TABLE IF NOT EXISTS payroll_adjustments (employeeId TEXT PRIMARY KEY, penalties INTEGER, spoilage INTEGER, lateComing INTEGER, absenteeism INTEGER, damagedProperty INTEGER, salaryAdvance INTEGER, bonuses INTEGER, commissions INTEGER, overtime INTEGER, taxRate REAL, healthInsurance INTEGER, rentAdvance INTEGER);
  CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, name TEXT, quantity INTEGER, location TEXT, unit TEXT, cost REAL);
  CREATE TABLE IF NOT EXISTS requisitions (id INTEGER PRIMARY KEY AUTOINCREMENT, department TEXT, item TEXT, quantity INTEGER, estimatedCost REAL, status TEXT DEFAULT 'Pending', requestedBy TEXT);
  CREATE TABLE IF NOT EXISTS work_orders (id INTEGER PRIMARY KEY, customerId TEXT, task TEXT, status TEXT);
  CREATE TABLE IF NOT EXISTS installation_tickets (id TEXT PRIMARY KEY, type TEXT, customer TEXT, package TEXT, step INTEGER, createdAt TEXT, assignedTeam TEXT, costMaterials REAL, costFuel REAL, revenue REAL, monthlySub REAL, notes TEXT);
  CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, plateNumber TEXT, model TEXT, status TEXT DEFAULT 'Available', fuelLevel INTEGER, lastMaintenance TEXT);
  CREATE TABLE IF NOT EXISTS daily_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, crewId TEXT, date TEXT, splices INTEGER, locations TEXT, highlights TEXT, submittedBy TEXT, summary TEXT, dept TEXT);
  CREATE TABLE IF NOT EXISTS daily_work_plans (date TEXT PRIMARY KEY, objective TEXT, selectedTickets TEXT, status TEXT);
`);

// Seed Initial Data (Only runs if empty)
const empCount = db.prepare("SELECT count(*) as count FROM employees").get();
if (empCount.count === 0) {
  const insertEmp = db.prepare("INSERT INTO employees (id, name, role, dept, baseSalary, currentScore, salesComm) VALUES (?, ?, 'employee', ?, ?, ?, ?)");
  const insertAppraisal = db.prepare("INSERT INTO appraisals (employeeId, hrScore, hodScore, gmScore) VALUES (?, ?, ?, ?)");
  const insertAdj = db.prepare("INSERT INTO payroll_adjustments (employeeId, penalties, spoilage, lateComing, absenteeism, damagedProperty, salaryAdvance, bonuses, commissions, overtime, taxRate, healthInsurance, rentAdvance) VALUES (?, 0, 0, 0, 0, 0, 0, 15000, 0, 12000, 10, 5000, 0)");
  const insertInv = db.prepare("INSERT INTO inventory (id, name, quantity, unit, cost, location) VALUES (?, ?, ?, ?, ?, 'Warehouse')");

  const seedData = [
    { id: "EMP-001", name: "Obi Nwosu", dept: "Fiber Squad A", baseSalary: 180000, currentScore: 82, salesComm: 0, hr: 80, hod: 85, gm: 82 },
    { id: "EMP-002", name: "Chidi Okafor", dept: "Fiber Squad A", baseSalary: 185000, currentScore: 78, salesComm: 0, hr: 75, hod: 80, gm: 78 },
    { id: "EMP-004", name: "Adebayo Alao", dept: "NOC Desk", baseSalary: 220000, currentScore: 90, salesComm: 0, hr: 90, hod: 92, gm: 88 }
  ];

  for (const emp of seedData) {
    insertEmp.run(emp.id, emp.name, emp.dept, emp.baseSalary, emp.currentScore, emp.salesComm);
    insertAppraisal.run(emp.id, emp.hr, emp.hod, emp.gm);
    insertAdj.run(emp.id);
  }
  
  insertInv.run("INV-001", "GPON ONT Router (Wi-Fi 6)", 45, "pcs", 18000);
  insertInv.run("INV-002", "Fiber Drop Cable (4-Core, 1km Drum)", 8, "drums", 75000);
  insertInv.run("INV-003", "Optical Splicing Sleeves (Pack of 100)", 15, "packs", 3000);
}

export default db;