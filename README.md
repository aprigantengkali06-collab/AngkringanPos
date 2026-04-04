# Angkringan POS Pro

Monorepo POS angkringan berbasis **Nuxt 3 + Supabase + Edge Functions** yang sudah dirapikan agar siap dipakai bisnis: transaksi kasir, produk, kategori, pengeluaran, shift, user management, printer, dan laporan harian.

## Yang sudah dibenahi
- UI dashboard dan kasir dibuat lebih profesional dan mudah dipahami
- Error create-order diperbaiki di Edge Function dengan validasi akses, profil otomatis, dan order number yang aman
- Bootstrap user otomatis: profil dan outlet access dibuat saat user login pertama kali
- Manajemen tim via dashboard: buat akun owner/manager/cashier langsung dari aplikasi
- Close shift sudah menghitung expected cash, actual cash, dan selisih
- Halaman CRUD utama kini aktif dan langsung terhubung ke Supabase

## Cara setup
1. Buat project Supabase.
2. Jalankan migration berurutan:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_business_ready.sql`
3. Jalankan seed awal: `supabase/seed/0001_seed.sql`
4. Deploy Edge Functions:
   - `bootstrap-user`
   - `manage-staff`
   - `create-order`
   - `close-shift`
   - `generate-report`
   - `print-receipt`
5. Copy `apps/web-pos/.env.example` menjadi `.env` lalu isi variable Supabase.
6. Install dependency dan jalankan frontend:
   - `pnpm install`
   - `pnpm --filter web-pos dev`

## Catatan implementasi
- Untuk printer lokal, isi `NUXT_PUBLIC_PRINTER_GATEWAY_URL` di frontend dan `PRINTER_GATEWAY_URL` di edge function bila ingin print via proxy server.
- Manager/owner bisa menambah anggota tim dari menu **Tim Outlet**.
- Aplikasi berjalan sebagai SPA (`ssr: false`) agar pengalaman kasir lebih stabil pada device outlet.
