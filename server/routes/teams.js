import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();
const CAN_MANAGE_FIBER = ['HOD Fiber', 'Management', 'GM', 'Dev'];

function emitChange(req) {
  req.io?.emit('erp-data-changed');
}

function validIsoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function validMemberIds(value, leaderId = '') {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) return null;
  const ids = [...new Set(value.map((id) => id.trim()))].filter((id) => id !== leaderId);
  return ids;
}

router.get('/daily', authenticateToken, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const teams = db.prepare('SELECT * FROM daily_teams WHERE created_date = ? AND is_active = 1 ORDER BY name COLLATE NOCASE').all(today);
  res.json(teams);
});

router.post('/daily', authenticateToken, requireRoles(CAN_MANAGE_FIBER), (req, res) => {
  const name = String(req.body.name || '').trim();
  const leaderId = String(req.body.leader_id || '').trim();
  const memberIds = validMemberIds(req.body.member_ids, leaderId);
  const assignedVehicle = String(req.body.assigned_vehicle || '').trim();
  if (!name || !leaderId || !memberIds || memberIds.length === 0) {
    return res.status(400).json({ message: 'Team name, appointed team leader, and at least one additional member are required.' });
  }

  const staffIds = [...new Set([leaderId, ...memberIds])];
  const existingStaff = db.prepare(`SELECT id FROM users WHERE id IN (${staffIds.map(() => '?').join(',')}) AND is_active = 1`).all(...staffIds);
  if (existingStaff.length !== staffIds.length) {
    return res.status(400).json({ message: 'The team leader and every team member must be active staff.' });
  }

  try {
    const teamId = generateId('team', 'TEAM');
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO daily_teams (id, name, leader_id, member_ids, assigned_vehicle, created_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(teamId, name, leaderId, JSON.stringify(memberIds), assignedVehicle || 'Hilux Field Unit 1', today);
    emitChange(req);
    res.status(201).json({ id: teamId, message: 'Daily field team mobilized.' });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The team could not be created because a linked staff record is invalid.' });
    }
    console.error('Daily team creation failed:', error.message);
    res.status(500).json({ message: 'The daily team could not be created.' });
  }
});

