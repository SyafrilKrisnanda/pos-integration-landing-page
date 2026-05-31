# PRD V1 — Groceries POS + Website Catalog Integration

## 1. Ringkasan Produk
Sistem untuk 1 toko groceries yang menghubungkan POS internal dengan website company profile + katalog produk. POS menjadi sumber utama data produk, harga, stok, barcode, transaksi, dan sales dashboard. Website menampilkan katalog dari data POS dan mengarahkan customer ke WhatsApp untuk order.

## 2. Tujuan V1
- Owner/admin bisa mengelola produk, kategori, harga, barcode, dan stok dari POS.
- Sistem bisa menangani produk retail yang dijual dalam lebih dari satu bentuk jual, misalnya ecer vs pack.
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
- Informasi produk: nama, kategori, harga, unit jual, status stok.
- Status stok publik hanya `available` atau `out of stock`.
- Produk inactive disembunyikan dari website.
- Produk stok `0` tetap boleh tampil sebagai `out of stock`.
- CTA WhatsApp untuk order.

### POS Owner/Admin
- Login sebagai owner/admin.
- Kelola product master: tambah, edit, nonaktifkan.
- Kelola SKU/variant jual per product master.
- Kelola kategori.
- Kelola harga per SKU.
- Kelola barcode per SKU sejak V1.
- Kelola unit dasar stok (`base_unit`) dan unit jual (`sell_unit`) bila diperlukan.
- Kelola conversion quantity, misalnya 1 pack = 4 pcs.
- Update stok dengan reason yang jelas: restock / koreksi / penyesuaian lain.
- Lihat sales data dan riwayat transaksi.
- Dashboard sederhana: total sales, jumlah transaksi, dan performa produk dasar.

### POS Cashier
- Login sebagai cashier.
- Cari produk/SKU.
- Scan/input barcode SKU.
- Fallback ke pencarian manual jika barcode tidak tersedia atau scan gagal.
- Tambah item ke cart.
- Ubah quantity.
- Checkout transaksi.
- Catat metode bayar: cash/QRIS/metode lain yang disepakati.
- Lihat receipt/summary transaksi sederhana.
- Saat checkout, stok dasar harus berkurang sesuai conversion quantity SKU yang dijual.

### Integrasi POS → Website
- POS menjadi source of truth data produk dan stok.
- Website mengambil katalog dari POS/data source internal.
- Qty stok detail tidak dipublikasi ke customer.
- Mapping stok:
  - setidaknya satu SKU aktif masih bisa dijual → `available`
  - semua SKU tidak bisa dijual karena stok dasar tidak cukup atau inactive → `out of stock`
- Produk inactive tidak tampil di website.

## 6. User Stories Prioritas

### Must Have
- Sebagai owner/admin, saya bisa menambah product master dengan nama, kategori, dan stok dasar.
- Sebagai owner/admin, saya bisa menambah SKU/variant jual dengan harga, unit jual, barcode, dan conversion quantity.
- Sebagai owner/admin, saya bisa mengubah stok produk ketika ada restock atau koreksi stok.
- Sebagai cashier, saya bisa scan/input barcode SKU untuk memasukkan produk ke cart.
- Sebagai cashier, saya bisa menyelesaikan transaksi dan stok dasar berkurang otomatis sesuai conversion quantity SKU.
- Sebagai owner, saya bisa melihat total penjualan dan transaksi dasar.
- Sebagai customer, saya bisa melihat katalog produk dan status stok di website.
- Sebagai customer, saya bisa klik WhatsApp untuk melakukan order.

### Should Have
- Owner/admin bisa nonaktifkan produk tanpa menghapus data historis.
- SKU inactive tidak bisa dijual walaupun product master masih aktif.
- Cashier bisa mencari produk manual jika barcode tidak tersedia/scan gagal.
- Website bisa filter/kelompokkan produk berdasarkan kategori.
- Sistem menyimpan harga snapshot pada saat transaksi agar perubahan harga berikutnya tidak mengubah histori.

### Could Have / Future
- Highlight best seller / most-bought products.
- Multi-store/branch.
- Payment online di website.
- Dashboard analitik lebih detail.

## 7. Data Minimum

### Product Master
- id
- name
- category
- description
- base unit (contoh: `pcs`)
- active status

### SKU / Variant
- id
- product master id
- variant name (contoh: `ecer`, `pack 4`)
- sell unit
- conversion quantity terhadap base unit
- price
- barcode
- active status

### Stock
- product master id
- quantity in base unit
- last updated by
- last updated at
- change reason

### Transaction
- id
- cashier id
- items
- total
- payment method
- timestamp

### Transaction Item
- transaction id
- product master id
- SKU id
- quantity sold
- conversion quantity snapshot
- sell unit snapshot
- unit price snapshot
- subtotal

## 8. Acceptance Criteria V1
- Owner/admin dapat membuat, mengedit, dan menonaktifkan product master groceries.
- Owner/admin dapat membuat SKU/variant jual untuk satu product master.
- Barcode SKU unik dan dapat dipakai cashier saat transaksi.
- Cashier dapat menyelesaikan transaksi dasar dari cart sampai checkout.
- Stok dasar berkurang sesuai conversion quantity SKU setelah transaksi selesai.
- Sistem menolak checkout jika stok dasar tidak cukup.
- Website menampilkan produk aktif dari data POS.
- Website tidak menampilkan qty stok detail, hanya `available` / `out of stock`.
- Produk inactive tidak muncul di website.
- CTA WhatsApp tersedia dari website untuk order.
- Dashboard owner menampilkan minimal total sales dan jumlah transaksi.

## 9. Risiko dan Catatan
- Perlu validasi barcode unik agar cashier flow tidak ambigu.
- Perlu guard role agar cashier tidak bisa mengakses fitur owner/admin.
- Perlu atomic checkout agar multi-item transaction tidak membuat stok parsial.
- Perlu rule yang jelas untuk inactive product vs out_of_stock.
- Jika website dibuat static, perlu pola sinkronisasi katalog yang jelas.
- QRIS di V1 hanya dicatat di kasir, bukan integrasi payment gateway.
- Return/void transaksi, promo/discount engine, dan upload image produk dinyatakan out of scope sampai disetujui.
