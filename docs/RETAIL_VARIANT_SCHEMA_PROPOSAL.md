# Retail Variant / SKU Schema Proposal

## Why

Current V1 model assumes 1 product = 1 sellable unit. That breaks for retail cases like:
- `Baterai AAA` sold as **ecer** and **pack 4**
- the same item having different barcode, price, and stock conversion per sellable form

## Proposed model

### 1) Product master
Represents the core item identity.

Fields:
- `id`
- `name`
- `category_id`
- `description`
- `base_unit` — smallest stock unit, e.g. `pcs`
- `active`

Example:
- `Baterai AAA`
- `base_unit = pcs`

### 2) Product SKU / variant
Represents what cashier actually sells/scans.

Fields:
- `id`
- `product_id`
- `name` — e.g. `Ecer`, `Pack 4`
- `barcode` — unique per SKU, nullable if manual search allowed
- `sell_unit` — e.g. `pcs`, `pack`
- `conversion_qty` — how many `base_unit` are consumed by selling 1 SKU
- `price`
- `active`
- `image_url` / `image_path` — optional future field

Example:
- SKU A: `Ecer`, `sell_unit=pcs`, `conversion_qty=1`, `price=3000`
- SKU B: `Pack 4`, `sell_unit=pack`, `conversion_qty=4`, `price=10000`

### 3) Stock
Stock stored only at product master level in `base_unit`.

Fields:
- `product_id`
- `quantity_base`
- `last_updated_by`
- `last_updated_at`

Example:
- master stock = `10 pcs`
- sell `1 pack 4` => stock becomes `6 pcs`
- sell `2 ecer` => stock becomes `4 pcs`

### 4) Transaction items
Transaction should snapshot the sold SKU and conversion at transaction time.

Fields:
- `transaction_id`
- `sku_id`
- `product_id`
- `sku_name_snapshot`
- `sell_unit_snapshot`
- `conversion_qty_snapshot`
- `quantity_sold`
- `unit_price`
- `subtotal`

## Validation rules

- `barcode` unique per SKU.
- `conversion_qty >= 1`.
- checkout must be atomic.
- stock must never go negative.
- inactive SKU cannot be sold.
- inactive product hides all SKUs from public catalog.
- if remaining stock is below a SKU conversion, that SKU is unavailable even if smaller SKU still sellable.

## Public catalog rules

Recommended:
- show only active products/SKUs
- public stock remains status-only:
  - `available` if at least one active sellable SKU can be fulfilled
  - `out_of_stock` otherwise
- never expose raw stock quantity

## Migration note

Safe rollout order:
1. add product master + SKU tables
2. migrate current `products` rows into master+default SKU
3. move stock semantics to base unit
4. update cashier flow first
5. update admin forms second
6. update catalog mapping last

## Explicit out-of-scope unless approved

- bundle pricing logic
- promo/discount engine
- returns/void with reverse conversion
- multi-warehouse stock