router.post('/daily/:id/split', authenticateToken, requireRoles(CAN_MANAGE_FIBER), (req, res) => {
  const newTeam = req.body.new_team || {};
  const name = String(newTeam.name || '').trim();
  const leaderId = String(newTeam.leader_id || '').trim();
  const vehicle = String(newTeam.assigned_vehicle || '').trim();
  const detachIds = validMemberIds(req.body.detach_member_ids, '');
  const newMemberIds = validMemberIds(newTeam.member_ids, leaderId);
  if (!name || !leaderId || !vehicle || !detachIds || detachIds.length === 0 || !newMemberIds || !detachIds.includes(leaderId)) {
    return res.status(400).json({ message: 'Provide a name, vehicle, sub-team leader, and at least one member to detach.' });
  }
  if (newMemberIds.length !== detachIds.length - 1 || newMemberIds.some((id) => !detachIds.includes(id))) {
    return res.status(400).json({ message: 'The new team roster must match the selected members, excluding its leader.' });
  }

  try {
    const splitTeam = db.transaction(() => {
      const original = db.prepare('SELECT * FROM daily_teams WHERE id = ? AND is_active = 1').get(req.params.id);
      if (!original) return { notFound: true };
      let originalMembers;
      try { originalMembers = JSON.parse(original.member_ids || '[]'); } catch { return { invalidRoster: true }; }
      const originalMemberSet = new Set(originalMembers);
      if (detachIds.some((id) => !originalMemberSet.has(id))) return { invalidRoster: true };

      const allStaffIds = [...new Set([leaderId, ...newMemberIds])];
      const activeStaff = db.prepare(`
        SELECT id FROM users WHERE id IN (${allStaffIds.map(() => '?').join(',')}) AND is_active = 1
      `).all(...allStaffIds);
      if (activeStaff.length !== allStaffIds.length) return { invalidStaff: true };

      const remainingMembers = originalMembers.filter((id) => !detachIds.includes(id));
      db.prepare('UPDATE daily_teams SET member_ids = ? WHERE id = ?')
        .run(JSON.stringify(remainingMembers), original.id);

      const teamId = generateId('team', 'TEAM');
      db.prepare(`
        INSERT INTO daily_teams (id, name, leader_id, member_ids, assigned_vehicle, created_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(
        teamId,
        name,
        leaderId,
        JSON.stringify(newMemberIds),
        vehicle,
        new Date().toISOString().slice(0, 10)
      );
      return { id: teamId, remainingMembers };
    });

    const result = splitTeam();
    if (result.notFound) return res.status(404).json({ message: 'Active field team not found.' });
    if (result.invalidRoster) return res.status(409).json({ message: 'The selected members are no longer on this team.' });
    if (result.invalidStaff) return res.status(400).json({ message: 'Every sub-team member must be active staff.' });
    emitChange(req);
    res.status(201).json({ id: result.id, message: 'Field team split and sub-team mobilized.' });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The team split could not be saved because a linked staff record is invalid.' });
    }
    console.error('Field team split failed:', error.message);
    res.status(500).json({ message: 'The field team could not be split.' });
  }
});

router.patch('/daily/:id', authenticateToken, requireRoles(CAN_MANAGE_FIBER), (req, res) => {
  const team = db.prepare('SELECT * FROM daily_teams WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!team) return res.status(404).json({ message: 'Active field team not found.' });

  const leaderId = req.body.leader_id === undefined ? team.leader_id : String(req.body.leader_id || '').trim();
  const memberIds = req.body.member_ids === undefined
    ? JSON.parse(team.member_ids || '[]')
    : validMemberIds(req.body.member_ids, leaderId);
  if (!leaderId || !memberIds) return res.status(400).json({ message: 'Provide a valid team leader and member list.' });

  const staffIds = [...new Set([leaderId, ...memberIds])];
  const existingStaff = staffIds.length
    ? db.prepare(`SELECT id FROM users WHERE id IN (${staffIds.map(() => '?').join(',')}) AND is_active = 1`).all(...staffIds)
    : [];
  if (existingStaff.length !== staffIds.length) return res.status(400).json({ message: 'Every assigned team member must be active staff.' });

  db.prepare('UPDATE daily_teams SET leader_id = ?, member_ids = ? WHERE id = ?')
    .run(leaderId, JSON.stringify(memberIds), team.id);
  emitChange(req);
  res.json({ message: 'Team restructured successfully.' });
});

router.get('/fiber-reports', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM fiber_splicing_reports ORDER BY report_date DESC, created_at DESC').all());
});

router.post('/fiber-report', authenticateToken, requireRoles(CAN_MANAGE_FIBER), (req, res) => {
  const {
    work_order_id, time_arrived, ticket_no, splicer_name,
    closure_location_gps, failure_point_desc, manipulations_made,
    route_segment, otdr_distance_meters, leftover_materials, vehicle_route
  } = req.body;
  const reportDate = validIsoDate(req.body.report_date);
  const distance = Number(otdr_distance_meters);
  const cleanSplicer = String(splicer_name || '').trim();
  const cleanLocation = String(closure_location_gps || '').trim();
  const cleanManipulations = String(manipulations_made || '').trim();
  const cleanFailure = String(failure_point_desc || '').trim();
  const leftovers = Array.isArray(leftover_materials) ? leftover_materials : [];
  const returnToInventory = req.body.return_to_inventory === true || req.body.return_to_inventory === 1;

  if (!reportDate) return res.status(400).json({ message: 'Enter a valid report date.' });
  if (!cleanSplicer || !cleanLocation || !cleanManipulations || !cleanFailure || !Number.isFinite(distance) || distance <= 0) {
    return res.status(400).json({ message: 'Splicer, closure location, failure description, manipulations, and a positive OTDR distance are required.' });
  }
  if (work_order_id && !db.prepare('SELECT id FROM work_orders WHERE id = ?').get(work_order_id)) {
    return res.status(404).json({ message: 'The associated work order was not found.' });
  }

  let result;
  try {
    const submitReport = db.transaction(() => {
      const workOrder = work_order_id ? db.prepare('SELECT * FROM work_orders WHERE id = ?').get(work_order_id) : null;
      const existingReport = workOrder
        ? db.prepare('SELECT id FROM fiber_splicing_reports WHERE work_order_id = ? ORDER BY created_at ASC LIMIT 1').get(workOrder.id)
        : null;
      const inventoryReturns = new Map();

      for (const item of leftovers) {
        const quantity = Number(item?.qty ?? 0);
        if (!Number.isInteger(quantity) || quantity < 0) return { invalidLeftovers: true };
      }

      if (workOrder && workOrder.status !== 'Fulfilled' && returnToInventory) {
        for (const item of leftovers) {
          const itemId = String(item?.itemId || '').trim();
          const quantity = Number(item?.qty ?? 0);
          if (quantity > 0 && !itemId) return { missingInventoryItem: true };
          if (itemId && quantity > 0) inventoryReturns.set(itemId, (inventoryReturns.get(itemId) || 0) + quantity);
        }

        let assignedMaterials;
        try { assignedMaterials = JSON.parse(workOrder.assigned_materials || '[]'); } catch { return { invalidAllocation: true }; }
        if (!Array.isArray(assignedMaterials)) return { invalidAllocation: true };
        const issuedTotals = new Map();
        for (const material of assignedMaterials) {
          const itemId = String(material?.itemId || '').trim();
          const quantity = Number(material?.qty);
          if (!itemId || !Number.isInteger(quantity) || quantity < 0) return { invalidAllocation: true };
          issuedTotals.set(itemId, (issuedTotals.get(itemId) || 0) + quantity);
        }

        for (const [itemId, quantity] of inventoryReturns) {
          const issuedQuantity = issuedTotals.get(itemId) || 0;
          if (quantity > issuedQuantity) {
            return { excessReturn: true, itemId, issuedQuantity, requested: quantity };
          }
          if (!db.prepare('SELECT id FROM inventory WHERE id = ?').get(itemId)) {
            return { invalidItem: itemId };
          }
        }
      }

      const reportId = existingReport?.id || generateId('report', 'RPT');
      if (!existingReport) {
        db.prepare(`
          INSERT INTO fiber_splicing_reports (
            id, work_order_id, report_date, team_lead, vehicle_route, time_arrived,
            ticket_no, splicer_name, closure_location_gps, failure_point_desc,
            manipulations_made, route_segment, otdr_distance_meters, leftover_materials
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          reportId,
          work_order_id || null,
          reportDate,
          req.user.fullname || req.user.username || 'System User',
          String(vehicle_route || '').trim() || 'Route A: Core Ring',
          String(time_arrived || '').trim() || '09:00 AM',
          String(ticket_no || '').trim() || 'TKT-General',
          cleanSplicer,
          cleanLocation,
          cleanFailure,
          cleanManipulations,
          String(route_segment || '').trim() || 'Main Trunk',
          distance,
          JSON.stringify(leftovers)
        );
      }

      if (workOrder && workOrder.status !== 'Fulfilled') {
        for (const [itemId, quantity] of inventoryReturns) {
          db.prepare('UPDATE inventory SET qty = qty + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
            .run(quantity, itemId);
        }
        db.prepare("UPDATE work_orders SET status = 'Fulfilled', leftover_materials = ? WHERE id = ?")
          .run(JSON.stringify(leftovers), workOrder.id);
        if (workOrder.ticket_id) {
          db.prepare("UPDATE tickets SET status = 'Resolved' WHERE id = ?").run(workOrder.ticket_id);
        }
      }
      return { id: reportId, reportAlreadyExists: Boolean(existingReport), workOrder };
    });
    result = submitReport();
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The report could not be saved because a linked record is invalid.' });
    }
    console.error('Fiber report submission failed:', error.message);
    return res.status(500).json({ message: 'The fiber report could not be saved.' });
  }

  if (result.invalidLeftovers) return res.status(400).json({ message: 'Leftover material quantities must be whole numbers greater than or equal to zero.' });
  if (result.missingInventoryItem) return res.status(400).json({ message: 'Select an inventory item for every leftover quantity being returned.' });
  if (result.invalidAllocation) return res.status(409).json({ message: 'The work order has invalid issued-material records. Verify its inventory allocations before returning stock.' });
  if (result.excessReturn) return res.status(409).json({ message: `Cannot return ${result.requested} unit(s) of ${result.itemId}; only ${result.issuedQuantity} were issued to this work order.` });
  if (result.invalidItem) return res.status(400).json({ message: `Inventory item ${result.invalidItem} was not found.` });
  if (result.workOrder?.ticket_id && result.workOrder.status !== 'Fulfilled') {
    const recipients = db.prepare(`
      SELECT email FROM users
      WHERE (roles LIKE '%\"NOC\"%' OR roles LIKE '%\"Customer Service\"%')
        AND email IS NOT NULL AND email <> ''
    `).all();
    const emails = recipients.map((person) => person.email).join(',');
    if (emails) sendEmail(emails, 'Field Work Order Resolved', `Work Order ${result.workOrder.id} has been fulfilled. Related Ticket ${result.workOrder.ticket_id} is ready for final verification and closure.`);
  }

  emitChange(req);
  res.status(result.reportAlreadyExists ? 200 : 201).json({
    id: result.id,
    message: result.workOrder?.status === 'Fulfilled'
      ? 'Fiber report attached to the already fulfilled work order; inventory was not adjusted again.'
      : result.workOrder
        ? 'Fiber report saved, leftover stock reconciled, and the associated work order marked fulfilled.'
        : 'Fiber restoration and splicing report submitted successfully.'
  });
});

export default router;
