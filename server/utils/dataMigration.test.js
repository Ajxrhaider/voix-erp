import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'voix-legacy-migration-'));
process.env.DB_PATH = path.join(tempDirectory, 'migration-test.db');
process.env.NODE_ENV = 'test';

const { default: db } = await import('../db.js');
const { importLegacyFiles, readMigrationFile } = await import('./dataMigration.js');

after(() => {
  db.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

function workbookFile(originalname, rows, sheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return { originalname, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) };
}

function csvFile(originalname, rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return { originalname, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'csv' }) };
}

function htmlIncomeFile(grossAmount = 10750) {
  const record = `{
    date: "1/12/2025", invNo: "HTML-INV-001", customerName: "Amina Test",
    customerType: "Enterprise", category: "Monthly Bandwidth Subscription",
    description: "HTML day-book subscription", grossAmount: ${grossAmount},
    isVatExempt: false, vatRate: 7.5, vatAmount: 750, netAmount: 10000,
    paymentMode: "Cash", durationMonths: 1, nextDueDate: "2/12/2025", receivedBy: "Ada"
  }`;
  return {
    originalname: 'IncomeDayBook.html',
    buffer: Buffer.from(`<script>const INITIAL_INCOME_RECORDS = [${record}];</script>`, 'utf8')
  };
}

function legacyFiles({
  monthlyPayment = 9000,
  incomeGross = 10750,
  expenseAmount = 5000,
  unvoucheredExpenseAmount = 2000,
  queryStatus = 'Closed',
  sparseIssue = 'Old ticket description',
  deploymentStatus = 'In Progress',
  oldDeploymentStatus = 'Awaiting Splicing',
  includeInvalidExpense = true
} = {}) {
  const profileRows = [
    ['Name', 'VoixNumber', 'MAC', 'ServiceType', 'Payment Schedule', 'Amount Payable', 'Last Payment Date', 'Next Due Date', 'January 2025'],
    ['Amina Test', 'VN-C-001', 'AA:BB:CC:DD', 'Enterprise', 'Monthly', 12000, '31/12/2024', '15/01/2025', monthlyPayment]
  ];
  const expenseRows = [
    ['Date', 'Particulars', 'Amount', 'Voucher No', 'Category', 'Approved By'],
    ['1/10/2025', 'Field transport', expenseAmount, 'VCH-001', 'Field Maintenance', 'Musa'],
    ['1/11/2025', 'Unvouchered utility expense', unvoucheredExpenseAmount, '', 'Utilities', 'Musa'],
    ...(includeInvalidExpense ? [['31/02/2025', 'Invalid date entry', 100, 'VCH-INVALID', 'Other Expenses', 'Musa']] : [])
  ];

  return [
    workbookFile('Profiles.xlsx', profileRows),
    csvFile('Clients.csv', [['ClientName', 'Plan'], ['Sample Client', '25 Mbps']]),
    workbookFile('Income.xlsx', [
      ['Date', 'Invoice No', 'Customer Name', 'Customer Type', 'Category', 'Description', 'Gross Amount', 'VAT Exempt', 'VAT Rate', 'VAT Amount', 'Net Amount', 'Payment Mode', 'Duration Months', 'Next Due Date', 'Received By'],
      ['1/9/2025', 'INC-001', 'Amina Test', 'Enterprise', 'Monthly Bandwidth Subscription', 'Legacy income record', incomeGross, 'No', 7.5, 750, incomeGross - 750, 'Bank Transfer', 1, '2/9/2025', 'Ada']
    ]),
    htmlIncomeFile(),
    workbookFile('Deployment.xlsx', [
      ['VND', 'Customer', 'Location', 'Status', 'Service Type', 'Amount Paid', 'Date of Payment', 'Payment Method', 'Email'],
      ['VND-001', 'Amina Test', 'Ikoyi Road', deploymentStatus, 'Dedicated Internet', 50000, '1/10/2025', 'Cash', 'amina@example.test']
    ]),
    workbookFile('OldDeployment.xlsx', [
      ['Customer', 'Location', 'Status'],
      ['Sample Client', 'Lekki', oldDeploymentStatus]
    ]),
    workbookFile('Queries.xlsx', [
      ['VNQ', 'Date Received', 'Issue', 'Status', 'Customer Name', 'Customer IP', 'Resolution Date Time', 'Resolution By'],
      ['VNQ-001', '1/8/2025', 'Fiber outage', queryStatus, 'Amina Test', '10.0.0.1', '1/8/2025 11:20 AM', 'NOC']
    ]),
    workbookFile('OldQueries.xlsx', [
      ['Issue', 'Status'],
      [sparseIssue, 'Open']
    ]),
    workbookFile('ExpenseDayBook.xlsx', expenseRows)
  ];
}

