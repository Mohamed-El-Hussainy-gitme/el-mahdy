-- ==============================================================================
-- MH EL MAHDY Store — Migration 00003: RLS Policies & Business Logic Triggers
-- Version   : 00003
-- Created   : 2026-09-08
-- Description:
--   1. Row Level Security (RLS) per RBAC roles:
--      • Public  : read active categories, products, master_models, matrix
--      • Customer : create/view their own orders & shortage logs
--      • Sales Agent   : view/confirm orders of their sticky-assigned customers
--      • Warehouse     : view orders in 'preparation'/'shipping' only
--      • Admin   : full read/write on all tables
--   2. Order Lifecycle Trigger:
--      • Stock deducted ONLY on pending → preparation (sales rep confirmation)
--      • confirmed_at / shipped_at / delivered_at / returned_at auto-stamped
--      • Invalid status transitions are rejected with RAISE EXCEPTION
--   3. stock_status auto-sync trigger on product_model_matrix
--   4. order_number auto-generation trigger on orders
-- ==============================================================================

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table categories          enable row level security;
alter table master_models       enable row level security;
alter table products            enable row level security;
alter table product_categories  enable row level security;
alter table product_model_matrix enable row level security;
alter table user_profiles       enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table shortage_requests   enable row level security;

-- ── Helper: get current user's role ──────────────────────────────────────────
-- Looks up the role from user_profiles using auth.uid() → auth_user_id join.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role
  from   public.user_profiles
  where  auth_user_id = auth.uid()
  limit  1;
$$;

-- ── 1. Categories ─────────────────────────────────────────────────────────────
-- Public can read active categories (browsing/filtering)
-- Admin has full control (CRUD)
create policy "Public read active categories"
  on categories for select
  using (is_active = true);

create policy "Admin full access to categories"
  on categories for all
  using (public.current_user_role() = 'admin');

-- ── 2. Master Models ─────────────────────────────────────────────────────────
create policy "Public read master models"
  on master_models for select
  using (true);

create policy "Admin full access to master models"
  on master_models for all
  using (public.current_user_role() = 'admin');

-- ── 3. Products ───────────────────────────────────────────────────────────────
create policy "Public read active products"
  on products for select
  using (is_active = true);

create policy "Admin full access to products"
  on products for all
  using (public.current_user_role() = 'admin');

-- ── 4. Product ↔ Category ─────────────────────────────────────────────────────
create policy "Public read product categories"
  on product_categories for select
  using (true);

create policy "Admin full access to product categories"
  on product_categories for all
  using (public.current_user_role() = 'admin');

-- ── 5. Compatibility Matrix ───────────────────────────────────────────────────
create policy "Public read compatibility matrix"
  on product_model_matrix for select
  using (true);

create policy "Admin full access to compatibility matrix"
  on product_model_matrix for all
  using (public.current_user_role() = 'admin');

-- ── 6. User Profiles ─────────────────────────────────────────────────────────
-- Users can see and update their own profile
create policy "Users read own profile"
  on user_profiles for select
  using (auth_user_id = auth.uid());

create policy "Users update own profile"
  on user_profiles for update
  using (auth_user_id = auth.uid());

-- Staff (any role) can read customer profiles (e.g. to confirm sticky assignment)
create policy "Staff read all profiles"
  on user_profiles for select
  using (public.current_user_role() in ('admin', 'sales_agent', 'warehouse_preparer'));

-- Admin full control
create policy "Admin full access to profiles"
  on user_profiles for all
  using (public.current_user_role() = 'admin');

-- ── 7. Orders ─────────────────────────────────────────────────────────────────
-- Customer: see and create their own pending orders only
create policy "Customers read own orders"
  on orders for select
  using (customer_id = (
    select id from public.user_profiles where auth_user_id = auth.uid() limit 1
  ));

