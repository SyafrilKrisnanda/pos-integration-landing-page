# User Flow V1 — Groceries POS + Website Catalog Integration

## 1. Owner/Admin Flow — Setup Produk Awal
1. Owner/admin login ke POS.
2. Buka menu Product Management.
3. Tambah kategori produk jika belum ada.
4. Tambah produk baru:
   - nama produk,
   - kategori,
   - harga,
   - unit `pcs` atau `pack`,
   - barcode,
   - stok awal.
5. Sistem validasi data wajib dan barcode unik.
6. Produk tersimpan sebagai produk aktif.
7. Produk aktif muncul di katalog website dengan status stok publik:
   - `available` jika stok > 0,
   - `out of stock` jika stok <= 0.

## 2. Owner/Admin Flow — Update Produk atau Stok
1. Owner/admin login ke POS.
2. Cari produk di Product Management.
3. Pilih aksi:
   - edit detail produk,
   - update harga,
   - update barcode,
   - update stok,
   - nonaktifkan produk.
4. Sistem menyimpan perubahan.
5. Website catalog mengikuti data terbaru dari POS/data source internal.
6. Jika produk nonaktif, website tidak menampilkannya sebagai produk tersedia.

## 3. Cashier Flow — Transaksi Kasir
1. Cashier login ke POS.
2. Buka cashier screen.
3. Cashier scan barcode atau input barcode manual.
4. Sistem mencari produk aktif.
5. Jika produk ditemukan dan stok tersedia:
   - produk masuk cart,
   - cashier bisa ubah quantity.
6. Jika barcode tidak ditemukan:
   - sistem menampilkan error,
   - cashier bisa cari produk manual jika fitur pencarian tersedia.
7. Cashier review cart.
8. Cashier pilih metode bayar:
   - cash,
   - QRIS cashier-side,
   - metode lain yang disepakati.
9. Cashier checkout transaksi.
10. Sistem menyimpan transaksi, mengurangi stok, dan membuat receipt/summary sederhana.
11. Data sales masuk ke dashboard owner.

## 4. Customer Flow — Lihat Katalog dan Order WhatsApp
1. Customer membuka website toko.
2. Customer melihat profil toko dan katalog produk.
3. Customer melihat informasi produk:
   - nama,
   - kategori,
   - harga,
   - unit,
   - status stok `available` / `out of stock`.
4. Customer memilih produk yang diminati.
5. Customer klik CTA WhatsApp.
6. WhatsApp terbuka dengan pesan awal/order inquiry.
7. Order dilanjutkan manual melalui chat WhatsApp.

## 5. Owner Flow — Cek Sales Dashboard
1. Owner/admin login ke POS.
2. Buka sales dashboard.
3. Sistem menampilkan ringkasan:
   - total sales,
   - jumlah transaksi,
   - riwayat transaksi,
   - performa produk dasar.
4. Owner dapat menggunakan data ini untuk melihat produk yang sering terjual dan arah restock.

## 6. Edge Cases V1

### Barcode Duplikat
- Sistem menolak penyimpanan produk jika barcode sudah digunakan produk lain.
- Owner/admin harus mengganti barcode sebelum produk bisa disimpan.

### Stok Tidak Cukup Saat Checkout
- Sistem memberi warning saat quantity cart melebihi stok.
- Cashier harus mengurangi quantity atau membatalkan item.

### Produk Out of Stock di Website
- Website tetap boleh menampilkan produk sebagai `out of stock` jika produk masih aktif.
- Customer tidak melihat jumlah stok detail.

### Produk Nonaktif
- Produk nonaktif tidak boleh bisa dijual cashier.
- Produk nonaktif tidak tampil sebagai produk tersedia di website.

## 7. Flow Diagram Ringkas

```text
Owner/Admin
  -> Login POS
  -> Kelola Produk/Stok
  -> Data Produk POS
  -> Website Catalog

Cashier
  -> Login POS
  -> Scan/Input Barcode
  -> Cart
  -> Checkout
  -> Transaction Saved
  -> Stock Updated
  -> Sales Dashboard

Customer
  -> Website
  -> Lihat Catalog
  -> Klik WhatsApp
  -> Order Manual via Chat
```