test('imports the supported legacy account, payment, income, expense, query and deployment formats repeatably', () => {
  const files = legacyFiles();

  const profiles = readMigrationFile(files[0]);
  assert.equal(profiles[0]?.kind, 'customers', 'recognizes the legacy Name / VoixNumber profile layout');
  assert.equal(readMigrationFile(files[1])[0]?.kind, 'customers', 'recognizes a client list with ClientName and Plan');
  assert.equal(readMigrationFile(files[3])[0]?.kind, 'income', 'recognizes the embedded HTML income export');
  assert.equal(readMigrationFile(files[4])[0]?.kind, 'deployments', 'recognizes a VND deployment export');
  assert.equal(readMigrationFile(files[5])[0]?.kind, 'deployments', 'recognizes the older Customer / Location / Status layout');
  assert.equal(readMigrationFile(files[6])[0]?.kind, 'queries', 'recognizes a VNQ query export');
  assert.equal(readMigrationFile(files[7])[0]?.kind, 'queries', 'recognizes the older Issue / Status query layout');
  assert.equal(readMigrationFile(files[8])[0]?.kind, 'daybook', 'recognizes an expense day book with an Amount column');

  const firstImport = importLegacyFiles(files);
  assert.ok(firstImport.summaries.every((summary) => summary.type !== 'Import error'), JSON.stringify(firstImport.summaries));

  const amina = db.prepare('SELECT * FROM customers WHERE voix_no = ?').get('VN-C-001');
  const sample = db.prepare('SELECT * FROM customers WHERE name = ?').get('Sample Client');
  assert.ok(amina);
  assert.equal(amina.customer_type, 'Enterprise');
  assert.equal(amina.last_payment_date, '2025-01-10');
  assert.equal(amina.next_due_date, '2025-01-15');
  assert.equal(amina.service_plan, 'Enterprise');
  assert.equal(amina.email, 'amina@example.test');
  assert.equal(sample.service_plan, '25 Mbps');

  const monthlyHistory = db.prepare("SELECT * FROM accounting_ledger WHERE inv_no LIKE 'MIG-%-202501'").get();
  assert.equal(monthlyHistory?.gross_amount, 9000);
  assert.equal(monthlyHistory?.customer_id, amina.id);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger WHERE inv_no = 'INC-001'").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger WHERE inv_no = 'HTML-INV-001'").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger WHERE inv_no = 'MIG-DAYBOOK-VCH-001'").get().count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger WHERE type = 'Expense'").get().count, 2);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger WHERE category = 'Installation & Setup Fee'").get().count, 1);
  assert.equal(db.prepare('SELECT count(*) AS count FROM deployments').get().count, 2);
  assert.equal(db.prepare("SELECT customer_id FROM deployments WHERE external_ref = 'VND-001'").get().customer_id, amina.id);
  assert.equal(db.prepare("SELECT customer_type FROM deployments WHERE external_ref = 'VND-001'").get().customer_type, 'Enterprise');
  const deploymentPayment = db.prepare(`
    SELECT * FROM accounting_ledger
    WHERE type = 'Income' AND category = 'Installation & Setup Fee'
      AND reference_id = (SELECT id FROM deployments WHERE external_ref = 'VND-001')
  `).get();
  assert.equal(deploymentPayment?.gross_amount, 50000);
  assert.equal(deploymentPayment?.payment_mode, 'Cash');
  assert.equal(deploymentPayment?.entry_date, '2025-01-10');
  assert.equal(db.prepare("SELECT amount_paid FROM customers WHERE id = ?").get(amina.id).amount_paid, 50000);
  assert.equal(db.prepare("SELECT count(*) AS count FROM deployments WHERE external_ref LIKE 'MIG-DEPLOYMENT-%'").get().count, 1);
  assert.ok(db.prepare("SELECT inv_no FROM accounting_ledger WHERE description = 'Unvouchered utility expense'").get()?.inv_no.startsWith('MIG-DAYBOOK-'));
  assert.equal(db.prepare('SELECT count(*) AS count FROM tickets').get().count, 2);
  assert.equal(db.prepare("SELECT customer_id FROM tickets WHERE external_ref = 'VNQ-001'").get().customer_id, amina.id);
  assert.equal(db.prepare("SELECT status FROM tickets WHERE external_ref = 'VNQ-001'").get().status, 'Closed');
  assert.equal(
    db.prepare("SELECT resolution_datetime FROM tickets WHERE external_ref = 'VNQ-001'").get().resolution_datetime,
    '2025-01-08 11:20 AM'
  );
  assert.equal(db.prepare("SELECT count(*) AS count FROM tickets WHERE external_ref LIKE 'MIG-QUERY-%'").get().count, 1);
  assert.equal(firstImport.summaries.find((summary) => summary.source === 'ExpenseDayBook.xlsx')?.rowsSkipped, 1);

  const secondImport = importLegacyFiles(legacyFiles({
    monthlyPayment: 9500,
    incomeGross: 11750,
    expenseAmount: 5500,
    unvoucheredExpenseAmount: 2500,
    queryStatus: 'Escalated',
    sparseIssue: 'Updated old ticket description',
    deploymentStatus: 'Completed',
    oldDeploymentStatus: 'Completed'
  }));
  assert.ok(secondImport.summaries.every((summary) => summary.type !== 'Import error'), JSON.stringify(secondImport.summaries));

  assert.equal(db.prepare("SELECT count(*) AS count FROM customers").get().count, 2);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger").get().count, 6);
  assert.equal(db.prepare('SELECT count(*) AS count FROM deployments').get().count, 2);
  assert.equal(db.prepare('SELECT count(*) AS count FROM tickets').get().count, 2);
  assert.equal(db.prepare("SELECT gross_amount FROM accounting_ledger WHERE inv_no LIKE 'MIG-%-202501'").get().gross_amount, 9500);
  assert.equal(db.prepare("SELECT gross_amount FROM accounting_ledger WHERE inv_no = 'INC-001'").get().gross_amount, 11750);
  assert.equal(db.prepare("SELECT gross_amount FROM accounting_ledger WHERE inv_no = 'MIG-DAYBOOK-VCH-001'").get().gross_amount, 5500);
  assert.equal(db.prepare("SELECT gross_amount FROM accounting_ledger WHERE description = 'Unvouchered utility expense'").get().gross_amount, 2500);
  assert.equal(db.prepare("SELECT status FROM tickets WHERE external_ref = 'VNQ-001'").get().status, 'Escalated');
  assert.equal(db.prepare("SELECT description FROM tickets WHERE external_ref LIKE 'MIG-QUERY-%'").get().description, 'Updated old ticket description');
  assert.equal(db.prepare("SELECT status FROM deployments WHERE external_ref = 'VND-001'").get().status, 'Completed');
  assert.equal(db.prepare("SELECT status FROM deployments WHERE external_ref LIKE 'MIG-DEPLOYMENT-%'").get().status, 'Completed');

  const unchangedImport = importLegacyFiles(legacyFiles({
    monthlyPayment: 9500,
    incomeGross: 11750,
    expenseAmount: 5500,
    unvoucheredExpenseAmount: 2500,
    queryStatus: 'Escalated',
    sparseIssue: 'Updated old ticket description',
    deploymentStatus: 'Completed',
    oldDeploymentStatus: 'Completed'
  }));
  assert.ok(unchangedImport.summaries.every((summary) => summary.type !== 'Import error'), JSON.stringify(unchangedImport.summaries));
  assert.equal(unchangedImport.totals.paymentEntriesImported || 0, 0);
  assert.equal(unchangedImport.totals.ledgerEntriesImported || 0, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM accounting_ledger").get().count, 6);
});