create policy "Customers insert own pending orders"
  on orders for insert
  with check (
    customer_id = (
      select id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
    and status = 'pending'
  );

-- Sales Agent: see orders of their assigned customers AND unassigned pending orders
create policy "Sales agents read their orders"
  on orders for select
  using (
    public.current_user_role() = 'sales_agent'
    and (
      sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
      or sales_agent_id is null
    )
  );

-- Sales Agent can update (confirm pending → preparation, claim unassigned)
create policy "Sales agents update their orders"
  on orders for update
  using (
    public.current_user_role() = 'sales_agent'
    and (
      sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
      or sales_agent_id is null
    )
  );

-- Warehouse: see and update preparation/shipping orders only
create policy "Warehouse read preparation orders"
  on orders for select
  using (
    public.current_user_role() = 'warehouse_preparer'
    and status in ('preparation', 'shipping')
  );

create policy "Warehouse update preparation orders"
  on orders for update
  using (
    public.current_user_role() = 'warehouse_preparer'
    and status in ('preparation', 'shipping')
  );

-- Admin: full access
create policy "Admin full access to orders"
  on orders for all
  using (public.current_user_role() = 'admin');

-- ── 8. Order Items ────────────────────────────────────────────────────────────
-- Readable if the parent order is accessible (inherits order-level policy via exists)
create policy "Order items readable by order viewers"
  on order_items for select
  using (
    exists (select 1 from public.orders where orders.id = order_items.order_id)
  );

create policy "Customers insert items on own pending orders"
  on order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.customer_id = (
          select id from public.user_profiles where auth_user_id = auth.uid() limit 1
        )
        and orders.status = 'pending'
    )
  );

create policy "Admin full access to order items"
  on order_items for all
  using (public.current_user_role() = 'admin');

