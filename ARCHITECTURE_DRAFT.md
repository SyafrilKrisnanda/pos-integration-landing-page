# Architecture Draft V1

## Prinsip
- POS adalah source of truth untuk produk, harga, barcode, stok, dan penjualan.
- Website hanya menampilkan company profile dan katalog produk.
- Customer ordering diarahkan ke WhatsApp, bukan checkout website.
- Scope awal untuk 1 toko dan pengembangan lokal.

## Komponen

### POS App
Digunakan oleh owner/admin dan cashier.

Tanggung jawab:
- autentikasi role owner/admin dan cashier,
- product management,
- stock update,
- cashier transaction flow,
- sales data,
- owner sales dashboard,
- barcode scan/input,
- unit produk `pcs` dan `pack`.

### Product & Sales Data Store
Menyimpan:
- products,
- categories,
- stock quantities,
- barcode,
- unit,
- transactions,
- transaction items,
- cashier/payment method metadata.

### Website Catalog
Menampilkan:
- profil toko,
- daftar produk,
- harga dan unit,
- status stok `available` / `out of stock`,
- CTA WhatsApp untuk order.

Website tidak perlu mengetahui qty stok detail. Mapping stok cukup:
- `stock > 0` => `available`
- `stock <= 0` atau produk nonaktif => `out of stock`

## Alur Data
1. Owner/admin membuat atau memperbarui produk di POS.
2. POS menyimpan data produk, harga, unit, barcode, dan stok.
3. Website mengambil katalog dari data POS melalui data source/API internal.
4. Customer melihat katalog dan klik WhatsApp untuk memesan.
5. Cashier memproses transaksi di POS dan update stok/penjualan.
6. Dashboard owner membaca agregasi sales dari transaksi POS.

## Batasan Infrastruktur V1
- Tidak ada deployment production.
- Tidak ada payment gateway.
- Tidak ada production infra design final.
- QRIS hanya digunakan/dicatat sebagai metode bayar di kasir.

## Entitas Data Awal
- `users`: role owner/admin/cashier.
- `products`: name, category, price, unit, barcode, active flag.
- `stocks`: product id, quantity, updated by, updated at.
- `transactions`: cashier, total, payment method, timestamp.
- `transaction_items`: product, qty, unit price, subtotal.

## Risiko / Catatan
- Perlu aturan jelas untuk sinkronisasi katalog jika website static.
- Perlu validasi barcode unik.
- Perlu guard agar cashier tidak melihat fitur admin yang tidak relevan.
