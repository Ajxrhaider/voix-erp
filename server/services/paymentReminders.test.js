import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'voix-payment-reminders-'));
process.env.DB_PATH = path.join(tempDirectory, 'payment-reminders-test.db');
process.env.NODE_ENV = 'test';
process.env.PAYMENT_DUE_NOTICE_DAYS = '7';

const { default: db } = await import('../db.js');
const { getPaymentReminderDays, syncUpcomingPaymentNotifications } = await import('./paymentReminders.js');

function dateOffset(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

after(() => {
  db.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('payment reminder window defaults to seven days and is clamped to one through sixty', () => {
  const original = process.env.PAYMENT_DUE_NOTICE_DAYS;
  try {
    delete process.env.PAYMENT_DUE_NOTICE_DAYS;
    assert.equal(getPaymentReminderDays(), 7);

    process.env.PAYMENT_DUE_NOTICE_DAYS = '0';
    assert.equal(getPaymentReminderDays(), 1);
    process.env.PAYMENT_DUE_NOTICE_DAYS = '90';
    assert.equal(getPaymentReminderDays(), 60);
    process.env.PAYMENT_DUE_NOTICE_DAYS = 'not-a-number';
    assert.equal(getPaymentReminderDays(), 7);
  } finally {
    if (original === undefined) delete process.env.PAYMENT_DUE_NOTICE_DAYS;
    else process.env.PAYMENT_DUE_NOTICE_DAYS = original;
  }
});

test('sends due-soon, due-today, and overdue notices once to active payment-reminder recipients', () => {
  db.prepare('DELETE FROM notifications').run();
  db.prepare('UPDATE users SET roles = ?, is_active = 0 WHERE id = ?').run('[]', 'EMP-000');

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, fullname, roles, is_active)
    VALUES (?, ?, 'test-password', ?, ?, ?)
  `);
  const recipients = [
    ['EMP-REM-CS', 'reminder.cs', 'Customer Service', ['Customer Service'], 1],
    ['EMP-REM-ACCOUNTING', 'reminder.accounting', 'Accounting', ['Accounting'], 1],
    ['EMP-REM-MANAGEMENT', 'reminder.management', 'Management', ['Management'], 1],
    ['EMP-REM-GM', 'reminder.gm', 'General Manager', ['GM'], 1],
    ['EMP-REM-DEV', 'reminder.dev', 'Developer', ['Dev'], 1],
    ['EMP-REM-NOC', 'reminder.noc', 'NOC', ['NOC'], 1],
    ['EMP-REM-INACTIVE', 'reminder.inactive', 'Inactive Accounting', ['Accounting'], 0]
  ];
  for (const [id, username, fullname, roles, isActive] of recipients) {
    insertUser.run(id, username, fullname, JSON.stringify(roles), isActive);
  }

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, voix_no, name, next_due_date, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const dueDates = {
    upcoming: dateOffset(7),
    today: dateOffset(0),
    overdue: dateOffset(-2)
  };
  const customers = [
    ['CUST-REM-UPCOMING', 'Due Soon Co', dueDates.upcoming, 'Active'],
    ['CUST-REM-TODAY', 'Due Today Co', dueDates.today, ' active '],
    ['CUST-REM-OVERDUE', 'Overdue Co', dueDates.overdue, 'Active'],
    ['CUST-REM-OUTSIDE', 'Outside Window Co', dateOffset(8), 'Active'],
    ['CUST-REM-INACTIVE', 'Inactive Co', dateOffset(2), 'Inactive'],
    ['CUST-REM-SUSPENDED', 'Suspended Co', dateOffset(2), 'Suspended'],
    ['CUST-REM-EXPIRED', 'Expired Co', dateOffset(2), 'Expired'],
    ['CUST-REM-UNSET', 'Unset Status Co', dateOffset(2), null],
    ['CUST-REM-INVALID-DATE', 'Invalid Date Co', 'not-a-date', 'Active']
  ];
  for (const [id, name, dueDate, status] of customers) {
    insertCustomer.run(id, `VN-${id}`, name, dueDate, status);
  }

  const emittedEvents = [];
  const io = { emit: (event) => emittedEvents.push(event) };
  assert.equal(syncUpcomingPaymentNotifications(io), 15);

  const notifications = db.prepare(`
    SELECT user_id, reference_id, title, message, type, is_read
    FROM notifications
    ORDER BY user_id, reference_id
  `).all();
  assert.equal(notifications.length, 15);
  assert.deepEqual(emittedEvents, ['erp-data-changed']);

  const activeRecipientIds = recipients.filter(([, , , , isActive]) => isActive)
    .filter(([, , , roles]) => roles.some((role) => ['Customer Service', 'Accounting', 'Management', 'GM', 'Dev'].includes(role)))
    .map(([id]) => id);
  for (const userId of activeRecipientIds) {
    assert.equal(notifications.filter((notification) => notification.user_id === userId).length, 3);
  }
  assert.equal(notifications.some((notification) => notification.user_id === 'EMP-REM-NOC'), false);
  assert.equal(notifications.some((notification) => notification.user_id === 'EMP-REM-INACTIVE'), false);

  const findNotification = (customerId) => notifications.find((notification) => notification.reference_id === customerId);
  assert.equal(findNotification('CUST-REM-UPCOMING').title, 'Subscription payment due soon');
  assert.equal(findNotification('CUST-REM-UPCOMING').message, `Due Soon Co (VN-CUST-REM-UPCOMING) is due in 7 days. Next due date: ${dueDates.upcoming}.`);
  assert.equal(findNotification('CUST-REM-TODAY').message, `Due Today Co (VN-CUST-REM-TODAY) is due today. Next due date: ${dueDates.today}.`);
  assert.equal(findNotification('CUST-REM-OVERDUE').title, 'Subscription payment overdue');
  assert.equal(findNotification('CUST-REM-OVERDUE').message, `Overdue Co (VN-CUST-REM-OVERDUE) is overdue by 2 days. Next due date: ${dueDates.overdue}.`);
  assert.ok(notifications.every((notification) => notification.type === 'Payment Due' && notification.is_read === 0));

  assert.equal(syncUpcomingPaymentNotifications(io), 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM notifications').get().count, 15);
  assert.deepEqual(emittedEvents, ['erp-data-changed']);
});
