import db from './db.js';
// --- DATABASE INITIAL SEEDER ---
(async () => {
  try {
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      db.prepare("INSERT INTO users (id, username, password, role, fullname) VALUES (?, ?, ?, ?, ?)")
        .run("EMP-000", "admin", hashedPassword, "Management", "System Administrator");
      console.log("Database initialized: Created default admin account (username: admin, pass: admin123)");
    }
  } catch (err) {
    console.error("Database seeding error:", err.message);
  }
})();
import bcrypt from 'bcryptjs';

try {
  const passwordHash = bcrypt.hashSync('VoixAdmin2026!', 10);
  
  const insertUser = db.prepare(`
    INSERT INTO staff (id, name, email, password_hash, role) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  insertUser.run('EMP-000', 'Master Admin', 'admin@voix.ng', passwordHash, 'Dev');
  
  console.log('✅ Success: Initial Admin created!');
  console.log('Email: admin@voix.ng');
  console.log('Password: VoixAdmin2026!');
} catch (err) {
  if (err.message.includes('UNIQUE constraint failed')) {
    console.log('⚠️ Admin user already exists in the database.');
  } else {
    console.error('Error seeding database:', err);
  }
}
