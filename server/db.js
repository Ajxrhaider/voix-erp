import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database(path.join(process.cwd(), 'voix_erp_production.db'), { verbose: console.log });

// Enable Write-Ahead Logging for concurrency and set timeout
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Schema Definition aligned 1:1 with server.js queries
db.exec(`
  -- 1. ID Sequences for custom generators
  CREATE TABLE IF NOT EXISTS id_sequences (
    seq_name TEXT PRIMARY KEY,
    next_val INTEGER NOT NULL
  );

  -- 2. Staff / Users Management
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- e.g., EMP-000
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    fullname TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. Customer CRM Desk
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, -- e.g., CUST-xxxx
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    location TEXT,
    plan TEXT,
    ip_address TEXT DEFAULT 'Unassigned',
    status TEXT DEFAULT 'Active',
    balance REAL DEFAULT 0.0,
    history TEXT DEFAULT '[]', -- Stored as JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 4. Sales Pipeline Engine
  CREATE TABLE IF NOT EXISTS sales_pipeline (
    id TEXT PRIMARY KEY, -- e.g., SALE-xxxx
    customer_name TEXT NOT NULL,
    location TEXT,
    contact TEXT,
    proposed_plan TEXT,
    stage TEXT DEFAULT 'Lead',
    amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 5. Deployments Layer
  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY, -- e.g., DEP-xxxx
    sale_id TEXT REFERENCES sales_pipeline(id),
    customer_name TEXT,
    location TEXT,
    plan TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'Awaiting Splicing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 6. Accounting Ledger
  CREATE TABLE IF NOT EXISTS accounting_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('Income', 'Expense')),
    amount REAL NOT NULL,
    category TEXT,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 7. Requisitions Portal
  CREATE TABLE IF NOT EXISTS requisitions (
    id TEXT PRIMARY KEY, -- e.g., REQ-xxxx
    type TEXT,
    requested_by TEXT REFERENCES users(id),
    department TEXT,
    purpose TEXT,
    amount REAL DEFAULT 0,
    materials_list TEXT, -- Stored as JSON array
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 8. Tickets & Technical Work Orders
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY, -- e.g., TKT-xxxx
    customer_id TEXT REFERENCES customers(id),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_teams (
    id TEXT PRIMARY KEY, -- e.g., TEAM-xxxx
    leader_id TEXT REFERENCES users(id),
    member_ids TEXT, -- Stored as JSON array
    created_date DATE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY, -- e.g., WO-xxxx
    ticket_id TEXT REFERENCES tickets(id),
    deployment_id TEXT REFERENCES deployments(id),
    team_id TEXT REFERENCES daily_teams(id),
    objective TEXT,
    assigned_materials TEXT, -- Stored as JSON array
    leftover_materials TEXT, -- Stored as JSON array
    status TEXT DEFAULT 'Assigned',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 9. Inventory System
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY, -- e.g., INV-001
    item_name TEXT NOT NULL,
    qty INTEGER DEFAULT 0,
    cost_per_unit REAL NOT NULL
  );
`);

// Initialize default sequences if they don't exist
const initializeSequences = db.transaction(() => {
  const checkSeq = db.prepare("SELECT COUNT(*) as count FROM id_sequences WHERE seq_name = ?");
  
  if (checkSeq.get('staff').count === 0) {
    db.prepare("INSERT INTO id_sequences (seq_name, next_val) VALUES ('staff', 1)").run();
  }
  if (checkSeq.get('inventory').count === 0) {
    db.prepare("INSERT INTO id_sequences (seq_name, next_val) VALUES ('inventory', 1)").run();
  }
});
initializeSequences();

// Seed Default Admin Account if users table is empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (id, username, password, role, fullname) VALUES (?, ?, ?, ?, ?)")
    .run('EMP-000', 'admin', hashedPassword, 'Management', 'System Administrator');
  console.log('Database seeded: Default admin account created (Username: admin, Password: admin123).');
}

export default db;