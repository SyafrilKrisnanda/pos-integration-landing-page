# Implementation Plan — Product Master + SKU/Variant Retail Model

## Goal

Upgrade the current V1 POS model from:
- `1 product = 1 sellable unit`

into:
- `1 product master = many sellable SKUs/variants`

So cases like:
- `Baterai AAA - Ecer`
- `Baterai AAA - Pack 4`

can work cleanly without breaking stock, cashier flow, or reports.

---

## Phase 0 — Lock business rules first

Before coding, confirm these decisions:

1. **Stock source of truth**
   - Stock stored only in `base_unit`
   - Example: `pcs`

2. **Variant sellability**
   - SKU is sellable only if:
     - product master active
     - SKU active
     - base stock >= `conversion_qty`

3. **Barcode policy**
   - Barcode unique per SKU
   - Barcode nullable if manual search allowed

4. **Catalog policy**
   - Inactive product hidden
   - Active product with no sellable SKU shown as `out_of_stock`

5. **V1 exclusions**
   - No return/void yet
   - No discount engine yet
   - No image upload yet

---

## Phase 1 — Schema changes

## New tables

### `product_masters`
Fields:
- `id`
- `name`
- `category_id`
- `description`
- `base_unit`
- `active`
- `created_at`
- `updated_at`

### `product_skus`
Fields:
- `id`
- `product_id`
- `name`
- `barcode`
- `sell_unit`
- `conversion_qty`
- `price`
- `active`
- `created_at`
- `updated_at`

### `stocks`
Change meaning:
- one row per `product_master`
- quantity stored in `base_unit`

### `stock_audits`
Keep, but point to `product_master`
- optional future field: `sku_id` when stock change is triggered by a variant-specific operation

### `transaction_items`
Extend to snapshot variant info:
- `product_id`
- `sku_id`
- `sku_name_snapshot`
- `sell_unit_snapshot`
- `conversion_qty_snapshot`
- `quantity_sold`
- `unit_price`
- `subtotal`

---

## Phase 2 — Data migration strategy

For existing rows in current `products` table:

1. Create one `product_master` from each current product row
2. Create one default SKU for each migrated product:
   - SKU name = `Default`
   - sell_unit = current `unit`
   - conversion_qty = `1`
   - price = current `price`
   - barcode = current `barcode`
3. Move existing stock row to the new master product stock
4. Keep old transaction data readable if migration is partial

Safe migration rule:
- do not delete old columns/tables until read/write path is fully switched

---

## Phase 3 — Backend/API changes

## Admin APIs

### Product master
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id` (soft disable)

### SKU APIs
- `GET /api/admin/products/:id/skus`
- `POST /api/admin/products/:id/skus`
- `PATCH /api/admin/skus/:id`
- `DELETE /api/admin/skus/:id` (soft disable)

### Stock APIs
- `PATCH /api/admin/products/:id/stock`
- reason required: `restock`, `correction`, `initial`, or free text for V1

## Cashier APIs
- `GET /api/cashier/products/search?barcode=...`
  - returns sellable SKU, not just master product
- `GET /api/cashier/products/search?q=...`
  - manual search by name/SKU
- `POST /api/cashier/checkout`
  - each line item references `sku_id`
  - stock decrement uses `conversion_qty * quantity_sold`
  - must be atomic

## Catalog APIs
- `GET /api/catalog/products`
  - return product cards based on master product
  - stockStatus derived from sellable SKUs
  - no raw quantity leak

---

## Phase 4 — Admin UI impact

## Current admin form split

Replace single product form with:

### A. Product master form
- name
- category
- description
- base unit
- active

### B. SKU management under each product
- variant name
- barcode
- sell unit
- conversion qty
- price
- active

### C. Stock update panel
- current base stock
- new stock qty
- reason

Why split it:
- product master and sellable SKU are different concerns
- avoids confusion like “is this stock for ecer or pack?”

---

## Phase 5 — Cashier UI impact

Cashier should:

1. scan barcode → find exact SKU
2. search manually → show sellable SKUs
3. add SKU to cart
4. validate stock on add and on checkout
5. show receipt with:
   - product name
   - SKU name
   - quantity sold
   - sell unit
   - unit price
   - subtotal

Example cart row:
- `Baterai AAA - Pack 4`
- qty `2`
- conversion `4`
- total base-unit consumption = `8 pcs`

---

## Phase 6 — Dashboard/report impact

Minimum dashboard changes:
- total sales
- transaction count
- low stock based on base stock
- top selling SKU
- optional: aggregate by product master

Important:
- reports should use transaction snapshots, not current SKU price

---

## Phase 7 — QA updates

Gary should add tests for:

1. **Variant availability**
   - stock enough for ecer but not enough for pack
2. **Barcode uniqueness per SKU**
3. **Atomic checkout**
4. **Concurrent checkout no negative stock**
5. **Inactive SKU hidden from cashier/catalog**
6. **Inactive master hides all SKUs**
7. **Price snapshot preserved after future edits**
8. **Catalog still does not leak raw stock**

---

## Suggested execution order

1. Lock policy decisions
2. Add new schema behind current system
3. Migrate sample/dev data
4. Add admin SKU endpoints
5. Add cashier SKU search + checkout changes
6. Update admin UI
7. Update catalog mapping
8. Run QA + smoke tests
9. Remove/retire old single-product assumptions

---

## Recommendation

Best next implementation slice:

### Slice A — foundation first
- schema
- migration
- admin SKU CRUD
- stock in base unit

### Slice B — cashier compatibility
- barcode search by SKU
- cart + checkout conversion logic

### Slice C — reporting/catalog cleanup
- catalog availability from SKUs
- dashboard/report adjustments

This is safer than trying to rewrite everything in one jump.
