# Migrasi dari Versi Lama

## Yang dipertahankan
- POS kasir
- katalog + input manual
- keranjang
- pembayaran cash/transfer/QRIS
- riwayat transaksi
- laporan
- produk
- kategori
- pengeluaran
- pengaturan kasir

## Yang diubah total
- login dipindah ke Supabase Auth
- order items dipisah dari orders
- localStorage tidak lagi jadi sumber utama data
- sinkronisasi multi-device memakai RLS + realtime per outlet
- printer dipisah ke gateway service

## Mapping data penting
- legacy `orders.items[]` -> `order_items`
- legacy kasir plain password -> `auth.users` + `profiles`
- legacy setting frontend -> `branding_settings`, `printer_settings`, dan tabel inti lain
