import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database(path.join(process.cwd(), 'voix_erp_production.db'), { verbose: console.log });

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

const addColumn = (table, column, definition) => {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      console.log(`Migrated: Added ${column} to ${table}`);
    }
  } catch (err) {}
};

const migrateSpreadsheetColumns = () => {
  addColumn('users', 'roles', "TEXT DEFAULT '[]'");
  
  // Link Requisitions tightly to Field Work Orders
  addColumn('requisitions', 'work_order_id', 'TEXT');

  addColumn('tickets', 'date_received', 'DATE');
  addColumn('tickets', 'time_received', 'TEXT');
  addColumn('tickets', 'customer_ip', 'TEXT');
  addColumn('tickets', 'query_type', 'TEXT');
  addColumn('tickets', 'location', 'TEXT');
  addColumn('tickets', 'service_type', 'TEXT');
  addColumn('tickets', 'whatsapp_sos_sent', 'INTEGER DEFAULT 0');
  addColumn('tickets', 'assigned_to', 'TEXT');
  addColumn('tickets', 'resolution_datetime', 'DATETIME');
  addColumn('tickets', 'mttr', 'TEXT');
  addColumn('tickets', 'resolution_by', 'TEXT');
  addColumn('tickets', 'customer_feedback', 'TEXT');
  addColumn('tickets', 'closure_notes', 'TEXT');
  addColumn('tickets', 'ticket_closed_by', 'TEXT');

  addColumn('deployments', 'date_of_payment', 'DATE');
  addColumn('deployments', 'priority', 'TEXT');
  addColumn('deployments', 'start_date', 'DATE');
  addColumn('deployments', 'end_date', 'DATE');
  addColumn('deployments', 'sales_made_by', 'TEXT');
  addColumn('deployments', 'notes', 'TEXT');

  addColumn('customers', 'payment_schedule', 'TEXT');
  addColumn('customers', 'amount_payable', 'REAL DEFAULT 0.0');
  addColumn('customers', 'amount_paid', 'REAL DEFAULT 0.0');
  addColumn('customers', 'bank_received', 'TEXT');
  addColumn('customers', 'last_payment_date', 'DATE');
  addColumn('customers', 'next_due_date', 'DATE');
  addColumn('customers', 'outstanding_balance', 'REAL DEFAULT 0.0');

  addColumn('accounting_ledger', 'approved_by', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_care_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      fullname TEXT,
      report_date DATE NOT NULL,
      channels_json TEXT DEFAULT '{}',
      interaction_log TEXT DEFAULT '[]',
      ticketing_json TEXT DEFAULT '{}',
      financial_json TEXT DEFAULT '{}',
      social_json TEXT DEFAULT '{}',
      summary_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

migrateSpreadsheetColumns();

db.exec(`
  CREATE TABLE IF NOT EXISTS id_sequences (seq_name TEXT PRIMARY KEY, next_val INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, fullname TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, roles TEXT DEFAULT '[]', department TEXT DEFAULT 'General', is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, voix_no TEXT UNIQUE, name TEXT NOT NULL, customer_type TEXT DEFAULT 'FTTH', email TEXT, phone TEXT, address TEXT, mac_address TEXT, service_plan TEXT, ip_address TEXT DEFAULT 'Unassigned', balance REAL DEFAULT 0.0, status TEXT DEFAULT 'Active', payment_schedule TEXT, amount_payable REAL DEFAULT 0.0, amount_paid REAL DEFAULT 0.0, bank_received TEXT, last_payment_date DATE, next_due_date DATE, outstanding_balance REAL DEFAULT 0.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS sales_pipeline (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, contact_email TEXT, contact_phone TEXT, location TEXT NOT NULL, survey_details TEXT, proposed_plan TEXT NOT NULL, amount REAL NOT NULL, stage TEXT CHECK(stage IN ('Lead', 'Qualification', 'Proposal', 'Negotiation', 'Closing/Won', 'Lost')) DEFAULT 'Lead', sales_rep_id TEXT REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS deployments (id TEXT PRIMARY KEY, sale_id TEXT REFERENCES sales_pipeline(id), customer_name TEXT NOT NULL, customer_type TEXT DEFAULT 'FTTH', phone TEXT, location TEXT NOT NULL, plan TEXT NOT NULL, amount REAL DEFAULT 0.0, status TEXT DEFAULT 'Awaiting Splicing', fat_box TEXT, splitter_port TEXT, onu_mac TEXT, assigned_ip TEXT, date_of_payment DATE, priority TEXT, start_date DATE, end_date DATE, sales_made_by TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS accounting_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_date DATE NOT NULL, inv_no TEXT UNIQUE, customer_name TEXT, customer_type TEXT DEFAULT 'FTTH', type TEXT CHECK(type IN ('Income', 'Expense')) NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, gross_amount REAL NOT NULL, is_vat_exempt INTEGER DEFAULT 0, vat_rate REAL DEFAULT 7.5, vat_amount REAL DEFAULT 0.0, net_amount REAL NOT NULL, payment_mode TEXT DEFAULT 'Bank Transfer', duration_months INTEGER DEFAULT 1, next_due_date TEXT, received_by TEXT, approved_by TEXT, reference_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS requisitions (id TEXT PRIMARY KEY, type TEXT CHECK(type IN ('Cash', 'Materials')) NOT NULL, requested_by TEXT REFERENCES users(id), department TEXT, purpose TEXT, amount REAL DEFAULT 0.0, materials_list TEXT DEFAULT '[]', approval_stage TEXT DEFAULT 'Pending Accounting', work_order_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), customer_name TEXT NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, priority TEXT DEFAULT 'Medium', status TEXT DEFAULT 'Open', date_received DATE, time_received TEXT, customer_ip TEXT, query_type TEXT, location TEXT, service_type TEXT, whatsapp_sos_sent INTEGER DEFAULT 0, assigned_to TEXT, resolution_datetime DATETIME, mttr TEXT, resolution_by TEXT, customer_feedback TEXT, closure_notes TEXT, ticket_closed_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS daily_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, leader_id TEXT REFERENCES users(id), member_ids TEXT, assigned_vehicle TEXT, created_date DATE NOT NULL, is_active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS work_orders (id TEXT PRIMARY KEY, ticket_id TEXT REFERENCES tickets(id), deployment_id TEXT REFERENCES deployments(id), team_id TEXT REFERENCES daily_teams(id), objective TEXT NOT NULL, location TEXT NOT NULL, assigned_materials TEXT DEFAULT '[]', leftover_materials TEXT DEFAULT '[]', status TEXT DEFAULT 'Assigned', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS fiber_splicing_reports (id TEXT PRIMARY KEY, work_order_id TEXT REFERENCES work_orders(id), report_date DATE NOT NULL, team_lead TEXT NOT NULL, vehicle_route TEXT NOT NULL, time_arrived TEXT NOT NULL, ticket_no TEXT, splicer_name TEXT NOT NULL, closure_location_gps TEXT NOT NULL, failure_point_desc TEXT NOT NULL, manipulations_made TEXT NOT NULL, route_segment TEXT NOT NULL, otdr_distance_meters REAL NOT NULL, leftover_materials TEXT DEFAULT '[]', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, item_name TEXT NOT NULL, category TEXT NOT NULL, qty INTEGER DEFAULT 0, unit_cost REAL NOT NULL, min_alert_qty INTEGER DEFAULT 5, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id), title TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'System', is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

export function generateId(seqName, prefix) {
  const stmt = db.prepare(`UPDATE id_sequences SET next_val = next_val + 1 WHERE seq_name = ? RETURNING next_val`);
  return `${prefix}-${stmt.get(seqName).next_val}`;
}

const initializeSequences = db.transaction(() => {
  const tables = ['staff', 'customer', 'sale', 'deployment', 'ticket', 'work_order', 'team', 'inventory', 'requisition', 'report', 'cc_report'];
  const insertStmt = db.prepare("INSERT OR IGNORE INTO id_sequences (seq_name, next_val) VALUES (?, 100)");
  tables.forEach(t => insertStmt.run(t));
});
initializeSequences();

const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (id, username, password, roles, fullname, email) VALUES (?, ?, ?, ?, ?, ?)")
    .run('EMP-000', 'admin', hash, JSON.stringify(['Management', 'Dev', 'Admin']), 'System Administrator', 'admin@voixnetworks.ng');
}

export default db;