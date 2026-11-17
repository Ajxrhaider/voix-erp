export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const SESSION_ACTIVITY_SYNC_INTERVAL_MS = 5 * 1000;
export const SESSION_ACTIVITY_STORAGE_KEY = 'voix_session_last_activity';

export function isSessionIdle(lastActivityAt, now = Date.now()) {
  const lastActivity = Number(lastActivityAt);
  return !Number.isFinite(lastActivity)
    || lastActivity <= 0
    || now - lastActivity >= SESSION_IDLE_TIMEOUT_MS;
}

export function getSessionTimeRemaining(lastActivityAt, now = Date.now()) {
  const lastActivity = Number(lastActivityAt);
  if (!Number.isFinite(lastActivity) || lastActivity <= 0) return 0;
  const elapsed = Math.max(0, now - lastActivity);
  return Math.max(0, SESSION_IDLE_TIMEOUT_MS - elapsed);
}
