# Product Brief V1

## Produk
Groceries POS + website catalog integration untuk 1 toko groceries.

## Masalah yang Diselesaikan
Toko membutuhkan satu sumber data produk dan stok yang dipakai bersama oleh POS internal dan katalog website. Pelanggan dapat melihat produk online, lalu melakukan pemesanan melalui WhatsApp.

## Target Pengguna
- **Owner/Admin**: mengelola produk, stok, barcode, harga, dan melihat dashboard penjualan.
- **Cashier**: memproses transaksi kasir, scan/input barcode, memilih metode bayar termasuk QRIS di kasir.
- **Customer**: melihat profil toko dan katalog produk di website, lalu menghubungi WhatsApp untuk order.

## Nilai Utama
- Data produk cukup dikelola dari POS.
- Website selalu mengikuti katalog dari POS.
- Status stok pelanggan dibuat sederhana: `available` atau `out of stock`.
- POS mobile-friendly agar bisa dipakai di perangkat toko.

## Batasan V1
- Scope 1 toko.
- Tidak ada payment gateway.
- Tidak ada checkout website.
- Tidak ada deployment atau production infrastructure.
- Order customer hanya diarahkan ke WhatsApp.

## Arah Lanjutan
- Highlight best seller / most-bought products.
- Multi-store atau branch management.
- Integrasi pembayaran online jika sudah dibutuhkan.
