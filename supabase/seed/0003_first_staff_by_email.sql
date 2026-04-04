-- File ini opsional untuk membuat / memastikan user outlet pertama
-- (cashier atau manager) setelah akun Auth-nya dibuat.
--
-- CARA PAKAI:
-- 1) Buat dulu user di Supabase Authentication > Users.
-- 2) Ganti email/nama/role/PIN/outlet_id di bawah.
-- 3) Jalankan file ini setelah 0002_first_owner_by_email.sql.
--
-- Role hanya boleh: owner / manager / cashier
-- Aman dijalankan berulang (idempotent).

do $$
declare
  v_staff_email text := 'kasir1@angkringan.local';
  v_staff_name text := 'Kasir Pertama';
  v_staff_role text := 'cashier';
  v_staff_pin text := '111111';
  v_outlet_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid;
begin
  if lower(v_staff_role) not in ('owner', 'manager', 'cashier') then
    raise exception 'Role % tidak valid. Gunakan owner/manager/cashier.', v_staff_role;
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(v_staff_email)
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'Auth user untuk email % belum ada. Buat dulu user di Authentication > Users.', v_staff_email;
  end if;

  insert into public.profiles (id, email, full_name, role, pin_code, is_active)
  values (v_user_id, v_staff_email, v_staff_name, lower(v_staff_role), nullif(v_staff_pin, ''), true)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = lower(v_staff_role),
        pin_code = coalesce(excluded.pin_code, public.profiles.pin_code),
        is_active = true,
        updated_at = now();

  insert into public.user_outlets (user_id, outlet_id)
  values (v_user_id, v_outlet_id)
  on conflict (user_id, outlet_id) do nothing;

  raise notice 'USER outlet pertama berhasil dipastikan. user_id=% outlet_id=% role=%', v_user_id, v_outlet_id, lower(v_staff_role);
end $$;
