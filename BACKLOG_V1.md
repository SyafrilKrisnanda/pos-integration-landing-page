# Backlog V1 — Groceries POS + Website Catalog Integration

## Status
- Source docs reviewed: `PRD_V1.md`, `USER_FLOW_V1.md`, `README.md`.
- Repo state before this backlog: clean on `main`, latest commit `0c80b9a Add groceries POS V1 planning docs`.
- This backlog translates the PRD/user flow into implementation work orders for the 5-agent workflow.

## PM Notes — Karen
V1 should stay intentionally small: single-store POS, admin product/stok management, cashier checkout, simple sales dashboard, and website catalog with WhatsApp CTA. Do not add online checkout, payment gateway, multi-branch, or production deployment unless explicitly approved.

## Approval Gates
- **GO/NO-GO before coding:** confirm tech stack and data storage pattern.
- **Approval before deployment/exposure:** no public HTTP/HTTPS or production deployment by default.
- **Approval before destructive data actions:** no reset/delete/wipe without user confirmation.

## Work Orders by Role

### Sandy — Architecture / Analyst
**Goal:** turn PRD into a concrete local architecture and implementation plan.

Tasks:
1. Confirm app boundaries: `site/` public catalog + `app/` POS/admin.
2. Choose V1 data model and storage approach for local development.
3. Define API/data sync contract for POS → website catalog.
4. Specify role guard requirements: owner/admin vs cashier.
5. Produce implementation sequence for SpongeBob.

Acceptance criteria:
- Data entities cover Product, Stock, Transaction, Transaction Item, Category/User as needed.
- Barcode uniqueness and stock mapping are explicitly defined.
- Website stock display remains `available` / `out of stock`, never raw quantity.

### SpongeBob — Fullstack Builder
**Goal:** implement V1 locally after Sandy plan is accepted.

Tasks:
1. Product/category CRUD for owner/admin.
2. Barcode unique validation.
3. Stock update flow.
4. Cashier screen: barcode/manual search, cart, quantity changes.
5. Checkout flow: payment method recording, stock decrement, receipt/summary.
6. Owner dashboard: total sales, transaction count, transaction history, basic product performance.
7. Website catalog pulls from the agreed POS/data source.
8. WhatsApp CTA with prefilled inquiry message.

Acceptance criteria:
- Cashier cannot sell inactive/out-of-stock products.
- Checkout blocks quantity greater than stock.
- Transaction save updates stock and sales dashboard.
- Website only shows active products and mapped stock status.

### Gary — QA / Reviewer
**Goal:** validate implementation against PRD and edge cases.

Test checklist:
1. Owner/admin can create/edit/nonactivate product.
2. Duplicate barcode is rejected.
3. Cashier can scan/input barcode and checkout.
4. Insufficient stock is blocked before checkout.
5. Stock decrements after successful checkout.
6. Inactive products are not sellable and not shown as available.
7. Website catalog hides stock quantity and shows only status.
8. WhatsApp CTA opens expected order inquiry.
9. Dashboard totals match sample transactions.
10. Cashier role cannot access owner/admin product management.

### Plankton — DevOps / Release Guard
**Goal:** keep local/dev workflow safe and reproducible.

Tasks:
1. Verify no secrets committed.
2. Add/update `.env.example` if app needs environment variables.
3. Document local run commands.
4. Document deployment caveats, but do not deploy production without approval.
5. Check exposed ports and privacy risks before any public preview.

Acceptance criteria:
- Local setup is documented.
- No production deployment is performed without explicit user approval.
- No public ports are exposed by default.

## Suggested Sprint Order
1. Sandy: architecture/data contract.
2. Karen: ask user GO/NO-GO for stack/data approach.
3. SpongeBob: build vertical slice — product CRUD + catalog display.
4. SpongeBob: cashier checkout + stock decrement.
5. SpongeBob: sales dashboard.
6. Gary: QA pass and bug list.
7. Plankton: local run/deployment safety docs.
8. Karen: final summary and next recommendation.

## Open Decisions
- Tech stack confirmation for `app/` and `site/`.
- Local storage choice: JSON/file, SQLite, or full database.
- Whether POS and website should share one runtime or separate builds.
- WhatsApp destination number and message template.
- Required cashier/owner login depth for V1 prototype.

## Current Recommendation
Use a simple local-first architecture for V1 prototype unless the user asks otherwise. Prefer SQLite or a small local API over static-only JSON if cashier checkout and stock decrement are in scope, because stock must update transactionally.
