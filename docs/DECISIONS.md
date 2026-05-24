# DECISIONS.md

Use this file for technical decisions and tradeoffs.

## Stack decision

- Frontend: Static website, exact framework/tooling not selected yet
- Backend: None for phase 1
- Database: None for phase 1
- Auth: None for phase 1
- Hosting: Staging only later if separately approved; no production deploy now
- Storage: Static assets only if build later proceeds

## Architecture notes

- Phase 1 is best treated as a static landing page/company profile.
- All content can be hardcoded or stored in simple content files if coding is later approved.
- WhatsApp can use a direct `wa.me/6282132227306` link with optional prefilled message.
- Google Maps should use a normal link or embed; no paid API required.
- No backend/database/admin dashboard is justified for the approved dummy scope.

## Decision log

| Date | Decision | Reason | Alternatives considered |
| ---- | -------- | ------ | ----------------------- |
| 2026-05-13 | Use TAI Bikini Bottom role workflow | User requested project workflow with Karen, Sandy, SpongeBob, Squidward, Gary, Plankton, and Mr. Krabs | Generic role names were rejected |
| 2026-05-13 | Phase 1 scope approved | User approved static UMKM/company-profile scope | Larger website, order system, admin panel |
| 2026-05-13 | Documentation-only work is allowed now | User approved making project documents from template | Coding/build/deploy |
| 2026-05-13 | No backend/database for phase 1 | Menu, hours, address, maps, and WhatsApp do not require backend | CMS, admin dashboard, database |
| 2026-05-13 | Use staging later, no domain yet | User said domain belum ada, pakai staging dulu | Production domain/deploy |
| 2026-05-13 | No deploy and no public ports | Explicit user constraint | VM-hosted public service |
| 2026-05-13 | Local static coding approved | User approved coding lokal only | Deploy/staging/public port |

## Risks

- Scope creep into order online, payment gateway, admin dashboard, or CMS.
- Client may request frequent self-service menu edits later.
- Missing real photos/logo could reduce perceived professionalism.
- Google Maps exact point may need confirmation if real launch happens.
- Free static hosting limits or account access may matter later if staging is approved.

## Assumptions

- P001 is a dummy/test project.
- Approved client data is final for documentation.
- Domain is not available yet.
- No production deployment is allowed in this step.
- No public ports may be opened.
