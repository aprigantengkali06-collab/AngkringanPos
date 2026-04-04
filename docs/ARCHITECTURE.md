# Arsitektur Final yang Direkomendasikan

## Tujuan utama
- cepat dipakai harian
- multi-device
- real-time
- aman secara akses data
- mudah dirawat tim kecil

## Struktur domain
- `apps/web-pos`: frontend Nuxt 3
- `supabase/migrations`: schema dan policy
- `supabase/functions`: logic aman di server
- `services/printer-gateway`: gateway print ESC/POS terpisah
- `packages/*`: shared types, utils, dan UI

## Prinsip desain
1. Frontend tidak membuat invoice number sendiri.
2. Frontend tidak memegang password kasir mentah.
3. Order header dan order items dipisah.
4. Report tidak dihitung berat terus-menerus di client.
5. Printer dipisah dari frontend agar stabil.
6. Semua tabel operasional punya `outlet_id`.
