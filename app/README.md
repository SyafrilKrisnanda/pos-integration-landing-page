# Groceries POS MVP

Local-only Node.js + SQLite foundation for POS/admin + website catalog sync.

## Current status

This milestone is intentionally small but runnable:
- SQLite schema + dev seed data
- local Express server bound to `127.0.0.1`
- session login/logout with owner/admin role guard
- public catalog API that hides inactive and out-of-stock products
- product master + SKU/variant schema (`product_masters`, `product_skus`)
- owner/admin CRUD APIs for categories, product masters, and SKUs
- unique SKU barcode enforcement
- stock quantity updates in product base unit with audit history
- basic dashboard summary API
- static `site/` catalog plus minimal local admin and cashier UIs served from the same local server

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
- Local cashier: <http://127.0.0.1:8790/cashier.html>

Login with `admin` / `admin123`, then create/edit categories, create/edit product masters, add SKUs/variants, set base-unit stock, and verify inactive products/SKUs or unsellable stock disappear from the public catalog. Login with `cashier` / `admin123` to scan/search SKU variants, build a cart, checkout, and view the receipt summary.

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
- `PUT`/`PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id` (soft-disable)
- `GET /api/admin/products/:id/skus`
- `POST /api/admin/products/:id/skus`
- `PUT`/`PATCH /api/admin/skus/:id`
- `DELETE /api/admin/skus/:id` (soft-disable)
- `POST`/`PATCH /api/admin/products/:id/stock`
- `GET /api/admin/stock-audits`

Cashier/POS:
- `GET /api/cashier/products/search?barcode=...`
- `GET /api/cashier/products/search?q=...`
- `POST /api/cashier/checkout`

## Notes

- Website catalog only exposes active product masters with at least one sellable active SKU; raw stock quantity is kept for admin/POS use only.
- Stock is stored once per product master in `base_unit`; selling a SKU consumes `conversion_qty * quantity_sold`.
- Legacy `products` rows are retained and mirrored for compatibility during the transition.
- Admin deletes are intentionally soft-disables for safer local prototyping.
- Sessions use the dev secret from `.env`; change it before any non-dev use.
