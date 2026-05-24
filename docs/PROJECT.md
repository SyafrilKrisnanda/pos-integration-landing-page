# PROJECT.md

## Project identity

- Project code: P001
- Project name: Website Bakso Pak Budi
- Client: Bakso Pak Budi
- Contact person: Dummy client / not assigned
- Start date: 2026-05-13
- Target deadline: 2026-05-20
- Status: local coding in progress / no deploy

## Goal

Membuat website UMKM/company profile sederhana untuk Bakso Pak Budi agar pelanggan lokal bisa melihat menu, alamat, jam buka, membuka Google Maps, dan menghubungi WhatsApp dengan mudah.

Website harus hemat, ringan, mobile-first, dan tetap terlihat profesional. Untuk fase 1, website ditujukan sebagai landing page/company profile, bukan sistem order online.

## Scope

### Included

- Landing page/company profile fase 1.
- Hero section dengan nama usaha dan CTA WhatsApp.
- Menu utama:
  - Bakso Original — Rp15.000
  - Bakso Urat — Rp20.000
  - Mie Ayam — Rp13.000
- Informasi lokasi: koordinat 7°50'55.2"S 113°42'23.2"E (-7.848667, 113.706444)
- Jam buka: 10.00–21.00
- Tombol WhatsApp ke: 6282132227306
- Google Maps section/link untuk koordinat 7°50'55.2"S 113°42'23.2"E.
- Desain mobile-first, sederhana, hemat, dan profesional.
- Dokumen project, scope, dan QA checklist.
- Staging-only untuk fase awal; domain belum tersedia.

### Not included

- Deploy production.
- Membuka port publik.
- Domain custom.
- Backend/database.
- Dashboard admin/CMS.
- Sistem order online.
- Payment gateway.
- Multi-page kompleks.
- Maintenance/update menu otomatis.
- Branding besar atau foto produk profesional baru.

## Success criteria

- Informasi menu, harga, alamat, jam buka, dan WhatsApp sesuai data final dummy.
- CTA WhatsApp jelas dan mudah diakses dari mobile.
- Google Maps mengarah ke koordinat final 7°50'55.2"S 113°42'23.2"E.
- Tampilan rapi di mobile dan desktop.
- Website ringan dan tidak memakai fitur teknis berlebihan.
- Tidak ada deploy production dan tidak ada port publik dibuka pada fase dokumen ini.
- Scope fase 1 tetap terkendali tanpa backend, admin panel, order online, atau payment gateway.

## Stakeholders

- Owner: Staysteel / Dummy client approval
- Karen — PM/coordinator: koordinasi scope, timeline, approval gate
- Sandy — Architect/Analyst: analisis kebutuhan, scope, dan batasan fase 1
- SpongeBob — Backend: validasi kebutuhan data dan keputusan statis vs backend
- Squidward — Frontend/UI: struktur halaman dan arahan visual
- Gary — QA: checklist kelayakan sebelum launch
- Plankton — DevOps: staging/deploy constraints dan keamanan publik
- Mr. Krabs — Costing/Pricing: estimasi biaya dan batas hemat

## Links

- GitHub repo: https://github.com/SyafrilKrisnanda/pos-integration-landing-page
- Staging URL: not deployed / pending approval
- Production URL: not planned for phase 1 documentation
- Discord thread/channel: #karen-control / channel:1504128476062421042

## Approval status

- Scope fase 1: approved by user on 2026-05-13
- Data dummy client: final for planning/documentation
- Coding: approved for local static implementation on 2026-05-13
- Deploy: not allowed
- Public ports: not allowed

## Final client data

- WhatsApp: 6282132227306
- Location: 7°50'55.2"S 113°42'23.2"E (-7.848667, 113.706444)
- Opening hours: 10.00–21.00
- Menu:
  - Bakso Original — Rp15.000
  - Bakso Urat — Rp20.000
  - Mie Ayam — Rp13.000
- Domain: none yet; use staging later if approved

## Phase 1 boundaries

- Phase 1 is limited to documentation and later, if separately approved, a simple static website build.
- No production deployment in this approval.
- No public port exposure.
- Any request for order online, payment, admin dashboard, CMS, or frequent self-service updates becomes phase 2 and requires re-estimation.

## Local implementation

- Local static site path: `site/`
- Files created:
  - `site/index.html`
  - `site/styles.css`
  - `site/script.js`
- Verification performed: static content check only, no server/deploy/public port.

## QA checklist — Gary

- [ ] Business name is correct: Bakso Pak Budi
- [ ] WhatsApp number is correct: 6282132227306
- [ ] WhatsApp CTA opens correctly when implemented
- [ ] Location coordinates are correct: 7°50'55.2"S 113°42'23.2"E (-7.848667, 113.706444)
- [ ] Opening hours are correct: 10.00–21.00
- [ ] Menu names and prices are correct
- [ ] Google Maps section/link is present when staging/build begins
- [ ] Mobile layout is readable and not broken
- [ ] Desktop layout is clean and proportional
- [ ] Text contrast is readable
- [ ] Images, if used, are optimized
- [ ] No broken links
- [ ] No placeholder content remains before review
- [ ] No backend/admin/payment features are accidentally added
- [ ] No deploy/public port action is performed without separate approval

## Costing — Mr. Krabs

- Recommended phase 1 package: Rp1.500.000–Rp2.500.000
- Domain: not included yet; estimated Rp150.000–Rp250.000/year if later requested
- Hosting for static staging: target Rp0 using free static hosting tier if later approved
- SSL: target Rp0 from hosting provider if later approved
- Optional maintenance: Rp250.000–Rp500.000/month
- Recommendation: keep this as a static, low-cost website; do not pay for backend/admin panel before there is a real need.
