# Groceries POS MVP

Local-only Node.js + SQLite foundation for POS/admin + website catalog sync.

## Current status

This milestone is intentionally small but runnable:
- SQLite schema + dev seed data
- local Express server bound to `127.0.0.1`
- session login/logout with owner/admin role guard
- public catalog API that hides inactive and out-of-stock products
- owner/admin CRUD APIs for categories and products
- unique product barcode enforcement
- stock quantity updates with audit history
- basic dashboard summary API
- static `site/` catalog and minimal `site/admin.html` UI served from the same local server

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

Seeded catalog (groceries examples):
- Beras Premium 5kg
- Minyak Goreng 1L
- Gula Pasir 1kg
- Air Mineral 600ml

SQLite file is created at `app/data/dev.sqlite` by default.

## Manual test

```bash
cd /home/synner/.openclaw/workspace/pos-integration-landing-page/app
npm run check
npm start
```

Open:
- Catalog: <http://127.0.0.1:8790/>
- Local admin: <http://127.0.0.1:8790/admin.html>

Login with `admin` / `admin123`, then create/edit categories, create/edit products, set stock, and verify products with `active = false` or `quantity = 0` disappear from the public catalog.

## Endpoints

Public:
- `GET /api/health`
- `GET /api/catalog/products`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Owner/admin only:
- `GET /api/admin/dashboard`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id` (soft-disable)
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id` (soft-disable)
- `POST /api/admin/products/:id/stock`
- `GET /api/admin/stock-audits`

## Notes

- Website catalog only exposes products that are active and in stock; raw stock quantity is kept for admin/POS use only.
- Admin deletes are intentionally soft-disables for safer local prototyping.
- Sessions use the dev secret from `.env`; change it before any non-dev use.
- This is still a prototype foundation, not full cashier workflow yet.
