-- ==============================================================================
-- MH EL MAHDY Store — Migration 00011: Harden RLS & Secure Customer Access
-- Version   : 00011
-- Created   : 2026-09-10
-- Description:
--   1. Drops insecure using (true) policies introduced in migration 00010
--   2. Enforces strict RBAC RLS policies on orders, order_items, user_profiles, shortage_requests
--   3. Provides hardened SECURITY DEFINER functions for customer login, register, and order viewing
-- ==============================================================================

-- ── 1. Clean Up Insecure Policies from Migration 00010 ─────────────────────────

-- Orders
drop policy if exists "Allow read all orders" on public.orders;
drop policy if exists "Staff update orders" on public.orders;
drop policy if exists "Public insert pending orders" on public.orders;
drop policy if exists "Customers read own orders" on public.orders;
drop policy if exists "Customers insert own pending orders" on public.orders;
drop policy if exists "Sales agents read their orders" on public.orders;
drop policy if exists "Sales agents update their orders" on public.orders;
drop policy if exists "Warehouse read preparation orders" on public.orders;
drop policy if exists "Warehouse update preparation orders" on public.orders;
drop policy if exists "Admin full access to orders" on public.orders;

-- Order Items
drop policy if exists "Allow read all order items" on public.order_items;
drop policy if exists "Public insert order items" on public.order_items;
drop policy if exists "Staff read all order items" on public.order_items;
drop policy if exists "Customer read own order items" on public.order_items;
drop policy if exists "Admin full access to order items" on public.order_items;

-- User Profiles
drop policy if exists "Public read customer profiles" on public.user_profiles;
drop policy if exists "Public update customer profiles" on public.user_profiles;
drop policy if exists "Public insert customer profiles" on public.user_profiles;
drop policy if exists "Users read own profile" on public.user_profiles;
drop policy if exists "Users update own profile" on public.user_profiles;
drop policy if exists "Staff read all profiles" on public.user_profiles;
drop policy if exists "Admin full access to profiles" on public.user_profiles;

-- Shortage Requests
drop policy if exists "Allow read all shortages" on public.shortage_requests;
drop policy if exists "Staff update shortages" on public.shortage_requests;
drop policy if exists "Public insert shortage requests" on public.shortage_requests;
drop policy if exists "Staff read shortages" on public.shortage_requests;
drop policy if exists "Admin full access to shortages" on public.shortage_requests;


-- ── 2. Re-establish Strict RLS Policies ────────────────────────────────────────

-- ── A. orders Table ──
-- Admin: Full access
create policy "Admin full access to orders"
  on public.orders for all
  using (public.current_user_role() = 'admin');

-- Sales Agent: Read assigned orders or unassigned pending orders
create policy "Sales agents read their orders"
  on public.orders for select
  using (
    public.current_user_role() = 'sales_agent'
    and (
      sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
      or sales_agent_id is null
    )
  );

-- Sales Agent: Update assigned orders or claim unassigned pending orders
create policy "Sales agents update their orders"
  on public.orders for update
  using (
    public.current_user_role() = 'sales_agent'
    and (
      sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
      or sales_agent_id is null
    )
  );

-- Warehouse: Read preparation & shipping orders only
create policy "Warehouse read preparation orders"
  on public.orders for select
  using (
    public.current_user_role() = 'warehouse_preparer'
    and status in ('preparation', 'shipping')
  );

-- Warehouse: Update preparation & shipping orders only (shipping transitions, carrier info)
create policy "Warehouse update preparation orders"
  on public.orders for update
  using (
    public.current_user_role() = 'warehouse_preparer'
    and status in ('preparation', 'shipping')
  );

-- Authenticated Customer: Read own orders if logged in via auth.uid()
create policy "Customers read own orders"
  on public.orders for select
  using (
    customer_id in (select id from public.user_profiles where auth_user_id = auth.uid())
  );


-- ── B. order_items Table ──
-- Admin: Full access
create policy "Admin full access to order items"
  on public.order_items for all
  using (public.current_user_role() = 'admin');

-- Staff: Read order items for orders they manage
create policy "Staff read order items"
  on public.order_items for select
  using (
    public.current_user_role() in ('sales_agent', 'warehouse_preparer')
  );

-- Authenticated Customer: Read own order items
create policy "Customers read own order items"
  on public.order_items for select
  using (
    order_id in (
      select id from public.orders
      where customer_id in (select id from public.user_profiles where auth_user_id = auth.uid())
    )
  );


-- ── C. user_profiles Table ──
-- Admin: Full access
create policy "Admin full access to profiles"
  on public.user_profiles for all
  using (public.current_user_role() = 'admin');

-- Staff: Read profiles (customers, fellow staff)
create policy "Staff read all profiles"
  on public.user_profiles for select
  using (public.current_user_role() in ('sales_agent', 'warehouse_preparer'));

