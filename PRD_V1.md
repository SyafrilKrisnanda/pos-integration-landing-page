# PRD V1 — Groceries POS + Website Catalog Integration

## 1. Ringkasan Produk
Sistem untuk 1 toko groceries yang menghubungkan POS internal dengan website company profile + katalog produk. POS menjadi sumber utama data produk, harga, stok, barcode, transaksi, dan sales dashboard. Website menampilkan katalog dari data POS dan mengarahkan customer ke WhatsApp untuk order.

## 2. Tujuan V1
- Owner/admin bisa mengelola produk, kategori, harga, unit, barcode, dan stok dari POS.
- Cashier bisa memproses transaksi toko dengan scan/input barcode dan mencatat metode bayar, termasuk QRIS cashier-side.
- Website bisa menampilkan profil toko dan katalog produk yang mengikuti data POS.
- Customer bisa melihat status stok sederhana dan menghubungi toko via WhatsApp.
- Owner bisa melihat ringkasan sales dasar dari transaksi POS.

## 3. Non-Goals V1
- Tidak ada checkout langsung di website.
- Tidak ada payment gateway.
- Tidak ada multi-branch/multi-store.
- Tidak ada production deployment atau production infrastructure.
- Tidak ada accounting lengkap, loyalty, atau inventory forecast otomatis.

## 4. Persona Pengguna

### Owner/Admin
Kebutuhan utama:
- menjaga data produk dan stok tetap rapi,
- melihat performa penjualan,
- memastikan katalog website sesuai data toko.

### Cashier
Kebutuhan utama:
- mencari/scan produk cepat,
- memproses transaksi,
- mencatat pembayaran,
- menghasilkan ringkasan transaksi sederhana.

### Customer
Kebutuhan utama:
- melihat profil toko,
- melihat produk, harga, unit, dan status stok,
- klik WhatsApp untuk order/bertanya.

## 5. Scope Fitur V1

### Website Catalog
- Company profile toko groceries.
- List produk dari data POS.
- Informasi produk: nama, kategori, harga, unit, status stok.
- Status stok publik hanya `available` atau `out of stock`.
- CTA WhatsApp untuk order.

### POS Owner/Admin
- Login sebagai owner/admin.
- Kelola produk: tambah, edit, nonaktifkan.
- Kelola kategori.
- Kelola harga.
- Kelola unit: `pcs` dan `pack`.
- Kelola barcode sejak V1.
- Update stok.
- Lihat sales data dan riwayat transaksi.
- Dashboard sederhana: total sales, jumlah transaksi, dan performa produk dasar.

### POS Cashier
- Login sebagai cashier.
- Cari produk.
- Scan/input barcode.
- Tambah item ke cart.
- Ubah quantity.
- Checkout transaksi.
- Catat metode bayar: cash/QRIS/metode lain yang disepakati.
- Lihat receipt/summary transaksi sederhana.

### Integrasi POS → Website
- POS menjadi source of truth data produk dan stok.
- Website mengambil katalog dari POS/data source internal.
- Qty stok detail tidak dipublikasi ke customer.
- Mapping stok:
  - `stock > 0` dan produk aktif → `available`
  - `stock <= 0` atau produk nonaktif → `out of stock`

## 6. User Stories Prioritas

### Must Have
- Sebagai owner/admin, saya bisa menambah produk dengan nama, kategori, harga, unit, barcode, dan stok awal.
- Sebagai owner/admin, saya bisa mengubah stok produk ketika ada restock atau koreksi stok.
- Sebagai cashier, saya bisa scan/input barcode untuk memasukkan produk ke cart.
- Sebagai cashier, saya bisa menyelesaikan transaksi dan stok berkurang otomatis.
- Sebagai owner, saya bisa melihat total penjualan dan transaksi dasar.
- Sebagai customer, saya bisa melihat katalog produk dan status stok di website.
- Sebagai customer, saya bisa klik WhatsApp untuk melakukan order.

### Should Have
- Owner/admin bisa nonaktifkan produk tanpa menghapus data historis.
- Cashier bisa mencari produk manual jika barcode tidak tersedia/scan gagal.
- Website bisa filter/kelompokkan produk berdasarkan kategori.

### Could Have / Future
- Highlight best seller / most-bought products.
- Multi-store/branch.
- Payment online di website.
- Dashboard analitik lebih detail.

## 7. Data Minimum

### Product
- id
- name
- category
- price
- unit (`pcs`/`pack`)
- barcode
- active status

### Stock
- product id
- quantity
- last updated by
- last updated at

### Transaction
- id
- cashier id
- items
- total
- payment method
- timestamp

### Transaction Item
- product id
- quantity
- unit price
- subtotal

## 8. Acceptance Criteria V1
- Owner/admin dapat membuat, mengedit, dan menonaktifkan produk groceries.
- Barcode produk unik dan dapat dipakai cashier saat transaksi.
- Cashier dapat menyelesaikan transaksi dasar dari cart sampai checkout.
- Stok produk berkurang setelah transaksi selesai.
- Website menampilkan produk aktif dari data POS.
- Website tidak menampilkan qty stok detail, hanya `available` / `out of stock`.
- CTA WhatsApp tersedia dari website untuk order.
- Dashboard owner menampilkan minimal total sales dan jumlah transaksi.

## 9. Risiko dan Catatan
- Perlu validasi barcode unik agar cashier flow tidak ambigu.
- Perlu guard role agar cashier tidak bisa mengakses fitur owner/admin.
- Jika website dibuat static, perlu pola sinkronisasi katalog yang jelas.
- QRIS di V1 hanya dicatat di kasir, bukan integrasi payment gateway.
