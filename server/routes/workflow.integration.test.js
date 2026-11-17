import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'voix-workflow-'));
process.env.DB_PATH = path.join(tempDirectory, 'workflow-test.db');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'voix_test_workflow_secret';

const { default: db } = await import('../db.js');
const { default: authRoutes } = await import('./auth.js');
const { default: salesRoutes } = await import('./sales.js');
const { default: deploymentRoutes } = await import('./deployments.js');
const { default: customerRoutes } = await import('./customers.js');
const { default: inventoryRoutes } = await import('./inventory.js');
const { default: teamRoutes } = await import('./teams.js');
const { default: ticketRoutes } = await import('./tickets.js');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.io = { emit() {} };
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/crm/customers', customerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tickets', ticketRoutes);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let testSessionSequence = 0;
function createTestToken(claims) {
  const sessionId = `TEST-SESSION-${++testSessionSequence}`;
  db.prepare('INSERT INTO user_sessions (id, user_id, last_activity_ms) VALUES (?, ?, ?)')
    .run(sessionId, claims.id, Date.now());
  return jwt.sign({ ...claims, sid: sessionId }, process.env.JWT_SECRET);
}
const token = createTestToken({ id: 'EMP-000', username: 'admin', roles: ['Dev'], fullname: 'Workflow Test Admin' });
const nocToken = createTestToken({ id: 'EMP-000', username: 'noc.operator', roles: ['NOC'], fullname: 'NOC Operator' });