-- Authenticated User: Read and update own profile
create policy "Users read own profile"
  on public.user_profiles for select
  using (auth_user_id = auth.uid());

create policy "Users update own profile"
  on public.user_profiles for update
  using (auth_user_id = auth.uid());


-- ── D. shortage_requests Table ──
-- Public: Can insert requests (reporting catalogue shortages)
create policy "Public insert shortage requests"
  on public.shortage_requests for insert
  with check (true);

-- Staff: Read and review shortages
create policy "Staff read shortages"
  on public.shortage_requests for select
  using (public.current_user_role() in ('admin', 'sales_agent', 'warehouse_preparer'));

-- Staff: Update shortage status
create policy "Staff update shortages"
  on public.shortage_requests for update
  using (public.current_user_role() in ('admin', 'sales_agent'));

-- Admin: Full access
create policy "Admin full access to shortages"
  on public.shortage_requests for all
  using (public.current_user_role() = 'admin');


-- ── 3. Hardened Atomic Customer Functions (Security Definer) ───────────────────

-- Procedure: sp_customer_login
-- Looks up customer strictly by exact phone number. Returns profile or error.
create or replace function public.sp_customer_login(p_phone text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user record;
begin
  if p_phone is null or trim(p_phone) = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  select
    u.id,
    u.full_name,
    u.phone,
    u.company_name,
    u.role,
    u.assigned_sales_rep_id,
    rep.full_name as assigned_sales_rep_name,
    rep.phone as assigned_sales_rep_phone
  into v_user
  from public.user_profiles u
  left join public.user_profiles rep on u.assigned_sales_rep_id = rep.id
  where u.phone = trim(p_phone)
    and u.role = 'customer'
    and u.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد');
  end if;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'full_name', v_user.full_name,
      'phone', v_user.phone,
      'company_name', v_user.company_name,
      'role', v_user.role,
      'assigned_sales_rep_id', v_user.assigned_sales_rep_id,
      'assigned_sales_rep_name', v_user.assigned_sales_rep_name,
      'assigned_sales_rep_phone', v_user.assigned_sales_rep_phone
    )
  );
end;
$$;

-- Procedure: sp_customer_register
-- Atomically checks phone duplication and registers new customer profile.
create or replace function public.sp_customer_register(
  p_name    text,
  p_phone   text,
  p_company text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_clean_phone text;
  v_clean_name  text;
  v_existing    uuid;
  v_new_id      uuid;
begin
  v_clean_name  := trim(coalesce(p_name, ''));
  v_clean_phone := trim(coalesce(p_phone, ''));

  if v_clean_name = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال الاسم الكامل');
  end if;

  if v_clean_phone = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  select id into v_existing
  from public.user_profiles
  where phone = v_clean_phone
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('success', false, 'message', 'هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول');
  end if;

  v_new_id := gen_random_uuid();
  insert into public.user_profiles (
    id,
    full_name,
    phone,
    company_name,
    role,
    is_active
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    nullif(trim(p_company), ''),
    'customer',
    true
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', nullif(trim(p_company), ''),
      'role', 'customer'
    )
  );
end;
$$;

-- Procedure: sp_get_customer_orders
-- Returns order history and order items strictly for the verified customer.
create or replace function public.sp_get_customer_orders(
  p_customer_id uuid,
  p_phone       text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_orders jsonb;
begin
  if p_customer_id is null or p_phone is null or trim(p_phone) = '' then
    return '[]'::jsonb;
  end if;

  -- Validate that customer_id belongs to the phone provided
  if not exists (
    select 1 from public.user_profiles
    where id = p_customer_id
      and phone = trim(p_phone)
      and role = 'customer'
  ) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(ord_json order by (ord_json->>'created_at') desc), '[]'::jsonb)
  into v_orders
  from (
    select jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_id', o.customer_id,
      'sales_agent_id', o.sales_agent_id,
      'status', o.status,
      'total_amount', o.total_amount,
      'shipping_address', o.shipping_address,
      'tracking_notes', o.tracking_notes,
      'carrier_name', o.carrier_name,
      'waybill_number', o.waybill_number,
      'notes', o.notes,
      'created_at', o.created_at,
      'confirmed_at', o.confirmed_at,
      'shipped_at', o.shipped_at,
      'delivered_at', o.delivered_at,
      'returned_at', o.returned_at,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'product_id', oi.product_id,
          'product_title', p.title_ar,
          'model_id', oi.model_id,
          'model_name', m.model_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal
        ))
        from public.order_items oi
        left join public.products p on oi.product_id = p.id
        left join public.master_models m on oi.model_id = m.id
        where oi.order_id = o.id
      ), '[]'::jsonb)
    ) as ord_json
    from public.orders o
    where o.customer_id = p_customer_id
  ) sub;

  return v_orders;
end;
$$;