-- ── 9. Shortage Requests ──────────────────────────────────────────────────────
create policy "Customers insert shortage requests"
  on shortage_requests for insert
  with check (
    customer_id = (
      select id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
    or customer_id is null  -- allow anonymous shortage logging
  );

create policy "Customers read own shortage requests"
  on shortage_requests for select
  using (
    customer_id = (
      select id from public.user_profiles where auth_user_id = auth.uid() limit 1
    )
  );

create policy "Admin full access to shortage requests"
  on shortage_requests for all
  using (public.current_user_role() = 'admin');

-- Sales agents can view shortage requests to spot demand patterns
create policy "Sales agents read shortage requests"
  on shortage_requests for select
  using (public.current_user_role() = 'sales_agent');

-- ==============================================================================
-- TRIGGER 1: Order Lifecycle — Status Transition Validation & Timestamp Stamping
-- ==============================================================================
-- Valid transitions (role-gated in application layer, enforced structurally here):
--   pending      → preparation  (sales_agent confirms → stocks deducted, confirmed_at set)
--   preparation  → shipping     (warehouse marks as shipped, shipped_at set)
--   shipping     → delivered    (delivered_at set)
--   shipping     → returned     (returned_at set)
--   ANY          → returned     (admin override only — enforced by app RBAC)
--
-- IMPORTANT: Stock is deducted ONCE on pending → preparation.
--            Adding to cart does NOT affect stock.
-- ==============================================================================
create or replace function public.handle_order_lifecycle()
returns trigger
language plpgsql
security definer
as $$
declare
  v_item         record;
  v_new_qty      integer;
  v_new_status   text;
  v_valid        boolean;
begin
  -- ── Guard: reject same-status no-ops silently ──────────────────────────────
  if old.status = new.status then
    return new;
  end if;

  -- ── Validate allowed transitions ──────────────────────────────────────────
  v_valid := case
    when old.status = 'pending'     and new.status = 'preparation' then true
    when old.status = 'preparation' and new.status = 'shipping'    then true
    when old.status = 'shipping'    and new.status = 'delivered'   then true
    when old.status = 'shipping'    and new.status = 'returned'    then true
    -- Admin can return from any status (checked at app layer by role)
    when new.status = 'returned'                                    then true
    else false
  end;

  if not v_valid then
    raise exception
      'Invalid order status transition: % → %. Allowed: pending→preparation, preparation→shipping, shipping→delivered/returned.',
      old.status, new.status;
  end if;

  -- ── pending → preparation: deduct stock ───────────────────────────────────
  if old.status = 'pending' and new.status = 'preparation' then
    new.confirmed_at := now();

    for v_item in
      select product_id, model_id, quantity
      from   public.order_items
      where  order_id = new.id
    loop
      if v_item.model_id is not null then
        -- Deduct stock (floor at 0)
        update public.product_model_matrix
        set
          stock_quantity = greatest(0, stock_quantity - v_item.quantity),
          stock_status   = case
            when greatest(0, stock_quantity - v_item.quantity) = 0       then 'out_of_stock'
            when greatest(0, stock_quantity - v_item.quantity) <= 10     then 'limited'
            else                                                               'in_stock'
          end,
          updated_at = now()
        where product_id = v_item.product_id
          and model_id   = v_item.model_id;
      end if;
    end loop;
  end if;

  -- ── preparation → shipping: stamp shipped_at ─────────────────────────────
  if old.status = 'preparation' and new.status = 'shipping' then
    new.shipped_at := now();
  end if;

  -- ── shipping → delivered: stamp delivered_at ─────────────────────────────
  if old.status = 'shipping' and new.status = 'delivered' then
    new.delivered_at := now();
  end if;

  -- ── → returned: stamp returned_at ────────────────────────────────────────
  if new.status = 'returned' and old.status != 'returned' then
    new.returned_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_lifecycle on orders;
create trigger trg_order_lifecycle
before update on orders
for each row
execute function public.handle_order_lifecycle();

-- ==============================================================================
-- TRIGGER 2: Auto-generate order_number on INSERT
-- Format: ORD-YYYYMMDD-XXXXX (e.g. ORD-20260908-00001)
-- ==============================================================================
create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
declare
  v_date_part   text;
  v_seq         integer;
  v_order_num   text;
begin
  if new.order_number is null or new.order_number = '' then
    v_date_part := to_char(now(), 'YYYYMMDD');
    select coalesce(max(
      (regexp_match(order_number, 'ORD-\d{8}-(\d+)'))[1]::integer
    ), 0) + 1
    into v_seq
    from public.orders
    where order_number like 'ORD-' || v_date_part || '-%';

    v_order_num := 'ORD-' || v_date_part || '-' || lpad(v_seq::text, 5, '0');
    new.order_number := v_order_num;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_number on orders;
create trigger trg_order_number
before insert on orders
for each row
execute function public.generate_order_number();

-- ==============================================================================
-- TRIGGER 3: Auto-sync stock_status when stock_quantity changes on matrix
-- ==============================================================================
create or replace function public.sync_stock_status()
returns trigger
language plpgsql
as $$
begin
  new.stock_status := case
    when new.stock_quantity = 0   then 'out_of_stock'
    when new.stock_quantity <= 10 then 'limited'
    else                               'in_stock'
  end;
  return new;
end;
$$;

drop trigger if exists trg_sync_stock_status on product_model_matrix;
create trigger trg_sync_stock_status
before insert or update of stock_quantity on product_model_matrix
for each row
execute function public.sync_stock_status();

-- ==============================================================================
-- TRIGGER 4: Auto-set sticky sales rep assignment
-- When a customer places an order and no sales_agent_id is set on the order,
-- this trigger assigns the customer's existing assigned_sales_rep_id if present.
-- ==============================================================================
create or replace function public.apply_sticky_sales_rep()
returns trigger
language plpgsql
security definer
as $$
declare
  v_rep_id uuid;
begin
  -- Only on INSERT (new order creation)
  if tg_op = 'INSERT' then
    -- If no sales agent assigned yet, pull from customer's sticky assignment
    if new.sales_agent_id is null then
      select assigned_sales_rep_id
      into   v_rep_id
      from   public.user_profiles
      where  id = new.customer_id
      limit  1;

      if v_rep_id is not null then
        new.sales_agent_id := v_rep_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_sticky_rep on orders;
create trigger trg_apply_sticky_rep
before insert on orders
for each row
execute function public.apply_sticky_sales_rep();
