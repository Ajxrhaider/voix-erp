import xlsx from 'xlsx';
import db from '../db.js';

// Requires multer middleware on the route: upload.single('file')
export const importData = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  const filename = req.file.originalname;

  try {
    const transaction = db.transaction(() => {
      // Map based on the verbatim file names requested
      if (filename === 'Profiles.xlsx') {
        const stmt = db.prepare('INSERT INTO customers (name, voix_number, mac_address, service_type) VALUES (?, ?, ?, ?)');
        data.forEach(row => stmt.run(row.Name, row.VoixNumber, row.MAC, row.ServiceType));
      } 
      else if (filename === 'Clients.xlsx') {
        // Maps to Sales/Subscriptions
        const stmt = db.prepare('INSERT INTO sales (lead_name, proposed_plan, stage) VALUES (?, ?, ?)');
        data.forEach(row => stmt.run(row.ClientName, row.Plan, 'Closing'));
      }
      else if (filename === 'Deployment.xlsx') {
        const stmt = db.prepare('INSERT INTO deployments (customer_name, location, status) VALUES (?, ?, ?)');
        data.forEach(row => stmt.run(row.Customer, row.Location, row.Status));
      }
      else if (filename === 'Queries.xlsx') {
        const stmt = db.prepare('INSERT INTO queries (description, status) VALUES (?, ?)');
        data.forEach(row => stmt.run(row.Issue, row.Status));
      }
    });

    transaction();
    res.status(200).json({ success: true, rowsImported: data.length });
  } catch (err) {
    res.status(500).json({ error: 'Data import failed: ' + err.message });
  }
};