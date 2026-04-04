# Roadmap Implementasi 14 Hari Sampai Go-Live

## Hari 1
- buat project Supabase
- aktifkan Auth, Realtime, Storage
- jalankan migration `0001_init.sql`
- isi seed awal

## Hari 2
- buat akun owner di Supabase Auth
- isi tabel `profiles` dan `user_outlets`
- pasang env frontend
- jalankan Nuxt di local

## Hari 3
- implement login owner / manager / cashier
- ambil profile setelah login
- enforce route middleware

## Hari 4
- implement halaman master kategori
- implement halaman master menu
- pastikan RLS bekerja per outlet

## Hari 5
- implement store cart dan katalog POS
- tambah item manual
- validasi subtotal, tax, service, discount

## Hari 6
- implement Edge Function `create-order`
- generate `order_no`
- insert header, items, payment, audit log dalam satu transaksi

## Hari 7
- implement halaman order history dan detail order
- implement void order dengan alasan
- tampilkan audit log ringkas

## Hari 8
- implement expenses + approval sederhana
- kaitkan ke shift aktif
- uji laporan harian dasar

## Hari 9
- implement open shift dan close shift
- hitung expected cash vs actual cash
- cegah dua shift open pada user dan outlet yang sama

## Hari 10
- implement realtime orders, expenses, menus, shifts
- batasi subscription hanya outlet aktif
- optimasi refresh owner dashboard

## Hari 11
- implement branding settings + logo upload
- implement printer settings
- implement payload receipt JSON

## Hari 12
- pasang printer gateway lokal
- uji cetak 58mm
- uji auto reprint transaksi terakhir

## Hari 13
- hardening: role matrix, idle logout, observability, error tracking, backup, smoke test multi-device
- UAT dengan 2 sampai 5 device

## Hari 14
- deploy frontend ke Cloudflare Pages atau Vercel
- pasang domain
- training kasir
- go-live terbatas 1 outlet lalu evaluasi