async function api(pathname, { method = 'GET', body, authToken = token } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('auth sessions renew on activity and expire or revoke after ten minutes of inactivity', async () => {
  const loginResponse = await api('/api/auth/login', {
    method: 'POST',
    authToken: '',
    body: { username: 'admin', password: 'admin123' }
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  const decoded = jwt.verify(login.token, process.env.JWT_SECRET);
  assert.ok(decoded.sid);

  const sessionBeforeActivity = db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(decoded.sid);
  assert.ok(sessionBeforeActivity);
  const activityResponse = await api('/api/auth/activity', { method: 'POST', authToken: login.token });
  assert.equal(activityResponse.status, 200);
  assert.ok(db.prepare('SELECT last_activity_ms FROM user_sessions WHERE id = ?').get(decoded.sid).last_activity_ms >= sessionBeforeActivity.last_activity_ms);

  db.prepare('UPDATE user_sessions SET last_activity_ms = ? WHERE id = ?')
    .run(Date.now() - (10 * 60 * 1000) - 1, decoded.sid);
  const expiredRequest = await api('/api/deployments', { authToken: login.token });
  assert.equal(expiredRequest.status, 401);
  assert.ok(db.prepare('SELECT revoked_at FROM user_sessions WHERE id = ?').get(decoded.sid).revoked_at);

  const secondLoginResponse = await api('/api/auth/login', {
    method: 'POST',
    authToken: '',
    body: { username: 'admin', password: 'admin123' }
  });
  const secondLogin = await secondLoginResponse.json();
  const secondSessionId = jwt.verify(secondLogin.token, process.env.JWT_SECRET).sid;
  const logoutResponse = await api('/api/auth/logout', { method: 'POST', authToken: secondLogin.token });
  assert.equal(logoutResponse.status, 200);
  assert.ok(db.prepare('SELECT revoked_at FROM user_sessions WHERE id = ?').get(secondSessionId).revoked_at);
});

test('sales win creates one deployment and completion records the initial payment on the customer profile', async () => {
  const leadResponse = await api('/api/sales/pipeline', {
    method: 'POST',
    body: {
      customer_name: 'E2E Deployment Customer',
      customer_type: 'Enterprise',
      contact_email: 'customer@example.test',
      contact_phone: '+2348000000101',
      location: 'Victoria Island, Lagos',
      survey_details: 'Fiber available at the premises',
      proposed_plan: 'Dedicated 100Mbps',
      amount: '48000',
      stage: 'Lead'
    }
  });
  assert.equal(leadResponse.status, 201);
  const lead = await leadResponse.json();

  const wonResponse = await api(`/api/sales/pipeline/${lead.id}/stage`, {
    method: 'PATCH',
    body: { stage: 'Closing/Won' }
  });
  assert.equal(wonResponse.status, 200);
  const won = await wonResponse.json();
  assert.ok(won.deployment_id);

  const duplicateWinResponse = await api(`/api/sales/pipeline/${lead.id}/stage`, {
    method: 'PATCH',
    body: { stage: 'Closing/Won' }
  });
  assert.equal(duplicateWinResponse.status, 200);
  assert.equal(duplicateWinResponse.headers.get('content-type')?.includes('application/json'), true);
  assert.equal(db.prepare('SELECT count(*) AS count FROM deployments WHERE sale_id = ?').get(lead.id).count, 1);

  const deploymentsResponse = await api('/api/deployments');
  assert.equal(deploymentsResponse.status, 200);
  const deployments = await deploymentsResponse.json();
  const deployment = deployments.find((record) => record.id === won.deployment_id);
  assert.ok(deployment);
  assert.equal(deployment.amount, 48000);
  assert.equal(deployment.customer_type, 'Enterprise');
  assert.equal(deployment.email, 'customer@example.test');
  assert.equal(deployment.payment_mode, 'Bank Transfer');
  assert.match(deployment.date_of_payment, /^\d{4}-\d{2}-\d{2}$/);

  const completionResponse = await api(`/api/deployments/${deployment.id}/resolve`, {
    method: 'PATCH',
    body: { fat_box: 'FAT-VI-02', splitter_port: 'Port 7', onu_mac: 'AA:BB:CC:DD:EE:01', assigned_ip: '10.20.0.11' }
  });
  assert.equal(completionResponse.status, 200);
  const completion = await completionResponse.json();
  assert.equal(completion.payment_created, true);
  assert.equal(completion.deployment.status, 'Completed');
  assert.ok(completion.customer.id);

  db.prepare(`
    INSERT INTO accounting_ledger (
      customer_id, entry_date, inv_no, customer_name, customer_type, type, category,
      description, gross_amount, net_amount, payment_mode
    ) VALUES (?, '2999-12-31', 'TEST-FUTURE-SUBSCRIPTION', ?, 'FTTH', 'Income',
      'Monthly Bandwidth Subscription', 'Later subscription payment', 12000, 12000, 'Bank Transfer')
  `).run(completion.customer.id, completion.customer.name);

  const profileResponse = await api(`/api/crm/customers/${encodeURIComponent(completion.customer.id)}/profile`);
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json();
  assert.equal(profile.customer.amount_paid, 48000);
  assert.equal(profile.customer.customer_type, 'Enterprise');
  assert.equal(profile.customer.email, 'customer@example.test');
  assert.equal(profile.customer.last_payment_date, deployment.date_of_payment);
  assert.equal(profile.payments.length, 2);
  assert.equal(profile.payments[0].customer_id, profile.customer.id);
  assert.equal(profile.payments[0].reference_id, deployment.id);
  assert.equal(profile.payments[0].category, 'Installation & Setup Fee');
  assert.equal(profile.payments[0].gross_amount, 48000);
  assert.equal(profile.payments[0].payment_mode, 'Bank Transfer');
  assert.equal(profile.payments[1].category, 'Monthly Bandwidth Subscription');

  const repeatCompletionResponse = await api(`/api/deployments/${deployment.id}/resolve`, {
    method: 'PATCH',
    body: { fat_box: 'FAT-VI-02', splitter_port: 'Port 7' }
  });
  assert.equal(repeatCompletionResponse.status, 200);
  assert.equal((await repeatCompletionResponse.json()).payment_created, false);
  assert.equal(db.prepare('SELECT count(*) AS count FROM accounting_ledger WHERE reference_id = ?').get(deployment.id).count, 1);
  assert.equal(db.prepare('SELECT amount_paid FROM customers WHERE id = ?').get(profile.customer.id).amount_paid, 48000);

  const manualDeploymentResponse = await api('/api/deployments', {
    method: 'POST',
    body: {
      customer_name: 'Manual E2E Deployment Customer',
      customer_type: 'Enterprise',
      email: 'manual.customer@example.test',
      phone: '+2348000000102',
      location: 'Ikeja, Lagos',
      plan: 'Enterprise 50Mbps',
      amount: 12000,
      payment_mode: 'Cash',
      date_of_payment: '2026-11-13',
      sales_made_by: 'Manual Test'
    }
  });
  assert.equal(manualDeploymentResponse.status, 201);
  const manualDeployment = await manualDeploymentResponse.json();
  const manualCompletionResponse = await api(`/api/deployments/${manualDeployment.id}/resolve`, {
    method: 'PATCH',
    body: { fat_box: 'FAT-IK-01' }
  });
  assert.equal(manualCompletionResponse.status, 200);
  const manualCompletion = await manualCompletionResponse.json();
  const manualProfileResponse = await api(`/api/crm/customers/${encodeURIComponent(manualCompletion.customer.id)}/profile`);
  const manualProfile = await manualProfileResponse.json();
  assert.equal(manualProfile.customer.email, 'manual.customer@example.test');
  assert.equal(manualProfile.customer.customer_type, 'Enterprise');
  assert.equal(manualProfile.payments[0].category, 'Installation & Setup Fee');
  assert.equal(manualProfile.payments[0].gross_amount, 12000);
});

test('sales and ticket endpoints reject invalid data and return created ticket IDs', async () => {
  const badSale = await api('/api/sales/pipeline', {
    method: 'POST',
    body: { customer_name: 'Bad Sale', location: 'Lagos', proposed_plan: 'Plan', amount: 'NaN' }
  });
  assert.equal(badSale.status, 400);

  const zeroPaymentDeployment = await api('/api/deployments', {
    method: 'POST',
    body: { customer_name: 'Unpaid Deployment', location: 'Lagos', plan: 'FTTH 50Mbps', amount: 0 }
  });
  assert.equal(zeroPaymentDeployment.status, 400);

  const ticketResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      customer_name: 'Support Test Customer',
      title: 'No internet access',
      category: 'Connectivity',
      date_received: '2026-11-13',
      location: 'Ikeja, Lagos',
      description: 'Test ticket created by the isolated integration suite'
    }
  });
  assert.equal(ticketResponse.status, 201);
  const ticket = await ticketResponse.json();
  assert.match(ticket.id, /^TKT-/);
  assert.ok(db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticket.id));

  db.prepare("UPDATE tickets SET status = 'Pending Review' WHERE id = ?").run(ticket.id);
  const invalidEscalation = await api(`/api/tickets/${ticket.id}/escalate`, { method: 'PATCH' });
  assert.equal(invalidEscalation.status, 409);
});

