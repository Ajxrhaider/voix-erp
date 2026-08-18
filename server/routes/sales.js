import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.get('/pipeline', authenticateToken, (req, res) => {
  res.json(db.prepare(`SELECT * FROM sales_pipeline ORDER BY created_at DESC`).all());
});

router.post('/pipeline', authenticateToken, (req, res) => {
  const { customer_name, contact_email, contact_phone, location, survey_details, proposed_plan, amount, stage } = req.body;
  
  const saleId = generateId('sale', 'SALE');
  db.prepare(`
    INSERT INTO sales_pipeline (id, customer_name, contact_email, contact_phone, location, survey_details, proposed_plan, amount, stage, sales_rep_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(saleId, customer_name, contact_email || '', contact_phone || '', location, survey_details || 'Optical survey pending', proposed_plan, parseFloat(amount), stage || 'Lead', req.user.id);

  if (stage === 'Closing/Won') {
    createDeploymentFromSale(saleId, customer_name, contact_phone, location, proposed_plan, amount);
  }

  req.io.emit('erp-data-changed');
  res.status(201).json({ id: saleId });
});

router.patch('/pipeline/:id/stage', authenticateToken, (req, res) => {
  const { stage } = req.body;
  const sale = db.prepare(`SELECT * FROM sales_pipeline WHERE id = ?`).get(req.params.id);
  if (!sale) return res.status(404).json({ message: 'Deal not found' });

  db.prepare(`UPDATE sales_pipeline SET stage = ? WHERE id = ?`).run(stage, req.params.id);

  // AUTOMATED FLOW: Closing/Won -> Create Deployment & Notify HODs
  if (stage === 'Closing/Won') {
    const existingDep = db.prepare(`SELECT id FROM deployments WHERE sale_id = ?`).get(req.params.id);
    if (!existingDep) {
      createDeploymentFromSale(sale.id, sale.customer_name, sale.contact_phone, sale.location, sale.proposed_plan, sale.amount);
      
      const hods = db.prepare(`SELECT id FROM users WHERE roles LIKE '%"HOD Fiber"%'`).all();
      hods.forEach(hod => {
        db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Deployment')`)
          .run(hod.id, 'New Deployment Auto-Queued', `Deal closed for ${sale.customer_name}. Provisioning required.`);
      });
    }
  }

  req.io.emit('erp-data-changed');
  res.json({ message: `Deal advanced to ${stage}` });
});

function createDeploymentFromSale(saleId, name, phone, location, plan, amount) {
  const depId = generateId('deployment', 'DEP');
  db.prepare(`
    INSERT INTO deployments (id, sale_id, customer_name, phone, location, plan, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Awaiting Splicing')
  `).run(depId, saleId, name, phone || '', location, plan, amount);
}

export default router;