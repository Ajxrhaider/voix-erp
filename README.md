# Voix ERP

Voix ERP brings customer accounts, subscriptions, service queries, deployments, and accounting records into one application.

## Stack

- **Frontend:** React, Vite, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express, Socket.IO, SQLite (`better-sqlite3`)
- **Authentication:** JWT and bcrypt

## Local development

```bash
npm ci
cp .env.example .env
npm run dev
```

The client runs on `http://localhost:5173`; Vite proxies `/api` and Socket.IO to the local API on port `5000`. The Vite build is produced in the repository `dist/` folder:

```bash
npm run build
npm run preview
npm test
```

The importer and end-to-end workflow tests use temporary SQLite databases and do not touch the configured or production database.

In local development, the first empty database is seeded with `admin` / `admin123`. Change that password immediately. Production startup requires a private `JWT_SECRET` and, when the database is empty, an `INITIAL_ADMIN_PASSWORD` so the published default credentials are never used.

## Deployment settings

### Vercel frontend

- Project root: repository root
- Build command: `npm run build`
- Output directory: `dist`
- `VITE_API_URL`: `https://voix-erp.onrender.com` (or the URL of the API service)

`vercel.json` includes the SPA fallback so refreshing a customer or module route serves the app. The production frontend defaults to the Render URL if `VITE_API_URL` is omitted; it never falls back to browser `localhost`.

### Render API

- Build command: `npm ci`
- Start command: `npm start`
- Set `NODE_ENV=production`, `JWT_SECRET` to a unique secret, `FRONTEND_URL` to the Vercel origin, and `PAYMENT_DUE_NOTICE_DAYS` to the desired reminder window (defaults to 7 days).
- Set `INITIAL_ADMIN_PASSWORD` before the first start if the database is empty; then change it through the account controls.
- `DB_PATH` can point SQLite at a mounted persistent disk, for example `/var/data/voix_erp_production.db`.

**Persistence warning:** SQLite is a local file. Render free web services use ephemeral storage, so data can be lost on a restart or redeploy. Treat the free-tier setup as a test system only; before storing production customer/payment data, move SQLite onto a persistent disk on a plan that supports it or migrate the backend to a managed persistent database. Keep regular encrypted backups and do not commit customer spreadsheets or database files to Git.

## Customer records and payment reminders

Customer profiles contain contact and network details, account status, service plan, billing schedule, amount payable/paid, bank received, last/next payment dates, outstanding balance, deployments, linked query/ticket history, and payment/accounting history. Recording a subscription payment writes the ledger entry and updates the customer account in one database transaction.

The notification bell shows in-app payment alerts. Active accounts due within the configured notice window, due today, or overdue are sent to Customer Service, Accounting, and management users. The reminder check runs at API startup and every six hours, and is also refreshed when a user opens notifications so sleeping free instances catch up.

## Importing the legacy sheets

In **Customer Profiles**, choose **Import legacy sheets** and select one or more exports. Supported files are `.csv`, `.xlsx`, `.xls`, and the HTML income day-book export. The header-based importer recognizes:

- Customer/client profiles and enterprise account lists, including legacy `Name` / `VoixNumber` and `ClientName` / `Plan` layouts and monthly payment columns
- Query sheets with VNQ/ticket references and date fields, as well as older `Issue` / `Status` lists; rows are imported as tickets
- Deployment sheets with VND references and older `Customer` / `Location` / `Status` layouts
- Day-book expenses using `Particulars`, `Date`, and `Amount` or `Total Amount`
- Income day books in spreadsheet form and the embedded HTML export

Customer rows are merged by Voix Number/customer ID (or by name when an ID is absent), and payments, queries, and deployments are linked to profiles where a reliable match exists. Original VNQ and VND references are retained. When a legacy row has no reference or voucher, the importer generates a repeatable reference from its source file name, sheet, and row. Re-uploading the same source updates matching records rather than duplicating them. Monthly payment columns are stored as month-level ledger totals because those sheets do not provide exact payment dates or references. Queries without a customer match are kept as unlinked tickets. Blank templates and PDFs are not imported as data; use the in-app Customer Care and Fiber reporting forms for new reports.

No legacy source workbook is included in this repository, so the importer has not been validated against a supplied archive. Review the per-file import report and test with a **non-production database copy** before a live batch. Import only original, trusted files and keep source spreadsheets private: they contain personal and payment information. Download a database backup before the first import and after each migration batch.

## Core workflows

- **CRM:** Sales captures the FTTH or Enterprise customer type and contact details → Closing/Won creates a deployment → provisioning completion creates/updates the customer profile. Completing a deployment records its initial payment as an installation-income entry on that customer's payment history and accounting ledger, and updates the profile's latest-payment summary. Completion is safe to retry without duplicating the payment.
- **Support:** Customer Service or NOC logs a query → Fiber work order → resolution and closure.
- **Financials:** Customer payment → linked customer history and accounting ledger; requisitions and operating expenses flow through accounting.
- **Field operations:** Deployment/work order → team assignment → materials → fulfillment and inventory reconciliation.
