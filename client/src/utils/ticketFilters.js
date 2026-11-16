const DISPATCHABLE_STATUSES = new Set(['open', 'escalated', 'on hold']);
const STANDARD_TECHNICAL_CATEGORIES = new Set(['fiber cut', 'los red light', 'high loss']);
const TECHNICAL_TICKET_TERMS = /\b(?:fiber|fibre|splic(?:e|ing)?|los|high\s+loss|low\s+signal|link\s+down|network\s+outage|outage|no\s+(?:internet|service|signal)|internet\s+(?:down|offline|slow)|connectivity|drop\s+cable|pon|onu|ont|wi-?fi|router|modem)\b/i;

export function isDispatchableTicket(ticket) {
  return DISPATCHABLE_STATUSES.has(String(ticket?.status || '').trim().toLowerCase());
}

export function canEscalateTicket(ticket) {
  const status = String(ticket?.status || '').trim().toLowerCase();
  return status === 'open' || status === 'on hold';
}

export function isTechnicalTicket(ticket) {
  const category = String(ticket?.category || '').trim().toLowerCase();
  if (STANDARD_TECHNICAL_CATEGORIES.has(category)) return true;

  const searchableText = [ticket?.category, ticket?.query_type, ticket?.title, ticket?.description]
    .filter(Boolean)
    .join(' ');
  return TECHNICAL_TICKET_TERMS.test(searchableText);
}
