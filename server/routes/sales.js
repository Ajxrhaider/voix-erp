import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/sales/pipeline
router.get('/pipeline', authenticateToken, (req, res) => {
  const deals = db.prepare(`SELECT * FROM sales_pipeline ORDER BY created_at DESC`).all();
  res.json(deals);
});

// POST /api/sales/pipeline (Input Sale & Survey)
router.post('/pipeline', authenticateToken, (req, res) => {
  const { customer_name, contact_email, contact_phone, location, survey_details, proposed_plan, amount, stage } = req.body;
  if (!customer_name || !location || !amount) {
    return res.status(400).json({ message: 'Customer name, location, and proposed deal amount required' });
  }

  const saleId = generateId('sale', 'SALE');
  const stmt = db.prepare(`
    INSERT INTO sales_pipeline (id, customer_name, contact_email, contact_phone, location, survey_details, proposed_plan, amount, stage, sales_rep_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    saleId, customer_name, contact_email || '', contact_phone || '',
    location, survey_details || 'Optical survey pending',
    proposed_plan || '50Mbps FTTH Plan',
    parseFloat(amount), stage || 'Lead', req.user.id
  );

  // AUTOMATED FLOW: If created directly in "Closing/Won", trigger deployment instantly
  if (stage === 'Closing/Won') {
    createDeploymentFromSale(saleId, customer_name, contact_phone, location, proposed_plan, amount);
  }

  res.status(201).json({ id: saleId, message: 'Sales opportunity entered into pipeline' });
});

// PATCH /api/sales/pipeline/:id/stage (Stage advancement in Bitrix24 style)
router.patch('/pipeline/:id/stage', authenticateToken, (req, res) => {
  const { stage } = req.body;
  const { id } = req.params;

  const sale = db.prepare(`SELECT * FROM sales_pipeline WHERE id = ?`).get(id);
  if (!sale) return res.status(404).json({ message: 'Deal not found' });

  db.prepare(`UPDATE sales_pipeline SET stage = ? WHERE id = ?`).run(stage, id);

  // AUTOMATED FLOW: Sale reaches "Closing/Won" -> automatically create Deployment
  if (stage === 'Closing/Won') {
    const existingDep = db.prepare(`SELECT id FROM deployments WHERE sale_id = ?`).get(id);
    if (!existingDep) {
      createDeploymentFromSale(sale.id, sale.customer_name, sale.contact_phone, sale.location, sale.proposed_plan, sale.amount);
    }
  }

  res.json({ message: `Deal stage advanced to ${stage}` });
});

function createDeploymentFromSale(saleId, name, phone, location, plan, amount) {
  const depId = generateId('deployment', 'DEP');
  db.prepare(`
    INSERT INTO deployments (id, sale_id, customer_name, phone, location, plan, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Awaiting Splicing')
  `).run(depId, saleId, name, phone || '', location, plan, amount);
}

export default router;