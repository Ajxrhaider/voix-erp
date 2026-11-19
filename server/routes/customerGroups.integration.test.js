import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDirectory = mkdtempSync(path.join(tmpdir(), 'voix-customer-groups-'));
process.env.DB_PATH = path.join(tempDirectory, 'customer-groups-test.db');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'voix_test_customer_groups_secret';

const { default: db } = await import('../db.js');
const { default: customerRoutes } = await import('./customers.js');
const { default: ticketRoutes } = await import('./tickets.js');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.io = { emit() {} };
  next();
});
app.use('/api/crm/customers', customerRoutes);
app.use('/api/tickets', ticketRoutes);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let tokenSequence = 0;

function createTestToken(roles) {
  const sessionId = `GROUP-SESSION-${++tokenSequence}`;
  db.prepare('INSERT INTO user_sessions (id, user_id, last_activity_ms) VALUES (?, ?, ?)')
    .run(sessionId, 'EMP-000', Date.now());
  return jwt.sign({
    id: 'EMP-000',
    username: 'group-test-user',
    fullname: 'Customer Group Test',
    roles,
    sid: sessionId
  }, process.env.JWT_SECRET);
}

const managerToken = createTestToken(['Dev']);
const viewerToken = createTestToken(['Sales']);

async function api(pathname, { method = 'GET', body, authToken = managerToken } = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function createGroup(name, group_type, parent_id = null) {
  const response = await api('/api/crm/customers/customer-groups', {
    method: 'POST',
    body: { name, group_type, parent_id }
  });
  if (!response.ok) throw new Error(`could not create ${group_type} ${name}: ${await response.text()}`);
  return response.json();
}

async function createCustomer(name, voix_no, group_id = null) {
  const response = await api('/api/crm/customers', {
    method: 'POST',
    body: { name, voix_no, group_id }
  });
  if (!response.ok) throw new Error(`could not create customer ${name}: ${await response.text()}`);
  return response.json();
}

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test('customer location groups can be built and assigned, and multi-group tickets link affected customers once', async () => {
  const network = await createGroup('Main 1', 'network');
  const lineOne = await createGroup('OLT01', 'line', network.id);
  const estateOne = await createGroup('Palm Estate', 'estate', lineOne.id);
  const houseOne = await createGroup('House 12', 'house', estateOne.id);
  const lineTwo = await createGroup('RB01', 'line', network.id);
  const estateTwo = await createGroup('Ikeja Gardens', 'estate', lineTwo.id);
  const houseTwo = await createGroup('House 4', 'house', estateTwo.id);
  const directEstate = await createGroup('Network-side Estate', 'estate', network.id);

  const invalidLine = await api('/api/crm/customers/customer-groups', {
    method: 'POST', body: { name: 'Invalid Line', group_type: 'line' }
  });
  assert.equal(invalidLine.status, 400, 'a line must have a network parent');
  const invalidHouse = await api('/api/crm/customers/customer-groups', {
    method: 'POST', body: { name: 'Invalid House', group_type: 'house', parent_id: lineOne.id }
  });
  assert.equal(invalidHouse.status, 400, 'a house must have an estate parent');

  const duplicateNetwork = await createGroup('Main 1', 'network');
  assert.equal(duplicateNetwork.id, network.id, 'group creation is idempotent for the same parent, type and name');
  const groupsResponse = await api('/api/crm/customers/customer-groups');
  assert.equal(groupsResponse.status, 200);
  const groups = await groupsResponse.json();
  assert.equal(groups.find((group) => group.id === houseOne.id)?.path, 'Main 1 / OLT01 / Palm Estate / House 12');
  assert.equal(groups.find((group) => group.id === directEstate.id)?.path, 'Main 1 / Network-side Estate');

  const firstCustomer = await createCustomer('Group Customer One', 'VN-GROUP-001', houseOne.id);
  const secondCustomer = await createCustomer('Group Customer Two', 'VN-GROUP-002');
  const unassignedCustomer = await createCustomer('Group Customer Unassigned', 'VN-GROUP-003');
  const assignDenied = await api(`/api/crm/customers/${encodeURIComponent(secondCustomer.id)}/group`, {
    method: 'PATCH', authToken: viewerToken, body: { group_id: houseTwo.id }
  });
  assert.equal(assignDenied.status, 403, 'read-only roles cannot assign a customer group');
  const assignResponse = await api(`/api/crm/customers/${encodeURIComponent(secondCustomer.id)}/group`, {
    method: 'PATCH', body: { group_id: houseTwo.id }
  });
  assert.equal(assignResponse.status, 200);
  const invalidAssignment = await api(`/api/crm/customers/${encodeURIComponent(secondCustomer.id)}/group`, {
    method: 'PATCH', body: { group_id: 'MISSING-GROUP' }
  });
  assert.equal(invalidAssignment.status, 400);

  const customersResponse = await api('/api/crm/customers');
  const customers = await customersResponse.json();
  assert.equal(customers.find((customer) => customer.id === firstCustomer.id)?.group_path, 'Main 1 / OLT01 / Palm Estate / House 12');
  assert.equal(customers.find((customer) => customer.id === secondCustomer.id)?.group_path, 'Main 1 / RB01 / Ikeja Gardens / House 4');
  assert.equal(customers.find((customer) => customer.id === unassignedCustomer.id)?.group_path, '');

  const invalidScope = await api('/api/tickets', {
    method: 'POST',
    body: {
      customer_id: firstCustomer.id,
      title: 'Mismatched reporting customer',
      category: 'Network outage',
      scope_group_ids: [houseTwo.id]
    }
  });
  assert.equal(invalidScope.status, 400, 'the reporting customer must belong to one of the selected groups');

  const multiGroupResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      customer_id: firstCustomer.id,
      title: 'Multi-group fiber outage',
      description: 'Several connected neighborhoods are affected.',
      category: 'Network outage',
      scope_group_ids: [lineOne.id, estateOne.id, estateTwo.id]
    }
  });
  assert.equal(multiGroupResponse.status, 201);
  const multiGroupTicket = await multiGroupResponse.json();
  assert.deepEqual(multiGroupTicket.scope_group_ids, [lineOne.id, estateOne.id, estateTwo.id]);
  assert.equal(multiGroupTicket.affected_customer_count, 2, 'overlapping group scopes do not duplicate affected customers');
  assert.equal(db.prepare('SELECT count(*) AS count FROM ticket_scope_groups WHERE ticket_id = ?').get(multiGroupTicket.id).count, 3);
  assert.equal(db.prepare('SELECT count(*) AS count FROM ticket_customer_links WHERE ticket_id = ?').get(multiGroupTicket.id).count, 2);

  const ticketListResponse = await api('/api/tickets');
  const listedTicket = (await ticketListResponse.json()).find((ticket) => ticket.id === multiGroupTicket.id);
  assert.deepEqual(new Set(listedTicket.scope_group_paths), new Set([
    'Main 1 / OLT01',
    'Main 1 / OLT01 / Palm Estate',
    'Main 1 / RB01 / Ikeja Gardens'
  ]));
  assert.equal(listedTicket.affected_customer_count, 2);

  const secondProfileResponse = await api(`/api/crm/customers/${encodeURIComponent(secondCustomer.id)}/profile`);
  assert.equal(secondProfileResponse.status, 200);
  const secondProfile = await secondProfileResponse.json();
  const linkedTicket = secondProfile.queries.find((ticket) => ticket.id === multiGroupTicket.id);
  assert.ok(linkedTicket, 'each affected customer profile should include the multi-group ticket');
  assert.match(linkedTicket.scope_group_path, /Main 1 \/ RB01 \/ Ikeja Gardens/);

  const networkTicketResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      title: 'Main network incident',
      description: 'The full network is affected.',
      category: 'Network outage',
      scope_group_ids: [network.id]
    }
  });
  assert.equal(networkTicketResponse.status, 201);
  const networkTicket = await networkTicketResponse.json();
  assert.equal(networkTicket.affected_customer_count, 3, 'Main 1 scope includes customers without an assigned location');
  assert.equal(db.prepare('SELECT count(*) AS count FROM ticket_customer_links WHERE ticket_id = ?').get(networkTicket.id).count, 3);

  const regionalNetwork = await createGroup('Regional 2', 'network');
  const regionalCustomer = await createCustomer('Regional Network Customer', 'VN-GROUP-004', regionalNetwork.id);
  const regionalTicketResponse = await api('/api/tickets', {
    method: 'POST',
    body: {
      title: 'Regional network incident',
      category: 'Network outage',
      scope_group_ids: [regionalNetwork.id]
    }
  });
  assert.equal(regionalTicketResponse.status, 201);
  const regionalTicket = await regionalTicketResponse.json();
  assert.equal(regionalTicket.affected_customer_count, 1, 'other network groups only include their own descendants');
  assert.equal(db.prepare('SELECT customer_id FROM ticket_customer_links WHERE ticket_id = ?').get(regionalTicket.id).customer_id, regionalCustomer.id);

  const originalBytes = Buffer.from('unchanged legacy source bytes');
  const originalName = 'Voix customer source.xlsx';
  const fileSha256 = createHash('sha256').update(originalBytes).digest('hex');
  const archiveId = db.prepare(`
    INSERT INTO import_archives (original_name, sha256, mime_type, file_data)
    VALUES (?, ?, ?, ?)
  `).run(originalName, fileSha256, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', originalBytes).lastInsertRowid;
  db.prepare(`
    INSERT INTO legacy_import_rows (archive_id, sheet_name, source_row_number, record_kind, row_data_json)
    VALUES (?, 'Customers', 1, 'customers', '{"name":"Archive test"}')
  `).run(archiveId);
  const archivesResponse = await api('/api/crm/customers/import-archives');
  assert.equal(archivesResponse.status, 200);
  const archive = (await archivesResponse.json()).find((item) => item.id === archiveId);
  assert.equal(archive.original_name, originalName);
  assert.equal(archive.file_bytes, originalBytes.length);
  assert.equal(archive.source_rows, 1);
  assert.equal(archive.sheet_count, 1);
  const downloadResponse = await api(`/api/crm/customers/import-archives/${archiveId}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get('content-disposition'), `attachment; filename="${originalName}"`);
  assert.ok(Buffer.from(await downloadResponse.arrayBuffer()).equals(originalBytes));
  assert.equal((await api('/api/crm/customers/import-archives/999999/download')).status, 404);
});
