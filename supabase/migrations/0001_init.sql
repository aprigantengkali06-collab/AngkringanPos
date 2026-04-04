create extension if not exists pgcrypto;

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_outlet_access(target_outlet_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_outlets uo
    join public.profiles p on p.id = uo.user_id
    where uo.user_id = auth.uid()
      and uo.outlet_id = target_outlet_id
      and p.is_active = true
  );
$$;

create or replace function public.can_manage_outlet(target_outlet_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_outlets uo
    join public.profiles p on p.id = uo.user_id
    where uo.user_id = auth.uid()
      and uo.outlet_id = target_outlet_id
      and p.is_active = true
      and p.role in ('owner','manager')
  );
$$;

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text,
  address text,
  phone text,
  timezone text not null default 'Asia/Jakarta',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner','manager','cashier')),
  pin_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_outlets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, outlet_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, name)
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  sku text,
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  is_manual_item boolean not null default false,
  is_available boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, sku)
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2),
  actual_cash numeric(12,2),
  cash_difference numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  order_no text not null,
  customer_name text,
  order_type text not null default 'dine_in' check (order_type in ('dine_in','takeaway','online')),
  source text not null default 'pos' check (source in ('pos','owner_dashboard','api')),
  status text not null default 'paid' check (status in ('draft','paid','void')),
  payment_method text not null check (payment_method in ('cash','transfer','qris')),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  service_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  change_amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  void_at timestamptz,
  void_reason text,
  updated_at timestamptz not null default now(),
  unique(outlet_id, order_no)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_id uuid references public.menus(id) on delete set null,
  item_name text not null,
  qty numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  cost_price numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method text not null check (payment_method in ('cash','transfer','qris')),
  amount numeric(12,2) not null default 0,
  reference_no text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null,
  spent_at timestamptz not null default now(),
  approval_status text not null default 'approved' check (approval_status in ('approved','pending','rejected')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.printer_settings (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  printer_name text not null,
  printer_type text not null check (printer_type in ('network','bluetooth','usb')),
  connection_value text not null,
  paper_width text not null default '58mm',
  auto_print_receipt boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branding_settings (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  brand_name text not null,
  logo_url text,
  primary_color text default '#F59E0B',
  secondary_color text default '#0F172A',
  receipt_footer text,
  instagram_url text,
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references public.outlets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_outlets_user_id on public.user_outlets(user_id);
create index if not exists idx_user_outlets_outlet_id on public.user_outlets(outlet_id);
create index if not exists idx_categories_outlet_id on public.categories(outlet_id);
create index if not exists idx_menus_outlet_id on public.menus(outlet_id);
create index if not exists idx_menus_category_id on public.menus(category_id);
create index if not exists idx_shifts_outlet_id_opened_at on public.shifts(outlet_id, opened_at desc);
create index if not exists idx_orders_outlet_created_at on public.orders(outlet_id, created_at desc);
create index if not exists idx_orders_outlet_paid_at on public.orders(outlet_id, paid_at desc);
create index if not exists idx_orders_shift_id on public.orders(shift_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_expenses_outlet_spent_at on public.expenses(outlet_id, spent_at desc);
create index if not exists idx_printer_settings_outlet_id on public.printer_settings(outlet_id);
create index if not exists idx_audit_logs_outlet_created_at on public.audit_logs(outlet_id, created_at desc);

create trigger tg_outlets_updated_at before update on public.outlets for each row execute function public.tg_set_updated_at();
create trigger tg_profiles_updated_at before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger tg_categories_updated_at before update on public.categories for each row execute function public.tg_set_updated_at();
create trigger tg_menus_updated_at before update on public.menus for each row execute function public.tg_set_updated_at();
create trigger tg_shifts_updated_at before update on public.shifts for each row execute function public.tg_set_updated_at();
create trigger tg_orders_updated_at before update on public.orders for each row execute function public.tg_set_updated_at();
create trigger tg_expenses_updated_at before update on public.expenses for each row execute function public.tg_set_updated_at();
create trigger tg_printer_settings_updated_at before update on public.printer_settings for each row execute function public.tg_set_updated_at();
create trigger tg_branding_settings_updated_at before update on public.branding_settings for each row execute function public.tg_set_updated_at();

create or replace view public.vw_daily_sales_summary as
select
  o.outlet_id,
  (o.paid_at at time zone 'Asia/Jakarta')::date as business_date,
  count(*) filter (where o.status = 'paid') as paid_orders_count,
  coalesce(sum(o.total) filter (where o.status = 'paid'), 0)::numeric(12,2) as gross_sales,
  coalesce(sum(oi.qty * oi.cost_price) filter (where o.status = 'paid'), 0)::numeric(12,2) as cogs,
  coalesce(e.expenses_amount, 0)::numeric(12,2) as expenses_amount,
  (coalesce(sum(o.total) filter (where o.status = 'paid'), 0)
   - coalesce(sum(oi.qty * oi.cost_price) filter (where o.status = 'paid'), 0)
   - coalesce(e.expenses_amount, 0))::numeric(12,2) as net_cash
from public.orders o
left join public.order_items oi on oi.order_id = o.id
left join (
  select outlet_id, (spent_at at time zone 'Asia/Jakarta')::date as business_date, sum(amount) as expenses_amount
  from public.expenses
  group by outlet_id, (spent_at at time zone 'Asia/Jakarta')::date
) e on e.outlet_id = o.outlet_id and e.business_date = (o.paid_at at time zone 'Asia/Jakarta')::date
group by o.outlet_id, (o.paid_at at time zone 'Asia/Jakarta')::date, e.expenses_amount;

alter table public.outlets enable row level security;
alter table public.profiles enable row level security;
alter table public.user_outlets enable row level security;
alter table public.categories enable row level security;
alter table public.menus enable row level security;
alter table public.shifts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.printer_settings enable row level security;
alter table public.branding_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_manager" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.user_outlets manager_uo
    join public.user_outlets target_uo on target_uo.outlet_id = manager_uo.outlet_id
    join public.profiles manager_p on manager_p.id = manager_uo.user_id
    where manager_uo.user_id = auth.uid() and manager_p.role in ('owner','manager') and target_uo.user_id = profiles.id
  )
);
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "user_outlets_select_own_scope" on public.user_outlets for select using (
  user_id = auth.uid() or public.can_manage_outlet(outlet_id)
);
create policy "user_outlets_manage_manager" on public.user_outlets for all using (public.can_manage_outlet(outlet_id)) with check (public.can_manage_outlet(outlet_id));

create policy "outlets_select_scope" on public.outlets for select using (public.has_outlet_access(id));
create policy "outlets_manage_manager" on public.outlets for update using (public.can_manage_outlet(id)) with check (public.can_manage_outlet(id));

create policy "categories_select_scope" on public.categories for select using (public.has_outlet_access(outlet_id));
create policy "categories_manage_manager" on public.categories for all using (public.can_manage_outlet(outlet_id)) with check (public.can_manage_outlet(outlet_id));

create policy "menus_select_scope" on public.menus for select using (public.has_outlet_access(outlet_id));
create policy "menus_manage_manager" on public.menus for all using (public.can_manage_outlet(outlet_id)) with check (public.can_manage_outlet(outlet_id));

create policy "shifts_select_scope" on public.shifts for select using (public.has_outlet_access(outlet_id));
create policy "shifts_insert_cashier" on public.shifts for insert with check (public.has_outlet_access(outlet_id));
create policy "shifts_update_manager_or_owner" on public.shifts for update using (public.has_outlet_access(outlet_id)) with check (public.has_outlet_access(outlet_id));

create policy "orders_select_scope" on public.orders for select using (public.has_outlet_access(outlet_id));
create policy "orders_insert_scope" on public.orders for insert with check (public.has_outlet_access(outlet_id) and created_by = auth.uid());
create policy "orders_update_scope" on public.orders for update using (public.has_outlet_access(outlet_id)) with check (public.has_outlet_access(outlet_id));
create policy "orders_delete_manager_only" on public.orders for delete using (public.can_manage_outlet(outlet_id));

create policy "order_items_select_scope" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_outlet_access(o.outlet_id))
);
create policy "order_items_write_scope" on public.order_items for all using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_outlet_access(o.outlet_id))
) with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_outlet_access(o.outlet_id))
);

