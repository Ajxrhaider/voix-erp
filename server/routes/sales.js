import express from 'express';
import db, { generateId } from '../db.js';
import { authenticateToken, requireRoles } from './auth.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();
const SALES_STAGES = ['Lead', 'Qualification', 'Proposal', 'Negotiation', 'Closing/Won', 'Lost'];
const CUSTOMER_TYPES = new Set(['FTTH', 'Enterprise']);
const TERMINAL_STAGES = new Set(['Closing/Won', 'Lost']);

function createDeploymentFromSale(sale) {
  const depId = generateId('deployment', 'DEP');
  const paymentDate = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO deployments (
      id, sale_id, customer_name, customer_type, email, phone, location, plan, amount,
      payment_mode, status, date_of_payment, sales_made_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Bank Transfer', 'Awaiting Splicing', ?, ?)
  `).run(
    depId,
    sale.id,
    sale.customer_name,
    sale.customer_type || 'FTTH',
    sale.contact_email || '',
    sale.contact_phone || '',
    sale.location,
    sale.proposed_plan,
    sale.amount,
    paymentDate,
    sale.sales_rep_id || ''
  );
  return depId;
}

function notifyDeploymentQueued(sale, io) {
  const hods = db.prepare(`
    SELECT id, email FROM users
    WHERE roles LIKE '%"HOD Fiber"%' OR roles LIKE '%"HOD NOC"%'
  `).all();
  const emails = hods.filter((hod) => hod.email).map((hod) => hod.email).join(',');

  for (const hod of hods) {
    db.prepare(`INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'Deployment')`)
      .run(hod.id, 'New Deployment Auto-Queued', `Deal closed for ${sale.customer_name}. Provisioning required.`);
  }

  if (emails) {
    sendEmail(
      emails,
      'New Automated Deployment',
      `Sales deal won for ${sale.customer_name} at ${sale.location}. A new deployment has been automatically queued for provisioning.`
    );
  }
  io?.emit('erp-data-changed');
}

router.get('/pipeline', authenticateToken, (_req, res) => {
  res.json(db.prepare('SELECT * FROM sales_pipeline ORDER BY created_at DESC').all());
});

router.post('/pipeline', authenticateToken, requireRoles(['Sales', 'Management', 'GM', 'Dev']), (req, res) => {
  const customerName = String(req.body.customer_name || '').trim();
  const customerType = String(req.body.customer_type || 'FTTH').trim();
  const contactEmail = String(req.body.contact_email || '').trim();
  const contactPhone = String(req.body.contact_phone || '').trim();
  const location = String(req.body.location || '').trim();
  const proposedPlan = String(req.body.proposed_plan || '').trim();
  const amount = Number(String(req.body.amount ?? '').replace(/[₦,$,\s]/g, ''));
  const stage = req.body.stage || 'Lead';

  if (!customerName || !location || !proposedPlan) {
    return res.status(400).json({ message: 'Customer name, location, and proposed plan are required.' });
  }
  if (!CUSTOMER_TYPES.has(customerType)) {
    return res.status(400).json({ message: 'Choose FTTH or Enterprise as the customer type.' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Expected deal value must be greater than zero.' });
  }
  if (!SALES_STAGES.includes(stage)) {
    return res.status(400).json({ message: 'Select a valid sales stage.' });
  }

  try {
    const createSale = db.transaction(() => {
      const saleId = generateId('sale', 'SALE');
      db.prepare(`
        INSERT INTO sales_pipeline (
          id, customer_name, customer_type, contact_email, contact_phone, location,
          survey_details, proposed_plan, amount, stage, sales_rep_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId,
        customerName,
        customerType,
        contactEmail,
        contactPhone,
        location,
        String(req.body.survey_details || '').trim() || 'Optical survey pending',
        proposedPlan,
        amount,
        stage,
        req.user.id
      );

      const sale = db.prepare('SELECT * FROM sales_pipeline WHERE id = ?').get(saleId);
      const deploymentId = stage === 'Closing/Won' ? createDeploymentFromSale(sale) : null;
      return { sale, deploymentId };
    });

    const { sale, deploymentId } = createSale();
    if (deploymentId) notifyDeploymentQueued(sale, req.io);
    req.io?.emit('erp-data-changed');
    res.status(201).json({ id: sale.id, deployment_id: deploymentId });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The sales lead could not be saved because a linked record is invalid.' });
    }
    console.error('Sales lead creation failed:', error.message);
    res.status(500).json({ message: 'The sales lead could not be saved.' });
  }
});

router.patch('/pipeline/:id/stage', authenticateToken, requireRoles(['Sales', 'Management', 'GM', 'Dev']), (req, res) => {
  const { stage } = req.body;
  if (!SALES_STAGES.includes(stage)) {
    return res.status(400).json({ message: 'Select a valid sales stage.' });
  }

  try {
    const updateStage = db.transaction(() => {
      const sale = db.prepare('SELECT * FROM sales_pipeline WHERE id = ?').get(req.params.id);
      if (!sale) return { notFound: true };
      if (TERMINAL_STAGES.has(sale.stage) && sale.stage !== stage) {
        return { conflict: true, currentStage: sale.stage };
      }

      if (sale.stage !== stage) {
        db.prepare('UPDATE sales_pipeline SET stage = ? WHERE id = ?').run(stage, sale.id);
        sale.stage = stage;
      }

      let deploymentId = null;
      let createdDeployment = false;
      if (stage === 'Closing/Won') {
        const existingDeployment = db.prepare('SELECT id FROM deployments WHERE sale_id = ?').get(sale.id);
        if (existingDeployment) {
          deploymentId = existingDeployment.id;
        } else {
          deploymentId = createDeploymentFromSale(sale);
          createdDeployment = true;
        }
      }
      return { sale, deploymentId, createdDeployment };
    });

    const result = updateStage();
    if (result.notFound) return res.status(404).json({ message: 'Deal not found.' });
    if (result.conflict) {
      return res.status(409).json({ message: `A deal marked ${result.currentStage} cannot be moved to another stage.` });
    }

    if (result.createdDeployment) notifyDeploymentQueued(result.sale, req.io);
    req.io?.emit('erp-data-changed');
    res.json({ message: `Deal advanced to ${stage}.`, deployment_id: result.deploymentId });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'The deal stage could not be saved because a linked record is invalid.' });
    }
    console.error('Sales stage update failed:', error.message);
    res.status(500).json({ message: 'The deal stage could not be saved.' });
  }
});

export default router;
