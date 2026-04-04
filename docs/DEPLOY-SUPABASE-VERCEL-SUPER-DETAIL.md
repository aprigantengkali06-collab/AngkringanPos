# Panduan Deploy Super Detail - Supabase + Vercel

Dokumen ini adalah versi operasional yang lebih detail dari tutorial lama, khusus untuk project **Angkringan POS Pro**.

## Ringkasan temuan project

Dari isi source code project ini:
- database utama ada di `supabase/migrations/0001_init.sql`
- trigger onboarding user ada di `supabase/migrations/0002_business_ready.sql`
- seed outlet/menu demo ada di `supabase/seed/0001_seed.sql`
- bootstrap akses user saat login ada di `supabase/functions/bootstrap-user/index.ts`
- frontend butuh env publik di `apps/web-pos/.env.example`

Artinya:
1. **Outlet demo pertama** sudah dibuat oleh seed.
2. **Owner pertama belum otomatis dibuat oleh seed** karena `profiles.id` harus cocok dengan `auth.users.id`.
3. Trigger `handle_new_user()` akan membantu membuat profile dan user_outlets **jika** user dibuat dengan `user_metadata.outlet_id`.
4. Edge Function `bootstrap-user` juga punya fallback: kalau user belum punya outlet, ia akan dihubungkan ke **outlet aktif pertama** saat login.

Agar proses onboarding lebih aman dan deterministic, saya tambahkan file helper berikut:
- `supabase/seed/0002_first_owner_by_email.sql`
- `supabase/seed/0003_first_staff_by_email.sql`

---

## Alur deploy yang direkomendasikan

Urutan paling aman:
1. Buat project Supabase
2. Jalankan migration database
3. Jalankan seed outlet/menu demo
4. Buat akun owner pertama di Supabase Auth
5. Jalankan SQL helper owner pertama
6. (Opsional) buat user kasir/manager pertama lalu jalankan helper staff
7. Set secrets Edge Functions
8. Deploy semua Edge Functions
9. Deploy frontend ke Vercel
10. Test login, outlet, transaksi, shift, dan laporan

---

## Bagian A - Siapkan Supabase

### 1) Buat project Supabase baru
1. Login ke dashboard Supabase.
2. Klik **New project**.
3. Isi nama project, password database, dan region terdekat.
4. Tunggu sampai project aktif.

Catatan: project ini memakai Supabase untuk **Auth, Postgres, RLS, dan Edge Functions**.

### 2) Ambil data penting project
Dari dashboard Supabase, simpan nilai berikut:
- **Project URL**
- **anon key**
- **service_role key**
- **project ref**

