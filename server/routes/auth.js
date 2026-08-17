import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { generateId } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'voix_erp_super_secure_jwt_token_key_2026';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Session expired or invalid' });
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
  const token = jwt.sign({ id: user.id, username: user.username, roles: rolesArray, fullname: user.fullname, department: user.department }, JWT_SECRET, { expiresIn: '24h' });

  res.json({ token, user: { id: user.id, username: user.username, fullname: user.fullname, email: user.email, roles: rolesArray, department: user.department } });
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
  const notifs = db.prepare(`SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC`).all(req.user.id);
  res.json(notifs);
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