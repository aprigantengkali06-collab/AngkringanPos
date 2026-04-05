create or replace function public.generate_order_no_jakarta()
returns text
language plpgsql
as $$
declare
  dt timestamp without time zone := timezone('Asia/Jakarta', now());
begin
  return 'ORD-'
    || to_char(dt, 'YYYYMMDD-HH24MISS-')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
end;
$$;

create or replace function public.bootstrap_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user auth.users%rowtype;
  v_role text;
  v_full_name text;
  v_outlet_id uuid;
  v_first_outlet uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_user from auth.users where id = v_user_id;
  if not found then
    raise exception 'User auth tidak ditemukan';
  end if;

  v_role := lower(coalesce(v_user.raw_user_meta_data ->> 'role', 'cashier'));
  if v_role not in ('owner', 'manager', 'cashier') then
    v_role := 'cashier';
  end if;

  v_full_name := trim(coalesce(
    v_user.raw_user_meta_data ->> 'full_name',
    v_user.raw_user_meta_data ->> 'name',
    split_part(coalesce(v_user.email, 'user@local'), '@', 1),
    'User POS'
  ));

  insert into public.profiles (id, email, full_name, role, pin_code, is_active)
  values (
    v_user_id,
    v_user.email,
    v_full_name,
    v_role,
    nullif(v_user.raw_user_meta_data ->> 'pin_code', ''),
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
    v_outlet_id := nullif(coalesce(v_user.raw_user_meta_data ->> 'outlet_id', v_user.raw_user_meta_data ->> 'outletId', ''), '')::uuid;
  exception when others then
    v_outlet_id := null;
  end;

  if v_outlet_id is null then
    select outlet_id into v_outlet_id
    from public.user_outlets
    where user_id = v_user_id
    limit 1;
  end if;

  if v_outlet_id is null then
    select id into v_first_outlet
    from public.outlets
    where is_active = true
    order by created_at asc
    limit 1;

    v_outlet_id := v_first_outlet;
  end if;

  if v_outlet_id is not null then
    insert into public.user_outlets (user_id, outlet_id)
    values (v_user_id, v_outlet_id)
    on conflict (user_id, outlet_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'outlet_id', v_outlet_id
  );
end;
$$;

grant execute on function public.bootstrap_workspace() to authenticated;

create or replace function public.create_order_pos(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_outlet_id uuid;
  v_payment_method text;
  v_order_type text;
  v_customer_name text;
  v_notes text;
  v_requested_paid numeric(12,2);
  v_paid_amount numeric(12,2);
  v_change_amount numeric(12,2);
  v_shift_id uuid;
  v_order_id uuid;
  v_order_no text;
  v_paid_at timestamptz := now();
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  item jsonb;
  item_name text;
  item_qty numeric(12,2);
  item_unit_price numeric(12,2);
  item_cost_price numeric(12,2);
  item_discount numeric(12,2);
  item_subtotal numeric(12,2);
  item_notes text;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  perform public.bootstrap_workspace();

  v_outlet_id := nullif(payload ->> 'outlet_id', '')::uuid;
  v_payment_method := lower(coalesce(payload ->> 'payment_method', ''));
  v_order_type := lower(coalesce(payload ->> 'order_type', 'dine_in'));
  v_customer_name := nullif(trim(coalesce(payload ->> 'customer_name', '')), '');
  v_notes := nullif(trim(coalesce(payload ->> 'notes', '')), '');
  v_requested_paid := nullif(payload ->> 'paid_amount', '')::numeric;

  if v_outlet_id is null then
    raise exception 'outlet_id wajib diisi.';
  end if;

  if not public.has_outlet_access(v_outlet_id) then
    raise exception 'Anda tidak punya akses ke outlet ini.';
  end if;

  if v_payment_method not in ('cash', 'transfer', 'qris') then
    raise exception 'payment_method tidak valid.';
  end if;

  if v_order_type not in ('dine_in', 'takeaway', 'online') then
    raise exception 'order_type tidak valid.';
  end if;

  if jsonb_typeof(payload -> 'items') is distinct from 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'items tidak boleh kosong.';
  end if;

  v_shift_id := nullif(payload ->> 'shift_id', '')::uuid;
  if v_shift_id is null then
    select id into v_shift_id
    from public.shifts
    where outlet_id = v_outlet_id and status = 'open'
    order by opened_at desc
    limit 1;
  end if;

  for item in select * from jsonb_array_elements(payload -> 'items') loop
    item_name := trim(coalesce(item ->> 'item_name', ''));
    item_qty := coalesce(nullif(item ->> 'qty', '')::numeric, 0);
    item_unit_price := coalesce(nullif(item ->> 'unit_price', '')::numeric, 0);
    item_cost_price := coalesce(nullif(item ->> 'cost_price', '')::numeric, 0);
    item_discount := coalesce(nullif(item ->> 'discount_amount', '')::numeric, 0);
    item_subtotal := greatest((item_qty * item_unit_price) - item_discount, 0);

    if item_name = '' or item_qty <= 0 or item_unit_price < 0 then
      raise exception 'Ada item transaksi yang tidak valid.';
    end if;

    v_subtotal := v_subtotal + item_subtotal;
  end loop;

  v_total := v_subtotal;
  v_paid_amount := coalesce(v_requested_paid, v_total);

  if v_payment_method = 'cash' and v_paid_amount < v_total then
    raise exception 'Nominal dibayar kurang dari total transaksi.';
  end if;

  if v_payment_method <> 'cash' and v_paid_amount <= 0 then
    v_paid_amount := v_total;
  end if;

  v_change_amount := greatest(v_paid_amount - v_total, 0);
  v_order_no := public.generate_order_no_jakarta();

  insert into public.orders (
    outlet_id,
    shift_id,
    order_no,
    customer_name,
    order_type,
    source,
    status,
    payment_method,
    subtotal,
    discount_amount,
    service_amount,
    tax_amount,
    total,
    paid_amount,
    change_amount,
    notes,
    created_by,
    paid_at
  )
  values (
    v_outlet_id,
    v_shift_id,
    v_order_no,
    v_customer_name,
    v_order_type,
    'pos',
    'paid',
    v_payment_method,
    v_subtotal,
    0,
    0,
    0,
    v_total,
    v_paid_amount,
    v_change_amount,
    v_notes,
    v_user_id,
    v_paid_at
  )
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(payload -> 'items') loop
    item_name := trim(coalesce(item ->> 'item_name', ''));
    item_qty := coalesce(nullif(item ->> 'qty', '')::numeric, 0);
    item_unit_price := coalesce(nullif(item ->> 'unit_price', '')::numeric, 0);
    item_cost_price := coalesce(nullif(item ->> 'cost_price', '')::numeric, 0);
    item_discount := coalesce(nullif(item ->> 'discount_amount', '')::numeric, 0);
    item_subtotal := greatest((item_qty * item_unit_price) - item_discount, 0);
    item_notes := nullif(trim(coalesce(item ->> 'notes', '')), '');

    insert into public.order_items (
      order_id,
      menu_id,
      item_name,
      qty,
      unit_price,
      cost_price,
      discount_amount,
      subtotal,
      notes
    )
    values (
      v_order_id,
      nullif(item ->> 'menu_id', '')::uuid,
      item_name,
      item_qty,
      item_unit_price,
      item_cost_price,
      item_discount,
      item_subtotal,
      item_notes
    );
  end loop;

  insert into public.order_payments (order_id, payment_method, amount, paid_at)
  values (v_order_id, v_payment_method, v_paid_amount, v_paid_at);

  insert into public.audit_logs (outlet_id, user_id, action, entity, entity_id, payload)
  values (
    v_outlet_id,
    v_user_id,
    'create',
    'orders',
    v_order_id::text,
    jsonb_build_object(
      'order_no', v_order_no,
      'total', v_total,
      'payment_method', v_payment_method
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_no', v_order_no,
    'total', v_total,
    'change_amount', v_change_amount,
    'paid_at', v_paid_at
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.create_order_pos(jsonb) to authenticated;

create or replace function public.close_shift_pos(
  p_shift_id uuid,
  p_actual_cash numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shift record;
  v_cash_sales numeric(12,2) := 0;
  v_expenses numeric(12,2) := 0;
  v_expected_cash numeric(12,2) := 0;
  v_actual_cash numeric(12,2) := coalesce(p_actual_cash, 0);
  v_difference numeric(12,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_shift
  from public.shifts
  where id = p_shift_id
  limit 1;

  if not found then
    raise exception 'Shift tidak ditemukan.';
  end if;

  if not public.has_outlet_access(v_shift.outlet_id) then
    raise exception 'Anda tidak punya akses ke shift ini.';
  end if;

  if v_shift.status <> 'open' then
    raise exception 'Shift sudah ditutup.';
  end if;

  select coalesce(sum(total), 0)
    into v_cash_sales
  from public.orders
  where shift_id = p_shift_id
    and status = 'paid'
    and payment_method = 'cash';

  select coalesce(sum(amount), 0)
    into v_expenses
  from public.expenses
  where outlet_id = v_shift.outlet_id
    and spent_at >= v_shift.opened_at
    and spent_at <= now();

  v_expected_cash := coalesce(v_shift.opening_cash, 0) + v_cash_sales - v_expenses;
  v_difference := v_actual_cash - v_expected_cash;

  update public.shifts
  set closed_by = v_user_id,
      closed_at = now(),
      expected_cash = v_expected_cash,
      actual_cash = v_actual_cash,
      cash_difference = v_difference,
      notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
      status = 'closed',
      updated_at = now()
  where id = p_shift_id;

  insert into public.audit_logs (outlet_id, user_id, action, entity, entity_id, payload)
  values (
    v_shift.outlet_id,
    v_user_id,
    'close',
    'shifts',
    p_shift_id::text,
    jsonb_build_object(
      'expected_cash', v_expected_cash,
      'actual_cash', v_actual_cash,
      'cash_difference', v_difference
    )
  );

  return jsonb_build_object(
    'ok', true,
    'shift_id', p_shift_id,
    'expected_cash', v_expected_cash,
    'actual_cash', v_actual_cash,
    'cash_difference', v_difference
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.close_shift_pos(uuid, numeric, text) to authenticated;
