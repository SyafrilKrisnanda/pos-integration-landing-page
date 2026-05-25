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
- Cashier dapat menyelesaikan transaksi dasar.
- Website dapat menampilkan katalog dari data POS.
- Customer dapat diarahkan ke WhatsApp untuk order.
