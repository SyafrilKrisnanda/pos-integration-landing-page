# Groceries POS + Website Catalog Integration

Repository prototype untuk integrasi POS toko groceries dengan website company profile + katalog produk.

## Tujuan
- POS menjadi sumber utama data produk, stok, dan penjualan untuk 1 toko.
- Website menampilkan profil toko dan katalog produk dari data POS.
- Pemesanan pelanggan dilakukan via WhatsApp untuk fase awal.

## Struktur
- `site/` — frontend website company profile + katalog produk.
- `app/` — scaffold POS/admin untuk pengembangan lokal.
- `docs/` — dokumen proyek, scope, QA, deployment notes lama/pendukung.
- `screenshots/` dan `recordings/` — referensi UI.

## Dokumen V1
- `PRODUCT_BRIEF.md` — ringkasan produk dan target pengguna.
- `PRD_V1.md` — product requirements document untuk V1.
- `USER_FLOW_V1.md` — alur utama owner/admin, cashier, dan customer.
- `FEATURE_SCOPE_V1.md` — cakupan fitur V1 dan batasan.
- `ARCHITECTURE_DRAFT.md` — rancangan arsitektur awal.
- `docs/PRODUCT_GAP_REVIEW_2026-05-31.md` — review gap product/UX untuk groceries POS dan cut line local testing 18:00.

## Catatan Safety
- Tidak ada deployment production dalam scope ini.
- Tidak ada payment gateway.
- QRIS hanya dicatat/digunakan di sisi cashier.
- `.env` secrets tidak disertakan.
