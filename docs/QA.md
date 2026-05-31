# QA.md

## QA summary

- Status: local preview QA passed / external browser-device QA pending
- Tester: Gary — QA
- Date: 2026-05-18

Local static files exist in `site/`. Basic content verification, image asset reference check, responsive CSS breakpoint check, HTML parse, CSS brace check, and local preview response check passed on `127.0.0.1:8787`. No deployment was performed and no public port was opened. Full external browser/device QA is still pending.

## Functional checklist

- [x] Main landing page loads
- [x] Business name is correct: Bakso Pak Budi
- [x] Menu item exists: Bakso Original — Rp15.000
- [x] Menu item exists: Bakso Urat — Rp20.000
- [x] Menu item exists: Mie Ayam — Rp13.000
- [x] Address is correct: 7°50'55.2"S 113°42'23.2"E (-7.848667, 113.706444)
- [x] Opening hours are correct: 10.00–21.00
- [x] WhatsApp CTA uses number: 6282132227306
- [ ] WhatsApp CTA opens correctly on mobile and desktop
- [x] Google Maps section/link is present when map data is implemented
- [x] No admin/auth/payment/order flow appears in phase 1

## Responsive checklist

- [x] Mobile hero is readable
- [x] Mobile menu cards/list are readable
- [x] Mobile WhatsApp CTA is easy to tap
- [x] Tablet layout remains clean
- [x] Desktop layout is proportional and not overly stretched

## Basic quality checklist

- [ ] No obvious console errors
- [ ] No broken links
- [x] Basic title/meta description exists if build later starts
- [x] Reasonable loading speed
- [ ] Images are compressed/optimized if used — generated PNG assets added; optimize before production deploy
- [x] Text contrast is readable
- [ ] No placeholder content remains before review — generated images are placeholders until client photos are provided
- [x] No public ports are opened for QA
- [x] No deployment occurs without separate approval

## Bugs

| Severity | Issue | Steps to reproduce | Status |
| -------- | ----- | ------------------ | ------ |
| Low | Full browser/device QA not executed yet | Open `site/index.html` locally in browsers after approval/when needed | pending |
| Low | Real logo/photos are not provided yet | Review hero/card visuals before client handover | pending |
| Low | Generated PNG images are large for production | Optimize/convert assets before production deploy | pending |

## Release recommendation

- [ ] Ready for handover
- [x] Needs final human browser review before handover

## Go/no-go criteria

### GO for later coding only if

- Scope remains phase 1 static website.
- Data stays final or changes are documented.
- User gives explicit coding approval.

### NO-GO for deploy if

- User has not separately approved deploy.
- Public port exposure would be required.
- Domain/staging target is unclear.

## 2026-05-31 local POS/API sprint check

- `npm run check` passed for `app/src/server.js` and `app/src/db.js`.
- Local server smoke-tested on `127.0.0.1:8791` with temporary SQLite DB (`/tmp/p001-test.sqlite`).
- Verified:
  - `GET /api/health` returns local-only health JSON.
  - Public catalog excludes seeded out-of-stock product (`Gula Pasir 1kg`).
  - Admin login works with `admin` / `admin123`.
  - Owner/admin dashboard requires authenticated session.
  - Product create works with unique barcode.
  - Stock update to `0` works and writes audit entry.
- No public port opened; test server was stopped after smoke test.
- `npm run smoke:pos` passed: 9/9 checks for auth, role guard, barcode uniqueness, inactive/out-of-stock catalog hiding, and stock audit.