test('ticket dispatch, materials requisition, inventory issue, work-order completion and fiber report are retry-safe', async () => {
  const staffRows = [
    ['EMP-FIBER-LEAD', 'fiber.lead', 'Fiber Lead', ['HOD Fiber']],
    ['EMP-FIBER-TECH-1', 'fiber.tech1', 'Fiber Technician One', ['Fiber']],
    ['EMP-FIBER-TECH-2', 'fiber.tech2', 'Fiber Technician Two', ['Fiber']]
  ];
  for (const [id, username, fullname, roles] of staffRows) {
    db.prepare(`
      INSERT INTO users (id, username, password, fullname, roles, department, is_active)
      VALUES (?, ?, 'test-password-hash', ?, ?, 'Fiber', 1)
    `).run(id, username, fullname, JSON.stringify(roles));
  }

  const teamResponse = await api('/api/teams/daily', {
    method: 'POST',
    body: {
      name: 'Integration Fiber Team',
      leader_id: 'EMP-FIBER-LEAD',
      member_ids: ['EMP-FIBER-TECH-1', 'EMP-FIBER-TECH-2'],
      assigned_vehicle: 'Test vehicle'
    }
  });
  assert.equal(teamResponse.status, 201);
  const originalTeam = await teamResponse.json();

  const splitResponse = await api(`/api/teams/daily/${originalTeam.id}/split`, {
    method: 'POST',
    body: {
      detach_member_ids: ['EMP-FIBER-TECH-1', 'EMP-FIBER-TECH-2'],
      new_team: {
        name: 'Integration Fiber Sub-Team',
        leader_id: 'EMP-FIBER-TECH-1',
        member_ids: ['EMP-FIBER-TECH-2'],
        assigned_vehicle: 'Test van'
      }
    }
  });
  assert.equal(splitResponse.status, 201);
  const subTeam = await splitResponse.json();
  assert.deepEqual(JSON.parse(db.prepare('SELECT member_ids FROM daily_teams WHERE id = ?').get(originalTeam.id).member_ids), []);

  const stockResponse = await api('/api/inventory', {
    method: 'POST',
    body: { item_name: 'Integration Drop Cable', category: 'Drop Cable', qty: 5, unit_cost: 1200, min_alert_qty: 1 }
  });
  assert.equal(stockResponse.status, 201);
  const stock = await stockResponse.json();

  const ticketResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      customer_name: 'Fiber Workflow Customer',
      title: 'Drop cable damage',
      category: 'Fiber Cut',
      priority: 'High',
      date_received: '2026-11-13',
      location: 'Ikeja, Lagos',
      description: 'Fiber cut reported near the customer site'
    }
  });
  assert.equal(ticketResponse.status, 201);
  const ticket = await ticketResponse.json();

  const dispatchResponse = await api(`/api/tickets/${ticket.id}/convert-to-work-order`, {
    method: 'POST',
    authToken: nocToken,
    body: { team_id: subTeam.id, objective: 'Repair drop cable', location: 'Ikeja, Lagos', assigned_materials: [] }
  });
  assert.equal(dispatchResponse.status, 201);
  const workOrder = await dispatchResponse.json();
  const duplicateDispatchResponse = await api(`/api/tickets/${ticket.id}/convert-to-work-order`, {
    method: 'POST',
    authToken: nocToken,
    body: { team_id: subTeam.id, objective: 'Repair drop cable', location: 'Ikeja, Lagos', assigned_materials: [] }
  });
  assert.equal(duplicateDispatchResponse.status, 200);
  assert.equal((await duplicateDispatchResponse.json()).id, workOrder.id);

  const unsupportedTicketResponse = await api('/api/tickets', {
    method: 'POST',
    body: { customer_name: 'Unsupported Status Customer', query_type: 'General inquiry', location: 'Ikeja, Lagos', date_received: '2026-11-13' }
  });
  const unsupportedTicket = await unsupportedTicketResponse.json();
  db.prepare("UPDATE tickets SET status = 'Pending Review' WHERE id = ?").run(unsupportedTicket.id);
  const unsupportedDispatchResponse = await api(`/api/tickets/${unsupportedTicket.id}/convert-to-work-order`, {
    method: 'POST',
    authToken: nocToken,
    body: { team_id: subTeam.id, objective: 'Review ticket status', location: 'Ikeja, Lagos', assigned_materials: [] }
  });
  assert.equal(unsupportedDispatchResponse.status, 409);
  assert.equal(db.prepare('SELECT count(*) AS count FROM work_orders WHERE ticket_id = ?').get(unsupportedTicket.id).count, 0);

  const requisitionResponse = await api('/api/inventory/requisitions', {
    method: 'POST',
    body: {
      type: 'Materials',
      purpose: 'Replace damaged drop cable',
      work_order_id: workOrder.id,
      materials_list: [{ itemId: stock.id, itemName: 'Integration Drop Cable', qty: 2 }]
    }
  });
  assert.equal(requisitionResponse.status, 201);
  const requisition = await requisitionResponse.json();

  for (let step = 0; step < 3; step += 1) {
    const approval = await api(`/api/inventory/requisitions/${requisition.id}/approve`, { method: 'PATCH' });
    assert.equal(approval.status, 200);
  }
  assert.equal(db.prepare('SELECT approval_stage FROM requisitions WHERE id = ?').get(requisition.id).approval_stage, 'Pending Inventory');
  const issueResponse = await api(`/api/inventory/requisitions/${requisition.id}/approve`, { method: 'PATCH' });
  assert.equal(issueResponse.status, 200);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 3);
  assert.equal(db.prepare('SELECT approval_stage FROM requisitions WHERE id = ?').get(requisition.id).approval_stage, 'Completed');

  const excessiveReturn = await api(`/api/tickets/work-orders/${workOrder.id}/complete`, {
    method: 'PATCH',
    body: { leftover_materials: [{ itemId: stock.id, itemName: 'Integration Drop Cable', qty: 3 }], return_to_inventory: true }
  });
  assert.equal(excessiveReturn.status, 409);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 3);
  assert.equal(db.prepare('SELECT status FROM work_orders WHERE id = ?').get(workOrder.id).status, 'Assigned');

  const completePayload = { leftover_materials: [{ itemId: stock.id, itemName: 'Integration Drop Cable', qty: 1 }], return_to_inventory: true };
  const completeResponse = await api(`/api/tickets/work-orders/${workOrder.id}/complete`, { method: 'PATCH', body: completePayload });
  assert.equal(completeResponse.status, 200);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 4);
  const repeatComplete = await api(`/api/tickets/work-orders/${workOrder.id}/complete`, { method: 'PATCH', body: completePayload });
  assert.equal(repeatComplete.status, 200);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 4);
  assert.equal(db.prepare('SELECT status FROM tickets WHERE id = ?').get(ticket.id).status, 'Resolved');

  const fiberTicketResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      customer_name: 'Fiber Report Customer',
      title: 'Core ring splice repair',
      category: 'Fiber Cut',
      date_received: '2026-11-13',
      location: 'Surulere, Lagos',
      description: 'Splicing team required'
    }
  });
  const fiberTicket = await fiberTicketResponse.json();
  const fiberWorkOrderResponse = await api(`/api/tickets/${fiberTicket.id}/convert-to-work-order`, {
    method: 'POST',
    body: { team_id: subTeam.id, objective: 'Repair core ring', location: 'Surulere, Lagos' }
  });
  assert.equal(fiberWorkOrderResponse.status, 201);
  const fiberWorkOrder = await fiberWorkOrderResponse.json();

  const fiberRequisitionResponse = await api('/api/inventory/requisitions', {
    method: 'POST',
    body: {
      type: 'Materials',
      purpose: 'Repair core ring splice',
      work_order_id: fiberWorkOrder.id,
      materials_list: [{ itemId: stock.id, itemName: 'Integration Drop Cable', qty: 1 }]
    }
  });
  assert.equal(fiberRequisitionResponse.status, 201);
  const fiberRequisition = await fiberRequisitionResponse.json();
  for (let step = 0; step < 3; step += 1) {
    const approval = await api(`/api/inventory/requisitions/${fiberRequisition.id}/approve`, { method: 'PATCH' });
    assert.equal(approval.status, 200);
  }
  const fiberIssueResponse = await api(`/api/inventory/requisitions/${fiberRequisition.id}/approve`, { method: 'PATCH' });
  assert.equal(fiberIssueResponse.status, 200);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 3);

  const reportData = {
    work_order_id: fiberWorkOrder.id,
    report_date: '2026-11-12',
    vehicle_route: 'Route B',
    ticket_no: fiberTicket.id,
    time_arrived: '09:30 AM',
    splicer_name: 'Fiber Technician Two',
    closure_location_gps: '6.50, 3.35',
    failure_point_desc: 'Damaged core splice',
    manipulations_made: 'Re-spliced and tested the core',
    route_segment: 'Surulere trunk',
    otdr_distance_meters: 275,
    leftover_materials: [{ itemId: stock.id, itemName: 'Integration Drop Cable', qty: 1 }],
    return_to_inventory: true
  };
  const invalidReportResponse = await api('/api/teams/fiber-report', {
    method: 'POST',
    body: { ...reportData, leftover_materials: [{ itemName: 'Uncoded leftover cable', qty: 1 }] }
  });
  assert.equal(invalidReportResponse.status, 400);
  assert.equal(db.prepare('SELECT count(*) AS count FROM fiber_splicing_reports WHERE work_order_id = ?').get(fiberWorkOrder.id).count, 0);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 3);

  const reportResponse = await api('/api/teams/fiber-report', { method: 'POST', body: reportData });
  assert.equal(reportResponse.status, 201);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 4);
  const report = await reportResponse.json();
  assert.equal(db.prepare('SELECT report_date FROM fiber_splicing_reports WHERE id = ?').get(report.id).report_date, '2026-11-12');
  assert.equal(db.prepare('SELECT status FROM work_orders WHERE id = ?').get(fiberWorkOrder.id).status, 'Fulfilled');
  assert.equal(db.prepare('SELECT status FROM tickets WHERE id = ?').get(fiberTicket.id).status, 'Resolved');

  const reportRetry = await api('/api/teams/fiber-report', { method: 'POST', body: reportData });
  assert.equal(reportRetry.status, 200);
  assert.equal(db.prepare('SELECT qty FROM inventory WHERE id = ?').get(stock.id).qty, 4);
  assert.equal((await api('/api/teams/fiber-reports')).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS count FROM fiber_splicing_reports WHERE work_order_id = ?').get(fiberWorkOrder.id).count, 1);
});

