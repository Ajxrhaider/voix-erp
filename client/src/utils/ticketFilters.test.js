import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canEscalateTicket, isDispatchableTicket, isTechnicalTicket } from './ticketFilters.js';

test('NOC dispatchable status filter matches current and legacy active ticket statuses', () => {
  for (const status of ['Open', 'Escalated', 'On Hold', ' open ']) {
    assert.equal(isDispatchableTicket({ status }), true, `${status} should be dispatchable`);
  }
  for (const status of ['Resolved', 'Closed', 'Converted to Work Order', 'Pending Review', '']) {
    assert.equal(isDispatchableTicket({ status }), false, `${status} should not be dispatchable`);
  }
});

test('escalation actions are shown only for tickets that can still be escalated', () => {
  assert.equal(canEscalateTicket({ status: 'Open' }), true);
  assert.equal(canEscalateTicket({ status: 'On Hold' }), true);
  for (const status of ['Escalated', 'Resolved', 'Closed', 'Converted to Work Order']) {
    assert.equal(canEscalateTicket({ status }), false, `${status} should not be escalated again`);
  }
});

test('NOC technical filter catches standard categories and free-text network issues', () => {
  for (const ticket of [
    { category: 'Fiber Cut' },
    { category: 'LOS Red Light' },
    { query_type: 'Fiber splicing repair' },
    { query_type: 'Internet is down', description: 'Customer has no service' },
    { title: 'Slow Wi-Fi connection' },
    { description: 'PON signal loss at the ONT' }
  ]) {
    assert.equal(isTechnicalTicket(ticket), true, `${JSON.stringify(ticket)} should be recognized as technical`);
  }

  assert.equal(isTechnicalTicket({ query_type: 'Billing question', description: 'Please resend invoice' }), false);
});
