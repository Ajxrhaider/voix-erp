import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { generateId } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'voix_erp_super_secure_jwt_token_key_2026';

// Middleware for JWT Authentication
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

// Middleware for Multi-Role Authorization
export const requireRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'Management')) {
      return res.status(403).json({ message: 'Access denied. Insufficient administrative privileges.' });
    }
    next();
  };
};

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

  const user = db.prepare(`SELECT * FROM users WHERE username = ? OR id = ?`).get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid employee credentials' });
  }

  if (!user.is_active) {
    return res.status(403).json({ message: 'Employee profile is currently deactivated. Contact HR.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullname: user.fullname, department: user.department },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      role: user.role,
      department: user.department
    }
  });
});

// GET /api/auth/staff (Staff Directory)
router.get('/staff', authenticateToken, (req, res) => {
  const staff = db.prepare(`SELECT id, username, fullname, email, phone, role, department, is_active, created_at FROM users ORDER BY id ASC`).all();
  res.json(staff);
});

// POST /api/auth/staff (Register New Staff with EMP-XXX ID - Restricted to GM, HR, Management)
router.post('/staff', authenticateToken, requireRoles(['GM', 'HR', 'Management']), (req, res) => {
  const { username, password, fullname, email, phone, role, department } = req.body;
  
  if (!username || !password || !fullname || !email || !role || !department) {
    return res.status(400).json({ message: 'All required staff fields must be provided' });
  }

  try {
    const newEmpId = generateId('staff', 'EMP');
    const hash = bcrypt.hashSync(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (id, username, password, fullname, email, phone, role, department)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(newEmpId, username.toLowerCase().trim(), hash, fullname, email, phone || '', role, department);

    const createdStaff = db.prepare(`SELECT id, username, fullname, email, phone, role, department FROM users WHERE id = ?`).get(newEmpId);
    res.status(201).json(createdStaff);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ message: 'Username or Email already registered in directory' });
    }
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/auth/staff/:id/role (Assignable only by GM, HR, Management)
router.patch('/staff/:id/role', authenticateToken, requireRoles(['GM', 'HR', 'Management']), (req, res) => {
  const { role, department } = req.body;
  const { id } = req.params;

  db.prepare(`UPDATE users SET role = ?, department = COALESCE(?, department) WHERE id = ?`).run(role, department, id);
  res.json({ message: `Role successfully updated for employee ${id}` });
});

export default router;