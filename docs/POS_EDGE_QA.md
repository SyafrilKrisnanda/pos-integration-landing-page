# POS integration edge-case QA

## Scope

Smoke coverage for the V1 POS + website catalog integration. These checks are intentionally local-only and must not open public ports or deploy anything.

## Automated smoke tests

Scripts:

- `app/scripts/smoke-pos-edge-cases.mjs` — current V1 POS/catalog edge cases.
- `app/scripts/smoke-sku-foundation.mjs` — Slice A product-master + SKU foundation coverage.
- `app/scripts/smoke-cashier-variants.mjs` — cashier SKU checkout/conversion coverage, including seeded Baterai AAA variant consistency and receipt summary labels.

Run from the app directory:

```bash
cd /home/synner/.openclaw/workspace/pos-integration-landing-page/app
npm run check
npm run smoke:pos
npm run smoke:sku-foundation
npm run smoke:cashier-variants
```

Optional: run against an already-running local server:

```bash
cd /home/synner/.openclaw/workspace/pos-integration-landing-page/app
BASE_URL=http://127.0.0.1:8790 npm run smoke:pos
BASE_URL=http://127.0.0.1:8790 npm run smoke:sku-foundation
BASE_URL=http://127.0.0.1:8790 npm run smoke:cashier-variants
```

By default each smoke script starts `src/server.js` on `127.0.0.1` with a temporary SQLite database, runs the checks, then stops the child server.

## Expected API contract under test

The smoke script covers this local-only sprint contract:

- `POST /api/auth/login`
- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `POST /api/admin/products/:id/stock`
- `GET /api/admin/stock-audits`
- `GET /api/catalog/products`

Slice A SKU foundation contract under test:

- Migrated/admin products expose `baseUnit`/`base_unit`.
- Each migrated product has at least one default SKU at `GET /api/admin/products/:id/skus`.
- `POST /api/admin/products` creates a product master with base-unit stock.
- `POST /api/admin/products/:id/skus` creates sellable SKUs.
- `PATCH` or `PUT /api/admin/skus/:id` updates SKU fields.
- `DELETE /api/admin/skus/:id` soft-disables a SKU.
- `PATCH` or `POST /api/admin/products/:id/stock` updates product-master stock in base units.
- Public catalog never leaks raw stock quantity.

If endpoint names change, update the smoke script before treating failures as product bugs.

## Edge-case checklist

### Auth and roles

- [x] Unauthenticated users receive `401` or `403` for admin APIs.
- [x] Seeded/admin owner credentials can log in and receive a session cookie.
- [x] Seeded cashier credentials can log in and receive a session cookie.
- [x] Bad password is rejected.
- [x] Cashier role cannot list/create owner/admin products.
- [x] Owner/admin role can manage products and stock.

### Barcode uniqueness

- [x] Product create accepts a valid new barcode.
- [x] Duplicate barcode is rejected with `400`.
- [x] Duplicate rejection is enforced by DB uniqueness and API error mapping.
- [x] Catalog/admin barcode handling is unambiguous.

### Product active/inactive behavior

- [x] Active in-stock product appears in public catalog.
- [x] Inactive product is hidden from public catalog.
- [x] Re-activating a product restores catalog behavior according to stock.

### Stock updates

- [x] Owner/admin can set stock to `0`.
- [x] Owner/admin can restock above `0`.
- [x] Stock changes write audit entries with previous/new quantity.
- [x] Dashboard out-of-stock/low-stock totals are available to owner/admin.

### Catalog availability and security

- [x] Public catalog returns only active products with stock `> 0`.
- [x] Public catalog maps visible products to `available`.
- [x] Public catalog hides inactive and out-of-stock products.
- [x] Public catalog never exposes raw stock quantity (`quantity`, `stockQty`, etc.).
- [x] Admin/POS APIs expose exact quantity only to authorized owner/admin role.

## Additional retail edge cases to add in the next QA pass

### Product master + SKU foundation — Slice A

