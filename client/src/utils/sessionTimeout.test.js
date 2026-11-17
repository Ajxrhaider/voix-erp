import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSessionTimeRemaining,
  isSessionIdle,
  SESSION_IDLE_TIMEOUT_MS
} from './sessionTimeout.js';

test('idle sessions expire at ten minutes and remain live before the boundary', () => {
  const now = 1_800_000_000_000;
  assert.equal(isSessionIdle(now - SESSION_IDLE_TIMEOUT_MS + 1, now), false);
  assert.equal(isSessionIdle(now - SESSION_IDLE_TIMEOUT_MS, now), true);
  assert.equal(isSessionIdle(0, now), true);
  assert.equal(getSessionTimeRemaining(now - 2 * 60_000, now), 8 * 60_000);
  assert.equal(getSessionTimeRemaining(now + 60_000, now), SESSION_IDLE_TIMEOUT_MS);
});