create policy "order_payments_select_scope" on public.order_payments for select using (
  exists (select 1 from public.orders o where o.id = order_payments.order_id and public.has_outlet_access(o.outlet_id))
);
create policy "order_payments_write_scope" on public.order_payments for all using (
  exists (select 1 from public.orders o where o.id = order_payments.order_id and public.has_outlet_access(o.outlet_id))
) with check (
  exists (select 1 from public.orders o where o.id = order_payments.order_id and public.has_outlet_access(o.outlet_id))
);

create policy "expenses_select_scope" on public.expenses for select using (public.has_outlet_access(outlet_id));
create policy "expenses_insert_scope" on public.expenses for insert with check (public.has_outlet_access(outlet_id) and created_by = auth.uid());
create policy "expenses_update_scope" on public.expenses for update using (public.has_outlet_access(outlet_id)) with check (public.has_outlet_access(outlet_id));
create policy "expenses_delete_manager_only" on public.expenses for delete using (public.can_manage_outlet(outlet_id));

create policy "printer_settings_select_scope" on public.printer_settings for select using (public.has_outlet_access(outlet_id));
create policy "printer_settings_manage_manager" on public.printer_settings for all using (public.can_manage_outlet(outlet_id)) with check (public.can_manage_outlet(outlet_id));

create policy "branding_settings_select_scope" on public.branding_settings for select using (public.has_outlet_access(outlet_id));
create policy "branding_settings_manage_manager" on public.branding_settings for all using (public.can_manage_outlet(outlet_id)) with check (public.can_manage_outlet(outlet_id));

create policy "audit_logs_select_manager" on public.audit_logs for select using (public.has_outlet_access(outlet_id));
create policy "audit_logs_insert_scope" on public.audit_logs for insert with check (public.has_outlet_access(outlet_id));
