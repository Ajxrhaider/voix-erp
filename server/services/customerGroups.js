import db, { generateId } from '../db.js';

export const CUSTOMER_GROUP_TYPES = ['network', 'line', 'estate', 'house'];

export function normalizeGroupName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getLineCodeFromVoixNumber(value) {
  const match = String(value || '').trim().match(/^VN-[^-]+-[^-]+-((?:OLT|RB|SW)\d+)-/i);
  return match?.[1]?.toUpperCase() || '';
}

export function getEstateCodeFromVoixNumber(value) {
  const match = String(value || '').trim().match(/^VN-[^-]+-([^-]+)-/i);
  return match?.[1]?.toUpperCase() || '';
}

export function isMainNetworkLabel(value) {
  return /^main\s*(?:1|one)(?:\b|\s|\()/i.test(String(value || '').trim());
}

export function isValidGroupParent(groupType, parentType) {
  if (groupType === 'network') return !parentType;
  if (groupType === 'line') return parentType === 'network';
  if (groupType === 'estate') return ['network', 'line'].includes(parentType);
  if (groupType === 'house') return parentType === 'estate';
  return false;
}

export function getOrCreateCustomerGroup(name, groupType, parentId = null) {
  const cleanName = String(name || '').trim();
  const cleanType = String(groupType || '').trim().toLowerCase();
  if (!cleanName || !CUSTOMER_GROUP_TYPES.includes(cleanType)) return null;

  const existing = db.prepare(`
    SELECT id FROM customer_groups
    WHERE parent_id IS ? AND group_type = ? AND lower(trim(name)) = lower(trim(?))
    ORDER BY id LIMIT 1
  `).get(parentId, cleanType, cleanName);
  if (existing) return existing.id;

  const id = generateId('customer_group', 'GRP');
  db.prepare(`
    INSERT INTO customer_groups (id, parent_id, name, group_type)
    VALUES (?, ?, ?, ?)
  `).run(id, parentId, cleanName, cleanType);
  return id;
}

export function ensureImportedCustomerGroup({ lineName = '', estateName = '', estateCode = '', houseName = '' } = {}) {
  const hasLocation = [lineName, estateName, estateCode, houseName].some((value) => String(value || '').trim());
  if (!hasLocation) return null;

  const networkId = getOrCreateCustomerGroup('Main 1', 'network');
  let parentId = networkId;
  const line = String(lineName || '').trim();
  const house = String(houseName || '').trim();
  const estate = String(estateName || '').trim()
    || (estateCode ? `Estate ${String(estateCode).trim()}` : '')
    || (house ? 'Unassigned Estate' : '');

  if (line) parentId = getOrCreateCustomerGroup(line, 'line', networkId);
  if (estate) parentId = getOrCreateCustomerGroup(estate, 'estate', parentId);
  if (house && normalizeGroupName(house) !== normalizeGroupName(estate)) {
    parentId = getOrCreateCustomerGroup(house, 'house', parentId);
  }
  return parentId;
}

export function getCustomerGroupPath(groupId) {
  if (!groupId) return '';
  return db.prepare(`
    WITH RECURSIVE ancestors(id, parent_id, name, depth) AS (
      SELECT id, parent_id, name, 0 FROM customer_groups WHERE id = ?
      UNION ALL
      SELECT parent.id, parent.parent_id, parent.name, child.depth + 1
      FROM customer_groups AS parent
      JOIN ancestors AS child ON parent.id = child.parent_id
    )
    SELECT name FROM ancestors ORDER BY depth DESC
  `).all(groupId).map((row) => row.name).join(' / ');
}

export function listCustomerGroups() {
  const groups = db.prepare(`
    SELECT groups.id, groups.parent_id, groups.name, groups.group_type,
      groups.created_at,
      (SELECT count(*) FROM customers WHERE group_id = groups.id) AS direct_customer_count
    FROM customer_groups AS groups
    ORDER BY CASE groups.group_type
      WHEN 'network' THEN 0 WHEN 'line' THEN 1 WHEN 'estate' THEN 2 ELSE 3
    END, groups.name COLLATE NOCASE, groups.id
  `).all();
  return groups.map((group) => ({ ...group, path: getCustomerGroupPath(group.id) }));
}

export function getCustomerIdsInGroup(groupId) {
  if (!groupId) return [];
  const group = db.prepare('SELECT group_type, name FROM customer_groups WHERE id = ?').get(groupId);
  if (!group) return [];
  // Main 1 is the network-wide scope, including customers not yet assigned to a line.
  if (group.group_type === 'network' && isMainNetworkLabel(group.name)) {
    return db.prepare('SELECT id FROM customers ORDER BY id').all().map((row) => row.id);
  }
  return db.prepare(`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM customer_groups WHERE id = ?
      UNION
      SELECT child.id FROM customer_groups AS child
      JOIN descendants AS parent ON child.parent_id = parent.id
    )
    SELECT customers.id
    FROM customers JOIN descendants ON customers.group_id = descendants.id
    ORDER BY customers.id
  `).all(groupId).map((row) => row.id);
}

export function isCustomerInGroup(customerId, groupId) {
  if (!customerId || !groupId) return false;
  return getCustomerIdsInGroup(groupId).includes(customerId);
}

export function findCustomerGroupByName(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;
  if (isMainNetworkLabel(cleanName)) {
    const main = db.prepare(`SELECT id, parent_id, name, group_type FROM customer_groups
      WHERE group_type = 'network' AND lower(trim(name)) = 'main 1' ORDER BY id LIMIT 1`).get();
    if (main) return main;
  }
  return db.prepare(`
    SELECT id, parent_id, name, group_type
    FROM customer_groups
    WHERE lower(trim(name)) = lower(trim(?))
    ORDER BY CASE group_type
      WHEN 'house' THEN 0 WHEN 'estate' THEN 1 WHEN 'line' THEN 2 ELSE 3
    END, id
    LIMIT 1
  `).get(cleanName) || null;
}

export function linkTicketToScope(ticketId, { customerId = null, groupId = null, groupIds = [] } = {}) {
  if (!ticketId) return { linkedCustomers: 0, linkedGroups: 0 };
  const uniqueGroupIds = [...new Set([groupId, ...(Array.isArray(groupIds) ? groupIds : [])].filter(Boolean))];
  const affectedCustomerIds = new Set(customerId ? [customerId] : []);
  for (const id of uniqueGroupIds) {
    for (const affectedId of getCustomerIdsInGroup(id)) affectedCustomerIds.add(affectedId);
  }

  const insertCustomer = db.prepare('INSERT OR IGNORE INTO ticket_customer_links (ticket_id, customer_id) VALUES (?, ?)');
  const insertGroup = db.prepare('INSERT OR IGNORE INTO ticket_scope_groups (ticket_id, group_id) VALUES (?, ?)');
  let linkedCustomers = 0;
  let linkedGroups = 0;
  for (const affectedId of affectedCustomerIds) linkedCustomers += insertCustomer.run(ticketId, affectedId).changes;
  for (const id of uniqueGroupIds) linkedGroups += insertGroup.run(ticketId, id).changes;
  return { linkedCustomers, linkedGroups };
}
