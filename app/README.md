# P001 Bakso POS MVP

Local-only Node.js + SQLite foundation for POS/admin + website catalog sync.

## Current status

This milestone is intentionally small but runnable:
- SQLite schema + dev seed data
- local Express server
- public catalog API
- admin product list API
- basic dashboard summary API
- static `site/` served from the same local server

No production deploy and no public port exposure.

## Setup

```bash
cd /home/synner/.openclaw/workspace/pos-integration-landing-page/app
cp .env.example .env
npm install
npm run check
npm start
```

Server binds to `127.0.0.1` only.

## Default local data

Seeded users:
- `admin` / `admin123`
- `cashier` / `admin123`

Seeded catalog:
- Bakso Original
- Bakso Urat
- Mie Ayam

SQLite file is created at `app/data/dev.sqlite` by default.

## Endpoints

- `GET /api/health`
- `GET /api/catalog/products`
- `GET /api/admin/products`
- `GET /api/admin/dashboard`

## Notes

- Website catalog should only expose stock status: `available` / `out_of_stock`.
- Raw stock quantity is kept for admin/POS use only.
- This is still a prototype foundation, not full cashier workflow yet.
