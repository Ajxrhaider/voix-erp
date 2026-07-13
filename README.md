# Voix ERP

A comprehensive Enterprise Resource Planning system for network operations, featuring integrated CRM, Inventory, Accounting, and Field Crew management.

## 🛠 Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT-based authentication

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install

Run the Application:
This project uses concurrently to run the frontend and backend simultaneously.

Bash
npm start
📂 Project Structure
/src/components/: Modular UI components organized by domain (Accounting, Auth, CRM, NOC).

/src/context/: Global state management (AppContext.jsx).

server.js: API routes and database orchestration.

db.js: Database schema and SQLite connection setup.

🏗 Key Modules
CRM: Customer profiles, interaction logging, and ticketing.

NOC: Dispatch, work orders, and inventory tracking.

Accounting: Expense requisitions and staff payroll management.