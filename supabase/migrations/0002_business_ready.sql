alter table public.profiles add column if not exists email text;
create unique index if not exists idx_profiles_email_unique on public.profiles (lower(email)) where email is not null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

create unique index if not exists idx_shifts_one_open_per_outlet on public.shifts(outlet_id) where status = 'open';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text;
  full_name_value text;
  outlet_uuid uuid;
begin
  normalized_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'cashier'));
  if normalized_role not in ('owner', 'manager', 'cashier') then
    normalized_role := 'cashier';
  end if;

  full_name_value := trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'User POS'));

  insert into public.profiles (id, email, full_name, role, pin_code, is_active)
  values (
    new.id,
    new.email,
    full_name_value,
    normalized_role,
    nullif(new.raw_user_meta_data ->> 'pin_code', ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        pin_code = coalesce(excluded.pin_code, public.profiles.pin_code),
        is_active = true,
        updated_at = now();

  begin
    outlet_uuid := nullif(coalesce(new.raw_user_meta_data ->> 'outlet_id', new.raw_user_meta_data ->> 'outletId', ''), '')::uuid;
  exception when others then
    outlet_uuid := null;
  end;

  if outlet_uuid is not null then
    insert into public.user_outlets (user_id, outlet_id)
    values (new.id, outlet_uuid)
    on conflict (user_id, outlet_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
