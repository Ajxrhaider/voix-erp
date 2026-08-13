import db from '../db.js';

export const updateSaleStage = (req, res) => {
  const { id } = req.params;
  const { stage } = req.body;
  const io = req.app.get('socketio');

  try {
    const updateSale = db.prepare('UPDATE sales SET stage = ? WHERE id = ?');
    updateSale.run(stage, id);

    // AUTOMATION 1: If Sale goes to 'Closing', create a Deployment and add Income
    if (stage === 'Closing') {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
      
      const insertDeployment = db.prepare(`
        INSERT INTO deployments (sales_id, customer_name, location) 
        VALUES (?, ?, ?)
      `);
      insertDeployment.run(sale.id, sale.lead_name, 'Pending Location Data');

      const insertIncome = db.prepare(`
        INSERT INTO ledger (type, amount, description) 
        VALUES ('Income', ?, ?)
      `);
      // Assuming a flat installation fee for demo purposes; this would map to proposed_plan cost
      insertIncome.run(50000, `Closed Sale Installation: ${sale.lead_name}`);
      
      io.emit('deployment_created', { message: 'New deployment generated from closed sale.' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const completeDeployment = (req, res) => {
  const { id } = req.params;
  const { mac_address, voix_number, service_type } = req.body; // Sent from frontend form
  const io = req.app.get('socketio');

  try {
    // Wrap in a transaction to ensure both deployment completes and profile is created
    const transaction = db.transaction(() => {
      db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('Completed', id);
      const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(id);

      // AUTOMATION 2: Create Customer Profile from Completed Deployment
      const createCustomer = db.prepare(`
        INSERT INTO customers (name, voix_number, mac_address, service_type)
        VALUES (?, ?, ?, ?)
      `);
      createCustomer.run(deployment.customer_name, voix_number, mac_address, service_type);
    });

    transaction();
    io.emit('customer_created', { message: 'New customer provisioned successfully.' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};