- [x] Migration creates product masters from seeded/current products. Covered by `npm run smoke:sku-foundation`.
- [x] Migration creates one default SKU per product master. Covered by `npm run smoke:sku-foundation`.
- [x] Product master stores `baseUnit`/`base_unit`. Covered by `npm run smoke:sku-foundation`.
- [x] Product-master stock is stored/updated in base units. Covered by `npm run smoke:sku-foundation`.
- [x] One product master can have multiple active SKUs. Covered by `npm run smoke:sku-foundation`.
- [x] Admin can create/list/update/soft-disable SKUs. Covered by `npm run smoke:sku-foundation`.
- [x] Duplicate barcode across SKUs is rejected. Covered by `npm run smoke:sku-foundation`.
- [x] Inactive SKU is hidden from public catalog. Covered by `npm run smoke:sku-foundation`.

### Mixed-unit / SKU conversion — Slice B+

- [x] Seeded Baterai AAA exposes `Ecer` (1 pcs) and `Pack 4` (4 pcs) consistently in admin and cashier search. Covered by `npm run smoke:cashier-variants`.
- [x] One SKU sale can decrement more than 1 base unit. Covered by `npm run smoke:cashier-variants`.
- [x] If stock is enough for `ecer` but not enough for `pack`, only the `pack` SKU is blocked. Covered by `npm run smoke:cashier-variants`.
- [x] Inactive SKU is hidden from cashier search. Covered by `npm run smoke:cashier-variants`.

### Checkout integrity

- [x] Multi-item checkout is atomic: all line items succeed or all fail. Covered by `npm run smoke:cashier-variants`.
- [ ] UI double-submit guard disables checkout/cart controls while checkout is in flight.
- [ ] Backend double-submit idempotency does not create duplicate transactions for the same client request.
- [ ] Concurrent checkout on the same base stock does not create negative inventory under a stress test.
- [ ] Insufficient-stock error names the affected product/SKU for cashier recovery.
- [x] Receipt response includes transaction id, payment method, total label, item display names, unit labels, quantity sold, subtotal labels, and base-unit consumption. Covered by `npm run smoke:cashier-variants`.
- [ ] Receipt UI includes store/test label, cashier/payment context, transaction date/id, and print/share affordance for local testing.
- [x] Transaction item stores price snapshot and conversion snapshot. Covered directly through local SQLite inspection in `npm run smoke:cashier-variants`; direct transaction-item read API is not exposed yet.

### Catalog policy clarity

- [ ] Active product with stock `0` is shown as `out_of_stock` if that policy remains approved.
- [ ] Inactive product is hidden entirely.
- [ ] Public catalog never leaks base-unit stock quantity even with multiple SKUs.

### Cashier speed and admin usability — local test readiness

- [ ] Barcode/search input refocuses after add and checkout.
- [ ] Search field clears after a successful barcode add.
- [ ] Cashier can set quantity quickly without repeated `+`/`−` clicks.
- [ ] Cash payments can capture tendered amount and change due, or this is explicitly deferred for the tester.
- [ ] Admin product form explains base unit vs sell unit vs conversion quantity with a concrete pack/ecer example.
- [ ] Admin UI supports editing an existing SKU, not only add/soft-disable.
- [ ] Checkout stock movements are visible in audit/ledger view, or transaction history is accepted as the temporary audit source.

## Current known result

As of the 2026-05-31 sprint, auth/role guard, owner/admin category/product mutation, unique barcode checks, stock audit for manual adjustments, public catalog visibility rules, SKU foundation, seeded Baterai AAA variant behavior, receipt summary data, and cashier SKU checkout/conversion basics have landed. Remaining QA/product gaps: UI double-submit guard, backend idempotency, concurrent checkout/no-negative-stock stress coverage, cashier-friendly stock errors, receipt print/store context, cash tender/change, faster cashier focus/quantity flow, SKU edit UI, and clearer admin base-unit helper copy.
