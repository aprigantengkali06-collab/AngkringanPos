-- File ini dipakai untuk memastikan OWNER pertama benar-benar ada di public.profiles
-- dan terhubung ke outlet pertama.
--
-- CARA PAKAI:
-- 1) Buat dulu user owner di Supabase Authentication > Users.
-- 2) Ganti nilai email/nama/PIN/outlet_id di blok DO di bawah.
-- 3) Jalankan file ini setelah:
--    - supabase/migrations/0001_init.sql
--    - supabase/migrations/0002_business_ready.sql
--    - supabase/seed/0001_seed.sql
--
-- Aman dijalankan berulang (idempotent).

do $$
declare
  v_owner_email text := 'owner@angkringan.local';
  v_owner_name text := 'Owner Utama';
  v_owner_pin text := '123456';
  v_outlet_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid;
begin
  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(v_owner_email)
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'Auth user untuk email % belum ada. Buat dulu user di Authentication > Users.', v_owner_email;
  end if;

  insert into public.profiles (id, email, full_name, role, pin_code, is_active)
  values (v_user_id, v_owner_email, v_owner_name, 'owner', nullif(v_owner_pin, ''), true)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = 'owner',
        pin_code = coalesce(excluded.pin_code, public.profiles.pin_code),
        is_active = true,
        updated_at = now();

  insert into public.user_outlets (user_id, outlet_id)
  values (v_user_id, v_outlet_id)
  on conflict (user_id, outlet_id) do nothing;

  raise notice 'OWNER pertama berhasil dipastikan. user_id=% outlet_id=%', v_user_id, v_outlet_id;
end $$;
