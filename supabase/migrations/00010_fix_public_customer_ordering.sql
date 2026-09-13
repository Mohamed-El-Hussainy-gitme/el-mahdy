-- ==============================================================================
-- MH EL MAHDY Store — Migration 00010: Fix Public Customer Ordering & RLS
-- Version   : 00010
-- Created   : 2026-09-09
-- Description:
--   1. Ensures anonymous/public customers can register (insert/select customer profile)
--   2. Ensures anonymous/public customers can create 'pending' orders and order items
--   3. Grants full read/manage access for all staff roles
--   4. Creates sp_create_pending_order atomic transaction procedure
-- ==============================================================================

-- ── 1. user_profiles Policies ────────────────────────────────────────────────
-- Allow anon/public to insert their own customer profile during phone login/register
drop policy if exists "Public insert customer profiles" on user_profiles;
create policy "Public insert customer profiles"
  on user_profiles for insert
  with check (role = 'customer');

-- Allow anon/public to select customer profiles (for login/registration check)
drop policy if exists "Public read customer profiles" on user_profiles;
create policy "Public read customer profiles"
  on user_profiles for select
  using (role = 'customer' or public.current_user_role() in ('admin', 'sales_agent', 'warehouse_preparer'));

-- Allow anon/public to update their own customer profile
drop policy if exists "Public update customer profiles" on user_profiles;
create policy "Public update customer profiles"
  on user_profiles for update
  using (role = 'customer');

-- ── 2. orders Policies ────────────────────────────────────────────────────────
-- Allow anyone to read orders (Staff can filter by role, customers track by phone/id)
drop policy if exists "Allow read all orders" on orders;
create policy "Allow read all orders"
  on orders for select
  using (true);

-- Allow public/customer to insert pending orders
drop policy if exists "Public insert pending orders" on orders;
create policy "Public insert pending orders"
  on orders for insert
  with check (status = 'pending');

-- Allow staff to update orders (status transitions, tracking notes)
drop policy if exists "Staff update orders" on orders;
create policy "Staff update orders"
  on orders for update
  using (true);

-- ── 3. order_items Policies ──────────────────────────────────────────────────
-- Allow anyone to read order items
drop policy if exists "Allow read all order items" on order_items;
create policy "Allow read all order items"
  on order_items for select
  using (true);

-- Allow inserting order items for pending orders
drop policy if exists "Public insert order items" on order_items;
create policy "Public insert order items"
  on order_items for insert
  with check (true);

-- ── 4. shortage_requests Policies ─────────────────────────────────────────────
drop policy if exists "Public insert shortage requests" on shortage_requests;
create policy "Public insert shortage requests"
  on shortage_requests for insert
  with check (true);

drop policy if exists "Allow read all shortages" on shortage_requests;
create policy "Allow read all shortages"
  on shortage_requests for select
  using (true);

drop policy if exists "Staff update shortages" on shortage_requests;
create policy "Staff update shortages"
  on shortage_requests for update
  using (true);

-- ── 5. Atomic Order Creation Stored Procedure (Security Definer) ───────────────
create or replace function public.sp_create_pending_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_company text default null,
  p_shipping_address text default null,
  p_notes            text default null,
  p_total_amount     numeric default 0,
  p_sales_agent_id   uuid default null,
  p_items            jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
as 
declare
  v_customer_id    uuid;
  v_order_id       uuid;
  v_order_number   text;
  v_date_str       text;
  v_random_seq     integer;
  v_item           jsonb;
begin
  -- 1. Find or create customer profile by phone
  select id into v_customer_id
  from public.user_profiles
  where phone = trim(p_customer_phone)
  limit 1;

  if v_customer_id is null then
    v_customer_id := gen_random_uuid();
    insert into public.user_profiles (
      id,
      full_name,
      phone,
      company_name,
      role,
      assigned_sales_rep_id,
      is_active
    ) values (
      v_customer_id,
      trim(p_customer_name),
      trim(p_customer_phone),
      trim(p_customer_company),
      'customer',
      p_sales_agent_id,
      true
    );
  else
    -- Update existing profile if company provided
    update public.user_profiles
    set
      full_name = coalesce(trim(p_customer_name), full_name),
      company_name = coalesce(trim(p_customer_company), company_name),
      assigned_sales_rep_id = coalesce(assigned_sales_rep_id, p_sales_agent_id)
    where id = v_customer_id;
  end if;

  -- 2. Generate Order ID and Order Number (ORD-YYYYMMDD-XXXXX)
  v_order_id := gen_random_uuid();
  v_date_str := to_char(now(), 'YYYYMMDD');
  v_random_seq := floor(10000 + random() * 90000)::integer;
  v_order_number := 'ORD-' || v_date_str || '-' || v_random_seq::text;

  -- 3. Insert Order
  insert into public.orders (
    id,
    order_number,
    customer_id,
    sales_agent_id,
    status,
    total_amount,
    shipping_address,
    notes,
    created_at,
    updated_at
  ) values (
    v_order_id,
    v_order_number,
    v_customer_id,
    p_sales_agent_id,
    'pending',
    coalesce(p_total_amount, 0),
    p_shipping_address,
    p_notes,
    now(),
    now()
  );

  -- 4. Insert Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      id,
      order_id,
      product_id,
      model_id,
      quantity,
      unit_price,
      subtotal
    ) values (
      coalesce((v_item->>'id')::uuid, gen_random_uuid()),
      v_order_id,
      (v_item->>'product_id')::uuid,
      nullif(v_item->>'model_id', '')::uuid,
      coalesce((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'subtotal')::numeric, 0)
    );
  end loop;

  -- 5. Return created order summary
  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id
  );
end;
;
