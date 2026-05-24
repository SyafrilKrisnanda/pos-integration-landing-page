# P001 Bakso Pak Budi POS MVP

Local-only Node.js + PostgreSQL POS/admin backend for Phase 2.

## Current status

Scaffolded for local development. PostgreSQL is required before running with real data.
No deployment/public port is configured.

## Setup later

```bash
cd /home/synner/.openclaw/workspace/projects/P001-bakso-pak-budi/app
cp .env.example .env
npm install
npm run check
npm start
```

Docker local PostgreSQL option:

```bash
docker compose up -d postgres
npm start
```

The compose file binds PostgreSQL to `127.0.0.1:5432` only and auto-runs `db/schema.sql` on first initialization.

Default local dev login after startup:

- username: `admin`
- password: `admin123`

Before production, change `.env` secrets and passwords.

## Pages

- `/` public menu
- `/admin` admin dashboard/menu management
- `/pos` cashier POS screen

## API

- `GET /api/menus`
- `POST /api/admin/menus`
- `PATCH /api/admin/menus/:id`
- `POST /api/admin/sales`
- `GET /api/admin/dashboard`
