# Tutorial Deploy Lengkap

## 1. Database Supabase
1. Buat project Supabase baru.
2. Jalankan migration berikut secara berurutan:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_business_ready.sql`
3. Jalankan seed: `supabase/seed/0001_seed.sql`
4. Aktifkan Realtime untuk tabel penting jika dibutuhkan operasional multi device.

## 2. Auth dan akses outlet
1. Buat akun owner pertama di Supabase Auth.
2. Isi `raw_user_meta_data` bila perlu dengan `full_name`, `role`, dan `outlet_id`.
3. Setelah login pertama, edge function `bootstrap-user` akan memastikan profil dan hubungan outlet dibuat.
4. User berikutnya bisa dibuat langsung dari menu **Tim Outlet** di aplikasi.

## 3. Frontend
1. Copy `.env.example` menjadi `.env`
2. Isi `NUXT_PUBLIC_SUPABASE_URL`
3. Isi `NUXT_PUBLIC_SUPABASE_ANON_KEY`
4. Isi `NUXT_PUBLIC_PRINTER_GATEWAY_URL` bila memakai printer lokal
5. Jalankan:
   - `pnpm install`
   - `pnpm --filter web-pos dev`

## 4. Edge Functions
Deploy fungsi berikut:
- `bootstrap-user`
- `manage-staff`
- `create-order`
- `close-shift`
- `generate-report`
- `print-receipt`

Jika ingin print via proxy, set environment `PRINTER_GATEWAY_URL` pada function `print-receipt`.

## 5. Uji sebelum go-live
- Login owner berhasil
- Outlet aktif terbaca
- Tambah menu dan kategori berhasil
- Create order berhasil tanpa error edge function
- Shift buka/tutup berhasil
- Pengeluaran muncul di laporan harian
- Tim outlet bisa ditambah dari dashboard
- Printer gateway merespons health check
