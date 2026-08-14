import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/teams/daily (Teams expire daily)
router.get('/daily', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const teams = db.prepare(`SELECT * FROM daily_teams WHERE created_date = ? AND is_active = 1`).all(today);
  res.json(teams);
});

// POST /api/teams/daily (Flexible daily team builder)
router.post('/daily', authenticateToken, (req, res) => {
  const { name, leader_id, member_ids, assigned_vehicle } = req.body;
  if (!name || !leader_id || !member_ids || member_ids.length === 0) {
    return res.status(400).json({ message: 'Team name, appointed team leader, and members required' });
  }

  const teamId = generateId('team', 'TEAM');
  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO daily_teams (id, name, leader_id, member_ids, assigned_vehicle, created_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(teamId, name, leader_id, JSON.stringify(member_ids), assigned_vehicle || 'Hilux Field Unit 1', today);

  res.status(201).json({ id: teamId, message: 'Daily field team mobilized' });
});

// POST /api/teams/fiber-report (Daily Fiber Restoration & Splicing Report matching .docx structure)
router.post('/fiber-report', authenticateToken, (req, res) => {
  const {
    work_order_id, time_arrived, ticket_no, splicer_name,
    closure_location_gps, failure_point_desc, manipulations_made,
    route_segment, otdr_distance_meters, leftover_materials, vehicle_route
  } = req.body;

  if (!splicer_name || !closure_location_gps || !manipulations_made || !otdr_distance_meters) {
    return res.status(400).json({ message: 'Specific splicer, closure location, exact manipulations, and OTDR cut distance are required per operational guidelines' });
  }

  const reportId = generateId('report', 'RPT');
  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO fiber_splicing_reports (
      id, work_order_id, report_date, team_lead, vehicle_route, time_arrived,
      ticket_no, splicer_name, closure_location_gps, failure_point_desc,
      manipulations_made, route_segment, otdr_distance_meters, leftover_materials
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId, work_order_id || null, today, req.user.fullname, vehicle_route || 'Route A: Core Ring',
    time_arrived || '09:00 AM', ticket_no || 'TKT-General', splicer_name,
    closure_location_gps, failure_point_desc, manipulations_made,
    route_segment || 'Main Trunk', parseFloat(otdr_distance_meters),
    JSON.stringify(leftover_materials || [])
  );

  res.status(201).json({ id: reportId, message: 'Fiber restoration and splicing report submitted successfully' });
});

export default router;