test('payment-due endpoint applies the notice window and includes only active accounts', async () => {
  const originalReminderDays = process.env.PAYMENT_DUE_NOTICE_DAYS;
  process.env.PAYMENT_DUE_NOTICE_DAYS = '3';
  try {
    const dateAtOffset = (days) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const customers = [
      ['CUST-DUE-ACTIVE', 'Active Due Customer', dateAtOffset(3), 'Active'],
      ['CUST-DUE-OVERDUE', 'Active Overdue Customer', dateAtOffset(-1), 'Active'],
      ['CUST-DUE-INACTIVE', 'Inactive Customer', dateAtOffset(1), 'Inactive'],
      ['CUST-DUE-SUSPENDED', 'Suspended Customer', dateAtOffset(1), 'Suspended'],
      ['CUST-DUE-EXPIRED', 'Expired Customer', dateAtOffset(1), 'Expired'],
      ['CUST-DUE-OUTSIDE', 'Outside Window Customer', dateAtOffset(4), 'Active']
    ];
    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, voix_no, name, next_due_date, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [id, name, dueDate, status] of customers) {
      insertCustomer.run(id, `VN-${id}`, name, dueDate, status);
    }

    const response = await api('/api/crm/customers/payment-due');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.notice_days, 3);
    assert.deepEqual(
      result.customers.map((customer) => customer.id).sort(),
      ['CUST-DUE-ACTIVE', 'CUST-DUE-OVERDUE']
    );
    assert.equal(db.prepare(`
      SELECT count(*) AS count FROM notifications
      WHERE type = 'Payment Due' AND reference_id IN (?, ?)
    `).get('CUST-DUE-ACTIVE', 'CUST-DUE-OVERDUE').count, 2);
    assert.equal(db.prepare(`
      SELECT count(*) AS count FROM notifications
      WHERE type = 'Payment Due' AND reference_id IN (?, ?, ?)
    `).get('CUST-DUE-INACTIVE', 'CUST-DUE-SUSPENDED', 'CUST-DUE-EXPIRED').count, 0);

    const feedResponse = await api('/api/auth/notifications');
    assert.equal(feedResponse.status, 200);
    const feed = await feedResponse.json();
    assert.equal(feed.length, 2);
    assert.ok(feed.every((notification) => notification.type === 'Payment Due'));

    const markReadResponse = await api(`/api/auth/notifications/${feed[0].id}/read`, { method: 'PATCH' });
    assert.equal(markReadResponse.status, 200);
    const refreshedFeed = await api('/api/auth/notifications');
    assert.equal((await refreshedFeed.json()).length, 1);
  } finally {
    if (originalReminderDays === undefined) delete process.env.PAYMENT_DUE_NOTICE_DAYS;
    else process.env.PAYMENT_DUE_NOTICE_DAYS = originalReminderDays;
  }
});
