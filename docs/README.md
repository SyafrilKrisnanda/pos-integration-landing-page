# Docs Index

## Slice A — Product Master + SKU/Variant Foundation

Implemented in the local `app/` prototype:

- New product-master/SKU schema:
  - `product_masters` stores shared product data and `base_unit`.
  - `product_skus` stores sellable variants, SKU barcode, sell unit, conversion quantity, and price.
  - `stocks.quantity` is interpreted as base-unit stock per product master.
  - `transaction_items` has SKU snapshot columns for future-proof sales history.
- Safe dev migration keeps legacy `products` rows and creates one default SKU per existing product.
- Admin APIs now support product master CRUD, SKU CRUD, and base-unit stock updates.
- Cashier flow supports barcode/manual SKU search, cart checkout, receipt summary, and atomic conversion-based stock decrement.
- Public catalog still does not leak raw stock quantity; it only returns active, sellable products.

See also:

- `IMPLEMENTATION_PLAN_VARIANTS.md`
- `RETAIL_VARIANT_SCHEMA_PROPOSAL.md`
- `POS_EDGE_QA.md`
- `../app/README.md`

## Verification

From `app/`:

```bash
npm run check
npm run smoke:pos
npm run smoke:sku-foundation
npm run smoke:cashier-variants
```