Nilai-nilai ini akan dipakai untuk frontend dan Edge Functions. Supabase menjelaskan bahwa `SUPABASE_ANON_KEY` aman untuk browser jika RLS aktif, sedangkan `SUPABASE_SERVICE_ROLE_KEY` aman dipakai di Edge Functions tetapi **tidak boleh** dipakai di browser karena dapat melewati RLS [Supabase](https://supabase.com/docs/guides/functions/secrets).

### 3) Jalankan migration database
#### Opsi paling mudah: lewat SQL Editor
Jalankan file berikut **berurutan**:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_business_ready.sql`

Kenapa harus berurutan?
- file `0001` membuat tabel, view, index, trigger updated_at, dan RLS utama
- file `0002` menambahkan email ke profile, unique index email, open-shift guard, dan trigger `handle_new_user()` di `auth.users`

#### Opsi CLI
Kalau ingin pakai CLI, Supabase mendokumentasikan alur umum: `supabase login` → `supabase link` → `supabase db push` untuk mendorong migration ke project remote [Supabase](https://supabase.com/docs/guides/deployment/database-migrations) [Supabase](https://supabase.com/docs/reference/cli/introduction).

Contoh alur CLI:
```bash
supabase login
supabase link --project-ref PROJECT_REF_KAMU
supabase db push
```

### 4) Jalankan seed data demo
Setelah migration selesai, jalankan:
- `supabase/seed/0001_seed.sql`

File ini membuat:
- outlet demo pertama (`11111111-1111-1111-1111-111111111111`)
- kategori demo
- menu demo
- printer setting demo
- branding setting demo

### 5) Buat akun owner pertama di Authentication
Masuk ke **Authentication > Users > Add user**.

Isi minimal:
- email: misalnya `owner@tokokamu.com`
- password: password kuat
- centang / pastikan user aktif

Kalau mau lebih rapi sejak awal, pada metadata user Anda bisa isi:
```json
{
  "full_name": "Owner Utama",
  "role": "owner",
  "outlet_id": "11111111-1111-1111-1111-111111111111",
  "pin_code": "123456"
}
```

Dengan metadata ini, trigger `handle_new_user()` lebih mudah langsung membuat relasi `profiles` + `user_outlets`.

### 6) Sesuaikan SQL owner pertama
Buka file:
- `supabase/seed/0002_first_owner_by_email.sql`

Ganti bagian berikut:
- `v_owner_email`
- `v_owner_name`
- `v_owner_pin`
- `v_outlet_id`

Contoh:
```sql
v_owner_email text := 'owner@tokokamu.com';
v_owner_name text := 'Budi Santoso';
v_owner_pin text := '123456';
v_outlet_id uuid := '11111111-1111-1111-1111-111111111111';
```

Lalu jalankan file tersebut di SQL Editor.

Fungsi file ini:
- mencari `auth.users.id` berdasarkan email owner
- membuat / update `public.profiles`
- memastikan row `public.user_outlets` untuk owner pertama ada

Dengan cara ini, **owner pertama** dan **akses ke outlet pertama** menjadi pasti.

### 7) Sesuaikan SQL user outlet pertama
Kalau Anda ingin langsung punya user kasir/manager pertama, buat user itu dulu di **Authentication > Users**.

Lalu buka file:
- `supabase/seed/0003_first_staff_by_email.sql`

Ganti nilai:
- `v_staff_email`
- `v_staff_name`
- `v_staff_role`
- `v_staff_pin`
- `v_outlet_id`

Contoh kasir pertama:
```sql
v_staff_email text := 'kasir1@tokokamu.com';
v_staff_name text := 'Kasir Pagi';
v_staff_role text := 'cashier';
v_staff_pin text := '111111';
v_outlet_id uuid := '11111111-1111-1111-1111-111111111111';
```

Lalu jalankan file tersebut.

### 8) Verifikasi database wajib
Sebelum lanjut deploy frontend, cek hal berikut di Table Editor:
- tabel `outlets` punya minimal 1 row
- tabel `profiles` sudah punya owner pertama
- tabel `user_outlets` sudah menghubungkan owner ke outlet
- jika membuat kasir/manager, row-nya juga sudah ada di `profiles` dan `user_outlets`

Query verifikasi cepat:
```sql
select id, name, is_active from public.outlets order by created_at asc;
select id, email, full_name, role, is_active from public.profiles order by created_at asc;
select user_id, outlet_id, created_at from public.user_outlets order by created_at asc;
```

---

## Bagian B - Deploy Edge Functions

Project ini memakai function berikut:
- `bootstrap-user`
- `manage-staff`
- `create-order`
- `close-shift`
- `generate-report`
- `print-receipt`

### 9) Install dan login Supabase CLI
Supabase mendokumentasikan bahwa Edge Functions bisa dideploy lewat Dashboard, CLI, atau MCP; untuk workflow project seperti ini, CLI paling praktis [Supabase](https://supabase.com/docs/guides/functions).

Contoh alur dasar:
```bash
supabase login
supabase link --project-ref PROJECT_REF_KAMU
```

`supabase link` menghubungkan folder project lokal ke project Supabase hosted [Supabase](https://supabase.com/docs/reference/cli/introduction).

### 10) Set secrets Edge Functions
Project ini menggunakan secret default dan optional berikut:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRINTER_GATEWAY_URL` (opsional)

Supabase menjelaskan bahwa secret production bisa diatur lewat Dashboard atau CLI menggunakan `supabase secrets set` [Supabase](https://supabase.com/docs/guides/functions/secrets) [Supabase](https://supabase.com/docs/reference/cli/introduction).

Contoh:
```bash
supabase secrets set \
  SUPABASE_URL=https://PROJECT_KAMU.supabase.co \
  SUPABASE_ANON_KEY=ISI_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=ISI_SERVICE_ROLE_KEY
```

Kalau pakai printer gateway lokal / proxy:
```bash
supabase secrets set PRINTER_GATEWAY_URL=https://printer-gateway.domainkamu.com
```

### 11) Deploy functions satu per satu
Supabase mendokumentasikan `supabase functions deploy` untuk deploy function ke project yang sudah dilink [Supabase](https://supabase.com/docs/reference/cli/introduction).

Contoh:
```bash
supabase functions deploy bootstrap-user
supabase functions deploy manage-staff
supabase functions deploy create-order
supabase functions deploy close-shift
supabase functions deploy generate-report
supabase functions deploy print-receipt
```

### 12) Test function minimal
Setelah deploy, test dari aplikasi nanti akan otomatis memanggil function, tetapi sebelum itu pastikan:
- login owner sukses
- `bootstrap-user` tidak error
- `manage-staff` bisa list user outlet

---

## Bagian C - Deploy frontend ke Vercel

## [Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)
Vercel mendukung deploy Nuxt dengan konfigurasi minimal, dan untuk site fully static bisa memakai `nuxt generate`; untuk sebagian besar kasus SSR bisa memakai `nuxt build` [Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt). Nuxt sendiri mendokumentasikan bahwa app dengan `ssr: false` dapat dihasilkan sebagai static SPA dengan `nuxt generate`, dan hasilnya bisa dideploy ke static hosting apa pun [nuxt.com](https://nuxt.com/docs/3.x/getting-started/deployment).

### 13) Kenapa versi ini saya siapkan untuk Vercel static hosting
Project ini punya `ssr: false` di `apps/web-pos/nuxt.config.ts`, sehingga sangat cocok dijadikan static SPA.

Saya sudah tambahkan file:
- `vercel.json`

Isi file tersebut mengarahkan Vercel untuk:
- install dependency workspace dengan pnpm
- build memakai `nuxt generate`
- publish folder `apps/web-pos/.output/public`

Jadi versi source ini sudah lebih siap untuk Vercel tanpa perlu nebak build command lagi.

### 14) Env frontend yang wajib diisi di Vercel
Ambil dari `apps/web-pos/.env.example`:
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_PUBLIC_PRINTER_GATEWAY_URL` (opsional)
- `NUXT_PUBLIC_APP_NAME` (opsional)

Contoh:
```env
NUXT_PUBLIC_SUPABASE_URL=https://PROJECT_KAMU.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=ISI_ANON_KEY
NUXT_PUBLIC_PRINTER_GATEWAY_URL=
NUXT_PUBLIC_APP_NAME=Angkringan POS
```

### 15) Cara deploy ke Vercel dari Git
1. Upload repo ini ke GitHub / GitLab / Bitbucket.
2. Login ke Vercel.
3. Klik **Add New Project**.
4. Import repository.
5. Pastikan Vercel membaca file `vercel.json` dari root project.
6. Isi Environment Variables dengan nilai di atas.
7. Klik **Deploy**.

Menurut dokumentasi Vercel, Nuxt memang didukung langsung di platform mereka, termasuk static maupun server-rendered deployment [Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).

### 16) Cara deploy ke Vercel via CLI
Secara umum, Vercel menyarankan menjalankan command `vercel` dari root project untuk deploy project yang sudah ada [Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt).

Contoh singkat:
```bash
npm i -g vercel
vercel
```

Saat diminta env vars, isi semua env publik frontend.

---

## Bagian D - Deploy ke hosting selain Vercel

Karena project ini bisa dihasilkan menjadi static output, Anda juga bisa deploy ke hosting lain.

### 17) Build static manual
Jalankan dari root project:
```bash
corepack pnpm install --no-frozen-lockfile
corepack pnpm --filter web-pos exec nuxt generate
```

Hasil build ada di:
- `apps/web-pos/.output/public`

Nuxt mendokumentasikan bahwa hasil `nuxt generate` untuk app static dapat dideploy ke static hosting mana pun [nuxt.com](https://nuxt.com/docs/3.x/getting-started/deployment).

### 18) Hosting alternatif yang cocok
Bisa diupload ke:
- Netlify
- Cloudflare Pages
- Firebase Hosting
- shared hosting yang mendukung file static
- VPS dengan nginx / Caddy

Kalau pakai hosting file static biasa, upload semua isi folder `apps/web-pos/.output/public`.

---

## Bagian E - Checklist go-live

### 19) Checklist login dan role
- owner bisa login
- owner melihat outlet aktif
- halaman dashboard tidak error
- halaman POS terbuka
- `Tim Outlet` bisa memuat daftar user

### 20) Checklist master data
- kategori bisa ditambah / edit
- produk bisa ditambah / edit
- branding bisa disimpan
- printer settings bisa disimpan

### 21) Checklist operasional kasir
- buka shift berhasil
- create order berhasil
- order number terbentuk
- pembayaran cash / transfer / qris tersimpan
- close shift berhasil
- expected cash dan actual cash tampil

### 22) Checklist laporan
- order masuk ke laporan harian
- expense muncul di laporan
- summary harian tidak kosong setelah transaksi

---

## Bagian F - Troubleshooting paling sering

### Masalah 1: login berhasil tapi outlet kosong
Periksa:
```sql
select * from public.user_outlets where user_id = 'UUID_USER';
```
Kalau kosong, jalankan helper SQL owner/staff atau pastikan metadata `outlet_id` dikirim saat pembuatan user.

### Masalah 2: user ada di Auth tapi tidak ada di profiles
Periksa apakah migration `0002_business_ready.sql` sudah dijalankan. File itu yang membuat trigger `handle_new_user()` pada `auth.users`.

### Masalah 3: function error soal service role
Pastikan secret berikut sudah di-set di Supabase Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase menyebut `SUPABASE_SERVICE_ROLE_KEY` memang digunakan untuk operasi admin di Edge Functions dan tidak boleh dibocorkan ke browser [Supabase](https://supabase.com/docs/guides/functions/secrets).

### Masalah 4: deploy frontend berhasil tapi login gagal
Biasanya penyebabnya:
- `NUXT_PUBLIC_SUPABASE_URL` salah
- `NUXT_PUBLIC_SUPABASE_ANON_KEY` salah
- URL frontend belum dimasukkan ke allowlist Supabase Auth jika Anda memakai redirect tertentu

### Masalah 5: print receipt tidak jalan
Kalau Anda tidak memakai printer gateway, ini tidak memblokir transaksi. Tetapi kalau ingin print otomatis, set `PRINTER_GATEWAY_URL` di secret function `print-receipt` dan `NUXT_PUBLIC_PRINTER_GATEWAY_URL` di frontend.

---

## Rekomendasi final

Untuk project ini, alur paling aman adalah:
1. deploy database dan Edge Functions di Supabase
2. pastikan owner pertama dan relasi `user_outlets` pertama beres lewat helper SQL baru
3. deploy frontend static ke Vercel memakai `vercel.json`

Dengan alur itu, Anda menghindari error onboarding user pertama yang paling sering terjadi pada project Supabase: **user sudah ada di Auth, tetapi profile atau akses outlet belum sinkron**.
