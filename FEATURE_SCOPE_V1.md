# Feature Scope V1

## In Scope

### Website
- Company profile toko groceries.
- Katalog produk dari data POS.
- Detail dasar produk: nama, kategori, harga, unit, dan status stok.
- Status stok sederhana: `available` / `out of stock`.
- Tombol atau link order via WhatsApp.
- Tidak ada checkout atau payment di website.

### POS Owner/Admin
- Login role owner/admin.
- Product management:
  - tambah/edit/nonaktifkan produk,
  - kategori produk,
  - harga,
  - unit `pcs` dan `pack`,
  - barcode sejak V1.
- Stock update untuk menjaga ketersediaan produk.
- Sales data dan riwayat transaksi.
- Dashboard sales owner: total penjualan, transaksi, dan ringkasan performa produk.

### POS Cashier
- Login role cashier.
- Cashier flow:
  - cari produk,
  - scan/input barcode,
  - tambah item ke cart,
  - ubah qty,
  - checkout transaksi.
- Metode bayar dicatat di kasir, termasuk QRIS cashier-side.
- Receipt/summary transaksi sederhana.

### Integrasi
- POS menjadi sumber data produk untuk katalog website.
- Website membaca data produk/stok dari POS atau endpoint internal yang disiapkan.
- Hanya publish informasi stok sederhana ke customer.

## Out of Scope V1
- Payment gateway.
- Checkout customer di website.
- Multi-branch / multi-store.
- Production deployment dan production infrastructure.
- Akuntansi lengkap.
- Loyalty program.
- Inventory forecast otomatis.

## Acceptance Notes
- Owner dapat mengelola produk groceries dengan barcode dan unit pcs/pack.
- Product master memakai stok base unit; SKU/variant menjual dalam sell unit dengan `conversionQty` ke base unit.
- Cashier dapat menyelesaikan transaksi dasar dan stok berkurang sesuai konsumsi base unit.
- Untuk local testing, checkout harus punya guard UI agar tidak double-submit; backend idempotency boleh menjadi follow-up jika dicatat jelas.
- Receipt local test minimal memuat transaction id/tanggal, payment method, item display name, unit jual, qty, subtotal, total, dan konsumsi base unit untuk debugging.
- Admin perlu helper copy/contoh agar base unit, unit jual SKU, dan conversion quantity tidak membingungkan.
- Website dapat menampilkan katalog dari data POS tanpa membocorkan raw stock quantity.
- Customer dapat diarahkan ke WhatsApp untuk order.
