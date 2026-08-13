# Voix ERP Production System

Enterprise Resource Planning platform for ISP infrastructure management.

## Stack
- **Frontend**: React, Vite, Tailwind CSS, Lucide React, Socket.io
- **Backend**: Node.js, Express, better-sqlite3 (SQLite)
- **Security**: JWT Authentication, Bcrypt, Middleware-based role access control

## Architecture
- `server/`: Express API engine.
- `client/`: React SPA with context-based state management.
- `db/`: SQLite instance (`voix_erp_production.db`).

## Setup
1. **Server**: `cd server && npm install && npm run dev`
2. **Client**: `cd client && npm install && npm run dev`

## Key Operations
- **CRM Pipeline**: Sales → Closing → Deployment → Customer Profile.
- **Field Ops**: Tickets → Team Assignment → Work Orders → Materials Allocation → Completion (Inventory Reconciliation).
- **Financials**: Requisitions (Cash/Materials) → Manager Review → Accounting Ledger.

## Role Matrices
- **HR/GM**: Full access, staff creation.
- **Accounting**: Inventory management, requisition approvals.
- **NOC/Fiber**: Ticket management, field reporting.