# Product gap review — Groceries POS local test readiness

Date: 2026-05-31  
Reviewer: Sandy / product

## Current read

The prototype is now credible for a **single-store groceries POS local demo**: owner/admin can manage product masters and SKUs, cashier can search/scan SKU variants, checkout decrements product-master stock in base units, and the public catalog hides raw stock. Smoke coverage for SKU foundation and cashier variants passes locally.

For a local test by **18:00**, the biggest remaining risk is not the happy path. It is cashier speed and retail trust: preventing accidental duplicate sales, making stock/variant behavior obvious, and giving a receipt that feels familiar enough for a small shop.

## Priority recommendations for “done enough” by 18:00

### P0 — Must fix or explicitly accept before local testing

1. **Prevent double-submit checkout in the UI**
   - Current risk: cashier can click Checkout twice while the request is in flight; backend has no idempotency key yet.
   - Minimal 18:00 fix: disable Checkout and cart controls during checkout, show `Memproses…`, then re-enable only on failure.
   - Better later: add `clientRequestId`/idempotency key to `/api/cashier/checkout`.

2. **Make insufficient stock errors cashier-friendly**
   - Current risk: API returns messages like `insufficient stock for product 3`; cashier cannot tell which item/variant caused it.
   - Minimal 18:00 fix: include product/SKU display name in the error, e.g. `Stok Baterai AAA - Pack 4 tidak cukup`.

3. **Clarify base-unit stock on admin product/SKU forms**
   - Current risk: admin can confuse `base unit stok`, `unit jual SKU default`, and `conversionQty`, especially for pack/ecer.
   - Minimal 18:00 fix: add helper text/example near form fields: “Contoh: Baterai AAA base unit pcs, SKU Ecer konversi 1, SKU Pack 4 konversi 4.”

4. **Receipt should include a clear local-test expectation**
   - Current receipt is functional but not store-like yet: no store name, cashier name, or print/share action.
   - Minimal 18:00 fix: display store label, cashier/payment, transaction id/date, line totals, grand total, and add browser `Print` button if possible.

### P1 — Important retail UX holes, can defer if time is tight

1. **Cash tender/change for cash payments**
   - Small shops expect: total, cash received, change due.
   - Today only payment method is recorded. For local testing, QRIS/cash can pass, but cash feels incomplete.

2. **Fast cashier operations**
   - Search/scan works, but speed polish is missing:
     - keep focus in barcode field after add/checkout,
     - clear search after successful scan,
     - Enter-to-add when exactly one search result,
     - quick quantity input instead of only `+`/`−`,
     - keyboard shortcuts for checkout/clear cart.

3. **Stock visibility threshold per product**
   - Dashboard low-stock is fixed at 1–5 base units. That is okay for batteries, weak for rice/water/eggs.
   - Later: add `low_stock_threshold` per product master.

4. **Checkout stock audit trail**
   - Manual stock changes are audited, but checkout decrements are only visible through transactions/items.
   - Later: add stock audit rows for sales, or a stock movement ledger.

5. **Admin SKU edit flow**
   - Admin can add and soft-disable SKUs, but editing an existing SKU is API-only from the UI.
   - For testing variant corrections, inline edit or “duplicate/edit SKU” would avoid delete/recreate friction.

### P2 — Known constraints to document for testers

- Quantity/conversion values are integers only. This is fine for pcs/pack but not enough for weighed groceries unless base units are normalized to grams/ml.
- No returns/refunds/void transactions yet.
- No discount, tax, rounding, or service fee handling.
- No customer-facing online checkout/payment; WhatsApp remains inquiry-only.
- Public catalog currently shows only sellable active products; out-of-stock active products are hidden, not shown as `out_of_stock`. This policy should be intentional.
- No product images/image management yet.

## Variant/base-unit acceptance notes

Use these as tester-facing acceptance notes for the next pass:

- A product master stores stock only in one **base unit**.
- Each sellable SKU consumes `quantity sold × conversionQty` base units.
- If stock can cover `Ecer` but not `Pack 4`, `Ecer` remains sellable and `Pack 4` is hidden/blocked.
- Receipt must show the sold SKU label, sell unit, quantity sold, subtotal, and base-unit consumption for debugging.
- Admin UI must make it obvious that changing product stock changes all SKU availability for that product.

## Recommended 18:00 local-test cut line

Ship to local testing if these are true:

- [ ] Checkout button cannot be double-submitted from UI.
- [ ] Insufficient stock message names the affected product/SKU.
- [ ] Admin product form has base-unit/SKU conversion helper copy.
- [ ] Receipt includes store/test label, transaction id/date, payment method, total, and line items.
- [x] SKU foundation smoke passes.
- [x] Cashier variant smoke passes.
- [x] No deploy/public port exposure happened.

## Verification run

Local verification from `app/` on 2026-05-31:

```bash
npm run check
npm run smoke:sku-foundation
npm run smoke:cashier-variants
```

Result: passed.
