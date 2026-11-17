import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { generateId } from '../db.js';
import { syncUpcomingPaymentNotifications } from '../services/paymentReminders.js';

const router = express.Router();
const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'voix_erp_dev_secret_key_2026');
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set before starting the API in production.');

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Session expired or invalid' });
    if (!decoded.sid) return res.status(401).json({ message: 'Session expired. Please sign in again.' });

    const session = db.prepare(`
      SELECT id, user_id, last_activity_ms, revoked_at
      FROM user_sessions
      WHERE id = ? AND user_id = ?
    `).get(decoded.sid, decoded.id);
    if (!session || session.revoked_at) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    const lastActivity = Number(session.last_activity_ms);
    if (!Number.isFinite(lastActivity) || lastActivity <= 0 || Date.now() - lastActivity >= SESSION_IDLE_TIMEOUT_MS) {
      db.prepare('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL')
        .run(session.id);
      return res.status(401).json({ message: 'Your session expired after 10 minutes of inactivity. Please sign in again.' });
    }

    req.user = decoded;
    next();
  });
};

export const requireRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : JSON.parse(req.user.roles || '[]');
      
      // GM, Management, AND Dev have master override access
      const hasAccess = userRoles.some(role => allowedRoles.includes(role)) 
                        || userRoles.includes('Management') 
                        || userRoles.includes('GM')
                        || userRoles.includes('Dev');
                        
      if (!hasAccess) return res.status(403).json({ message: 'Access denied. Insufficient administrative privileges.' });
      next();
    } catch (err) {
      return res.status(403).json({ message: 'Role authorization failure.' });
    }
  };
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  const user = db.prepare(`SELECT * FROM users WHERE username = ? OR id = ?`).get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Invalid credentials' });
  if (!user.is_active) return res.status(403).json({ message: 'Profile is deactivated. Contact HR.' });

  const rolesArray = JSON.parse(user.roles || '[]');
  const sessionId = generateId('auth_session', 'SES');
  const now = Date.now();
  db.prepare('DELETE FROM user_sessions WHERE revoked_at IS NOT NULL OR last_activity_ms < ?')
    .run(now - (30 * 24 * 60 * 60 * 1000));
  db.prepare('INSERT INTO user_sessions (id, user_id, last_activity_ms) VALUES (?, ?, ?)')
    .run(sessionId, user.id, now);
  const token = jwt.sign({
    id: user.id,
    username: user.username,
    roles: rolesArray,
    fullname: user.fullname,
    department: user.department,
    sid: sessionId
  }, JWT_SECRET, { expiresIn: '24h' });

  res.json({ token, user: { id: user.id, username: user.username, fullname: user.fullname, email: user.email, roles: rolesArray, department: user.department } });
});

router.post('/activity', authenticateToken, (req, res) => {
  const now = Date.now();
  const result = db.prepare(`
    UPDATE user_sessions
    SET last_activity_ms = ?
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `).run(now, req.user.sid, req.user.id);
  if (result.changes === 0) return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  res.json({ last_activity_ms: now });
});

router.post('/logout', authenticateToken, (req, res) => {
  db.prepare(`
    UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `).run(req.user.sid, req.user.id);
  res.json({ message: 'Signed out.' });
});

router.get('/staff', authenticateToken, (req, res) => {
  const staff = db.prepare(`SELECT id, username, fullname, email, phone, roles, department, is_active, created_at FROM users ORDER BY id ASC`).all();
  res.json(staff.map(s => ({ ...s, roles: JSON.parse(s.roles || '[]') })));
});

router.post('/staff', authenticateToken, requireRoles(['GM', 'HR', 'Management']), (req, res) => {
  const { username, password, fullname, email, phone, roles, department } = req.body;
  if (!username || !password || !fullname) return res.status(400).json({ message: 'Missing required fields' });

  try {
    const newEmpId = generateId('staff', 'EMP');
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (id, username, password, fullname, email, phone, roles, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(newEmpId, username.toLowerCase().trim(), hash, fullname, email, phone || '', JSON.stringify(roles || []), department || 'General');
    res.status(201).json({ message: 'Staff created' });
  } catch (err) {
    res.status(400).json({ message: 'Username or Email already registered' });
  }
});

router.patch('/staff/:id/role', authenticateToken, requireRoles(['GM', 'HR', 'Management']), (req, res) => {
  const { roles, department } = req.body;
  db.prepare(`UPDATE users SET roles = ?, department = COALESCE(?, department) WHERE id = ?`).run(JSON.stringify(roles || []), department, req.params.id);
  res.json({ message: `Roles updated` });
});

router.get('/notifications', authenticateToken, (req, res) => {
  // Free instances may sleep between scheduled sweeps; refresh due-payment alerts
  // whenever a signed-in user opens the notification feed.
  syncUpcomingPaymentNotifications(req.io);
  const notifs = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? AND is_read = 0
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(notifs);
});

router.patch('/notifications/:id/read', authenticateToken, (req, res) => {
  const result = db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ message: 'Notification marked as read.' });
});

router.patch('/notifications/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: 'Notifications marked as read.' });
});

router.patch('/profile', authenticateToken, (req, res) => {
  const { fullname, email, phone } = req.body;
  db.prepare(`UPDATE users SET fullname = ?, email = ?, phone = ? WHERE id = ?`).run(fullname, email, phone, req.user.id);
  res.json({ message: 'Profile updated' });
});

router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare(`SELECT password FROM users WHERE id = ?`).get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ message: 'Current password incorrect.' });
  
  db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ message: 'Password changed securely.' });
});

export default router;