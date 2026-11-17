import db from '../db.js';

const REMINDER_ROLES = new Set(['Customer Service', 'Accounting', 'Management', 'GM', 'Dev']);

export function getPaymentReminderDays() {
  const configured = Number.parseInt(process.env.PAYMENT_DUE_NOTICE_DAYS || '7', 10);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 60) : 7;
}

function toUtcDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function syncUpcomingPaymentNotifications(io) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const lastNoticeDate = new Date(todayUtc);
  lastNoticeDate.setUTCDate(lastNoticeDate.getUTCDate() + getPaymentReminderDays());
  const lastNoticeIso = lastNoticeDate.toISOString().slice(0, 10);

  const recipients = db.prepare('SELECT id, roles FROM users WHERE is_active = 1').all()
    .filter((staff) => {
      try {
        const roles = Array.isArray(staff.roles) ? staff.roles : JSON.parse(staff.roles || '[]');
        return roles.some((role) => REMINDER_ROLES.has(role));
      } catch {
        return false;
      }
    });

  if (recipients.length === 0) return 0;

  const dueCustomers = db.prepare(`
    SELECT id, name, voix_no, next_due_date
    FROM customers
    WHERE next_due_date IS NOT NULL
      AND trim(next_due_date) <> ''
      AND date(next_due_date) <= date(?)
      AND lower(trim(coalesce(status, ''))) = 'active'
    ORDER BY date(next_due_date) ASC
  `).all(lastNoticeIso);

  const insertNotification = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (user_id, dedupe_key, reference_id, title, message, type, is_read)
    VALUES (?, ?, ?, ?, ?, 'Payment Due', 0)
  `);

  let inserted = 0;
  const insertForAll = db.transaction(() => {
    for (const customer of dueCustomers) {
      const dueDate = toUtcDate(customer.next_due_date);
      if (!dueDate) continue;
      const daysUntilDue = Math.round((dueDate.getTime() - todayUtc.getTime()) / 86400000);
      const dueText = daysUntilDue < 0
        ? `overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'}`
        : daysUntilDue === 0
          ? 'due today'
          : `due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
      const title = daysUntilDue < 0 ? 'Subscription payment overdue' : 'Subscription payment due soon';
      const account = customer.voix_no ? ` (${customer.voix_no})` : '';
      const message = `${customer.name}${account} is ${dueText}. Next due date: ${String(customer.next_due_date).slice(0, 10)}.`;

      for (const recipient of recipients) {
        const result = insertNotification.run(
          recipient.id,
          `payment-due:${customer.id}:${String(customer.next_due_date).slice(0, 10)}:${recipient.id}`,
          customer.id,
          title,
          message
        );
        inserted += result.changes;
      }
    }
  });

  insertForAll();
  if (inserted > 0) io?.emit('erp-data-changed');
  return inserted;
}

export function notifyPaymentReceived({ customer, amount, invoiceNumber }, io) {
  const recipients = db.prepare('SELECT id FROM users WHERE is_active = 1').all();
  const message = `₦${Number(amount || 0).toLocaleString('en-NG')} payment recorded for ${customer.name}${customer.voix_no ? ` (${customer.voix_no})` : ''}.`;
  const insertNotification = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (user_id, dedupe_key, reference_id, title, message, type, is_read)
    VALUES (?, ?, ?, 'Subscription payment received', ?, 'Payment', 0)
  `);
  const insertForAll = db.transaction(() => {
    for (const recipient of recipients) {
      insertNotification.run(
        recipient.id,
        `payment-received:${invoiceNumber}:${recipient.id}`,
        customer.id,
        message
      );
    }
  });
  insertForAll();
  io?.emit('erp-data-changed');
}

export function startPaymentReminderScheduler(io) {
  const runSweep = () => {
    try {
      syncUpcomingPaymentNotifications(io);
    } catch (error) {
      console.error('Payment reminder sweep failed:', error.message);
    }
  };

  // Run on boot and regularly, with an API-triggered sweep as a fallback when
  // a free hosting instance has been sleeping.
  runSweep();
  const timer = setInterval(runSweep, 6 * 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}
