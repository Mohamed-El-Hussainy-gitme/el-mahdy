-- ==============================================================================
-- MH EL MAHDY B2B Store - Complete Consolidated Fresh Database Setup
-- Generated for New Supabase Project: dsoweayuqbdceymsuiii
-- Includes all tables, triggers, RPCs, storage bucket, and RLS policies (00001 to 00027)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ------------------------------------------------------------------------------
-- Migration: 00001_initial_schema.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store — Migration 00001: Initial Schema
-- Version: 00001
-- ==============================================================================

create extension if not exists "uuid-ossp";

-- Helper: auto-update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Categories
create table if not exists categories (
    id          uuid        primary key default gen_random_uuid(),
    name_ar     text        not null,
    slug        text        not null unique,
    icon        text,
    parent_id   uuid        references categories(id) on delete set null,
    sort_order  integer     not null default 0,
    is_active   boolean     not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_categories_parent_id on categories(parent_id);
create index if not exists idx_categories_slug      on categories(slug);
create index if not exists idx_categories_active    on categories(is_active);

create trigger trg_categories_updated_at
before update on categories
for each row execute function public.set_updated_at();

-- 2. Master Models
create table if not exists master_models (
    id           uuid        primary key default gen_random_uuid(),
    brand        text        not null,
    series       text,
    model_name   text        not null,
    release_year integer,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists idx_master_models_brand on master_models(brand);
create index if not exists idx_master_models_name  on master_models(model_name);

create trigger trg_master_models_updated_at
before update on master_models
for each row execute function public.set_updated_at();

-- 3. Products
create table if not exists products (
    id                       uuid          primary key default gen_random_uuid(),
    sku                      text          not null unique,
    title_ar                 text          not null,
    description_ar           text,
    image_url                text,
    gallery_urls             text[]        not null default '{}',
    price                    numeric(10,2) not null check (price >= 0),
    is_exchange_only         boolean       not null default false,
    is_featured              boolean       not null default false,
    is_active                boolean       not null default true,
    has_compatibility_matrix boolean       not null default false,
    created_at               timestamptz   not null default now(),
    updated_at               timestamptz   not null default now()
);

create index if not exists idx_products_sku      on products(sku);
create index if not exists idx_products_featured on products(is_featured) where is_featured = true;
create index if not exists idx_products_active   on products(is_active)   where is_active   = true;

create trigger trg_products_updated_at
before update on products
for each row execute function public.set_updated_at();

-- 4. Product Categories
create table if not exists product_categories (
    product_id  uuid not null references products(id)   on delete cascade,
    category_id uuid not null references categories(id) on delete cascade,
    primary key (product_id, category_id)
);

create index if not exists idx_product_categories_cat on product_categories(category_id);

-- 5. Product Model Matrix & Stock
create table if not exists product_model_matrix (
    id             uuid          primary key default gen_random_uuid(),
    product_id     uuid          not null references products(id)      on delete cascade,
    model_id       uuid          not null references master_models(id) on delete cascade,
    stock_quantity integer       not null default 0 check (stock_quantity >= 0),
    moq            integer       not null default 1 check (moq >= 1),
    stock_status   text          not null default 'in_stock'
                                 check (stock_status in ('in_stock', 'limited', 'out_of_stock')),
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),
    unique(product_id, model_id)
);

create index if not exists idx_matrix_product_id on product_model_matrix(product_id);
create index if not exists idx_matrix_model_id   on product_model_matrix(model_id);
create index if not exists idx_matrix_status     on product_model_matrix(stock_status);

create trigger trg_matrix_updated_at
before update on product_model_matrix
for each row execute function public.set_updated_at();

-- 6. User Profiles
create table if not exists user_profiles (
    id                    uuid        primary key default gen_random_uuid(),
    auth_user_id          uuid        unique references auth.users(id) on delete set null,
    email                 text        unique,
    full_name             text        not null,
    phone                 text        not null,
    company_name          text,
    city                  text,
    address               text,
    role                  text        not null default 'customer'
                                      check (role in ('admin', 'sales_agent', 'warehouse_preparer', 'customer')),
    assigned_sales_rep_id uuid        references user_profiles(id) on delete set null,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists idx_user_profiles_auth_user on user_profiles(auth_user_id);
create index if not exists idx_user_profiles_role      on user_profiles(role);
create index if not exists idx_user_profiles_sales_rep on user_profiles(assigned_sales_rep_id);
create index if not exists idx_user_profiles_email     on user_profiles(email);

create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute function public.set_updated_at();

-- 7. Orders
create table if not exists orders (
    id               uuid          primary key default gen_random_uuid(),
    order_number     text          not null unique default '',
    customer_id      uuid          not null references user_profiles(id) on delete restrict,
    sales_agent_id   uuid          references user_profiles(id)          on delete set null,
    status           text          not null default 'pending'
                                   check (status in ('pending', 'preparation', 'shipping', 'delivered', 'returned')),
    total_amount     numeric(10,2) not null default 0 check (total_amount >= 0),
    shipping_address text,
    tracking_notes   text,
    notes            text,
    created_at       timestamptz   not null default now(),
    confirmed_at     timestamptz,
    shipped_at       timestamptz,
    delivered_at     timestamptz,
    returned_at      timestamptz,
    updated_at       timestamptz   not null default now()
);

create index if not exists idx_orders_customer   on orders(customer_id);
create index if not exists idx_orders_sales_rep  on orders(sales_agent_id);
create index if not exists idx_orders_status     on orders(status);
create index if not exists idx_orders_created_at on orders(created_at desc);

create trigger trg_orders_updated_at
before update on orders
for each row execute function public.set_updated_at();

-- 8. Order Items
create table if not exists order_items (
    id         uuid          primary key default gen_random_uuid(),
    order_id   uuid          not null references orders(id)        on delete cascade,
    product_id uuid          not null references products(id)      on delete restrict,
    model_id   uuid          references master_models(id)          on delete set null,
    quantity   integer       not null default 1 check (quantity >= 1),
    unit_price numeric(10,2) not null check (unit_price >= 0),
    subtotal   numeric(10,2) not null check (subtotal >= 0),
    created_at timestamptz   not null default now()
);

create index if not exists idx_order_items_order   on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

-- 9. Shortage Requests
create table if not exists shortage_requests (
    id             uuid        primary key default gen_random_uuid(),
    customer_id    uuid        references user_profiles(id) on delete set null,
    customer_name  text,
    customer_phone text,
    brand          text        not null,
    model_name     text        not null,
    notes          text,
    status         text        not null default 'pending'
                               check (status in ('pending', 'reviewed')),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_shortage_status     on shortage_requests(status);
create index if not exists idx_shortage_customer   on shortage_requests(customer_id);
create index if not exists idx_shortage_created_at on shortage_requests(created_at desc);

create trigger trg_shortage_updated_at
before update on shortage_requests
for each row execute function public.set_updated_at();



-- ------------------------------------------------------------------------------
-- Migration: 00003_rls_and_policies.sql
-- ------------------------------------------------------------------------------

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



-- ------------------------------------------------------------------------------
-- Migration: 00004_operational_procedures.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store — Migration 00004: Operational Update Stored Procedures
-- Version: 00004
-- Description: Provides transaction-safe procedures to update orders, compatibility
--              matrix stock, and sticky sales representative assignments.
-- ==============================================================================

-- 1. Update Order Status with Role Check & Optional Tracking/Notes
create or replace function public.sp_update_order_status(
  p_order_id       uuid,
  p_new_status     text,
  p_tracking_notes text default null,
  p_notes          text default null
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set
    status         = p_new_status,
    tracking_notes = coalesce(p_tracking_notes, tracking_notes),
    notes          = coalesce(p_notes, notes),
    updated_at     = now()
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'Order with ID % not found', p_order_id;
  end if;

  return v_order;
end;
$$;

-- 2. Update Compatibility Matrix Stock & MOQ (Direct Stock Management)
create or replace function public.sp_update_matrix_stock(
  p_product_id  uuid,
  p_model_id    uuid,
  p_stock_qty   integer,
  p_moq         integer default null
)
returns public.product_model_matrix
language plpgsql
security definer
as $$
declare
  v_matrix public.product_model_matrix;
begin
  insert into public.product_model_matrix (product_id, model_id, stock_quantity, moq)
  values (p_product_id, p_model_id, p_stock_qty, coalesce(p_moq, 1))
  on conflict (product_id, model_id) do update set
    stock_quantity = excluded.stock_quantity,
    moq            = coalesce(p_moq, public.product_model_matrix.moq),
    updated_at     = now()
  returning * into v_matrix;

  return v_matrix;
end;
$$;

-- 3. Assign / Update Sticky Sales Representative for Customer
create or replace function public.sp_assign_sticky_sales_rep(
  p_customer_id    uuid,
  p_sales_agent_id uuid
)
returns public.user_profiles
language plpgsql
security definer
as $$
declare
  v_profile public.user_profiles;
begin
  update public.user_profiles
  set
    assigned_sales_rep_id = p_sales_agent_id,
    updated_at            = now()
  where id = p_customer_id
  returning * into v_profile;

  if not found then
    raise exception 'Customer with ID % not found', p_customer_id;
  end if;

  return v_profile;
end;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00005_product_enhancements.sql
-- ------------------------------------------------------------------------------

-- Migration 00005: Product Enhancements
-- Adds cost_price (internal admin-only) and gallery_urls (multi-image support)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';

-- Index for cost_price queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_products_cost_price ON products(cost_price);

COMMENT ON COLUMN products.cost_price IS 'Internal cost price — visible to admin only for margin tracking';
COMMENT ON COLUMN products.gallery_urls IS 'Array of additional image URLs for product gallery';



-- ------------------------------------------------------------------------------
-- Migration: 00006_inventory_adjustments.sql
-- ------------------------------------------------------------------------------

-- Migration 00006: Inventory Adjustments (تسويات جردية)
-- Audit trail for manual stock corrections by admin

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  model_id        UUID REFERENCES master_models(id) ON DELETE SET NULL,
  adjusted_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN ('surplus', 'deficit', 'damage', 'correction', 'return_stock')
  ),
  quantity_before INT  NOT NULL,
  quantity_change INT  NOT NULL,  -- positive = add, negative = remove
  quantity_after  INT  NOT NULL,
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_model   ON inventory_adjustments(model_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_date    ON inventory_adjustments(created_at DESC);

-- RLS: admin only
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_adjustments" ON inventory_adjustments;
CREATE POLICY "admin_manage_adjustments" ON inventory_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );



-- ------------------------------------------------------------------------------
-- Migration: 00007_order_shipping_fields.sql
-- ------------------------------------------------------------------------------

-- Migration 00007: Order Shipping & Return Fields
-- Adds carrier_name, waybill_number, return_reason, and return_notes

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS return_reason TEXT CHECK (
    return_reason IS NULL OR return_reason IN ('customer_refused', 'damaged_in_transit', 'wrong_order', 'wrong_model', 'other')
  ),
  ADD COLUMN IF NOT EXISTS return_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill_number) WHERE waybill_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_return_reason ON orders(return_reason) WHERE return_reason IS NOT NULL;

COMMENT ON COLUMN orders.carrier_name IS 'Name of shipping company or manual delivery method';
COMMENT ON COLUMN orders.waybill_number IS 'Independent consignment/waybill tracking number';
COMMENT ON COLUMN orders.return_reason IS 'Reason for return if order status is returned';
COMMENT ON COLUMN orders.return_notes IS 'Detailed notes or explanation for return';



-- ------------------------------------------------------------------------------
-- Migration: 00008_bulk_matrix_upsert.sql
-- ------------------------------------------------------------------------------

-- Migration 00008: Bulk Matrix Upsert Stored Procedure
-- Allows bulk adding or updating multiple models in the compatibility matrix for a product in a single atomic transaction

CREATE OR REPLACE PROCEDURE sp_bulk_upsert_matrix_items(
  p_product_id UUID,
  p_items JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
  item JSONB;
  v_stock INT;
  v_moq INT;
  v_status TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_stock := COALESCE((item->>'stock_quantity')::INT, 0);
    v_moq := GREATEST(COALESCE((item->>'moq')::INT, 1), 1);
    
    IF v_stock = 0 THEN
      v_status := 'out_of_stock';
    ELSIF v_stock <= 10 THEN
      v_status := 'limited';
    ELSE
      v_status := 'in_stock';
    END IF;

    INSERT INTO product_model_matrix (
      id,
      product_id,
      model_id,
      stock_quantity,
      moq,
      stock_status,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      p_product_id,
      (item->>'model_id')::UUID,
      v_stock,
      v_moq,
      v_status,
      now(),
      now()
    )
    ON CONFLICT (product_id, model_id)
    DO UPDATE SET
      stock_quantity = EXCLUDED.stock_quantity,
      moq = EXCLUDED.moq,
      stock_status = EXCLUDED.stock_status,
      updated_at = now();
  END LOOP;
END;
$$;

-- Stored Procedure to copy matrix from one product to another
CREATE OR REPLACE PROCEDURE sp_copy_product_matrix(
  p_source_product_id UUID,
  p_target_product_id UUID,
  p_override_stock INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO product_model_matrix (
    id,
    product_id,
    model_id,
    stock_quantity,
    moq,
    stock_status,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    p_target_product_id,
    model_id,
    COALESCE(p_override_stock, stock_quantity),
    moq,
    CASE 
      WHEN COALESCE(p_override_stock, stock_quantity) = 0 THEN 'out_of_stock'
      WHEN COALESCE(p_override_stock, stock_quantity) <= 10 THEN 'limited'
      ELSE 'in_stock'
    END,
    now(),
    now()
  FROM product_model_matrix
  WHERE product_id = p_source_product_id
  ON CONFLICT (product_id, model_id)
  DO UPDATE SET
    stock_quantity = EXCLUDED.stock_quantity,
    moq = EXCLUDED.moq,
    stock_status = EXCLUDED.stock_status,
    updated_at = now();
END;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00010_fix_public_customer_ordering.sql
-- ------------------------------------------------------------------------------

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
as $$
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
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00011_harden_rls_and_secure_customer_access.sql
-- ------------------------------------------------------------------------------

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



-- ------------------------------------------------------------------------------
-- Migration: 00012_replenish_stock_on_return_and_cancel_order.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store — Migration 00012: Stock Replenishment on Return & Self-Service Cancel
-- Version   : 00012
-- Created   : 2026-09-10
-- Description:
--   1. Automatically restores deducted inventory when an order moves to 'returned'
--   2. Provides sp_cancel_pending_order procedure for customer self-service order cancellation
-- ==============================================================================

-- ── 1. Update Order Lifecycle Trigger to Replenish Stock on Return ────────────
create or replace function public.handle_order_lifecycle()
returns trigger
language plpgsql
security definer
as $$
declare
  v_item         record;
  v_valid        boolean;
begin
  -- Guard: reject same-status no-ops silently
  if old.status = new.status then
    return new;
  end if;

  -- Validate allowed transitions
  v_valid := case
    when old.status = 'pending'     and new.status = 'preparation' then true
    when old.status = 'pending'     and new.status = 'returned'    then true -- cancellation while pending
    when old.status = 'preparation' and new.status = 'shipping'    then true
    when old.status = 'preparation' and new.status = 'returned'    then true -- return during prep
    when old.status = 'shipping'    and new.status = 'delivered'   then true
    when old.status = 'shipping'    and new.status = 'returned'    then true -- delivery failure / return
    -- Admin override allowed for returns
    when new.status = 'returned'                                   then true
    else false
  end;

  if not v_valid then
    raise exception
      'Invalid order status transition: % → %. Allowed: pending→preparation, pending→returned, preparation→shipping, shipping→delivered/returned.',
      old.status, new.status;
  end if;

  -- ── A. pending → preparation: Deduct Stock ───────────────────────────────────
  if old.status = 'pending' and new.status = 'preparation' then
    new.confirmed_at := coalesce(new.confirmed_at, now());

    for v_item in
      select product_id, model_id, quantity
      from   public.order_items
      where  order_id = new.id
    loop
      if v_item.model_id is not null then
        update public.product_model_matrix
        set
          stock_quantity = greatest(0, stock_quantity - v_item.quantity),
          stock_status   = case
            when greatest(0, stock_quantity - v_item.quantity) = 0   then 'out_of_stock'
            when greatest(0, stock_quantity - v_item.quantity) <= 10 then 'limited'
            else 'in_stock'
          end,
          updated_at = now()
        where product_id = v_item.product_id
          and model_id   = v_item.model_id;
      end if;
    end loop;
  end if;

  -- ── B. preparation / shipping / delivered → returned: Replenish Stock ─────────
  -- If stock was deducted earlier (i.e. order had advanced past 'pending'), restore it!
  if new.status = 'returned' and old.status in ('preparation', 'shipping', 'delivered') then
    new.returned_at := coalesce(new.returned_at, now());

    for v_item in
      select product_id, model_id, quantity
      from   public.order_items
      where  order_id = new.id
    loop
      if v_item.model_id is not null then
        update public.product_model_matrix
        set
          stock_quantity = stock_quantity + v_item.quantity,
          stock_status   = case
            when (stock_quantity + v_item.quantity) = 0   then 'out_of_stock'
            when (stock_quantity + v_item.quantity) <= 10 then 'limited'
            else 'in_stock'
          end,
          updated_at = now()
        where product_id = v_item.product_id
          and model_id   = v_item.model_id;
      end if;
    end loop;
  elsif new.status = 'returned' and old.status = 'pending' then
    -- Cancelled before confirmation — stock was never deducted, simply stamp returned_at
    new.returned_at := coalesce(new.returned_at, now());
  end if;

  -- ── C. preparation → shipping: Stamp shipped_at ─────────────────────────────
  if old.status = 'preparation' and new.status = 'shipping' then
    new.shipped_at := coalesce(new.shipped_at, now());
  end if;

  -- ── D. shipping → delivered: Stamp delivered_at ─────────────────────────────
  if old.status = 'shipping' and new.status = 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;


-- ── 2. Self-Service Order Cancellation Procedure (Security Definer) ────────────
create or replace function public.sp_cancel_pending_order(
  p_order_id    uuid,
  p_customer_id uuid,
  p_phone       text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_status text;
  v_order_cust_id  uuid;
begin
  if p_order_id is null or p_customer_id is null or p_phone is null or trim(p_phone) = '' then
    return jsonb_build_object('success', false, 'message', 'بيانات التحقق غير مكتملة');
  end if;

  -- Verify customer ownership and identity
  if not exists (
    select 1 from public.user_profiles
    where id = p_customer_id
      and phone = trim(p_phone)
      and role = 'customer'
  ) then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: الحساب غير مطابق لرقم الهاتف');
  end if;

  -- Retrieve order status and customer
  select status, customer_id
  into v_current_status, v_order_cust_id
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  end if;

  if v_order_cust_id != p_customer_id then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: هذا الطلب لا يخص حسابك');
  end if;

  -- Only pending orders can be cancelled directly by customer
  if v_current_status != 'pending' then
    return jsonb_build_object(
      'success', false,
      'message', 'لا يمكن إلغاء الطلب بعد بدء التجهيز أو الشحن. يرجى التواصل مباشرة مع المندوب المسؤول.'
    );
  end if;

  -- Update order to returned (cancelled)
  update public.orders
  set
    status         = 'returned',
    return_reason  = 'customer_request',
    return_notes   = coalesce(p_reason, 'تم إلغاء الطلب بواسطة العميل من حسابه'),
    returned_at    = now(),
    updated_at     = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الطلب بنجاح'
  );
end;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00013_harden_is_active_and_phone_normalization.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store — Migration 00013: Schema Alignment & Phone Normalization
-- Version   : 00013
-- Created   : 2026-09-10
-- Description:
--   1. Adds missing 'is_active' column to user_profiles table (defaults to true)
--   2. Adds public.normalize_phone() function to seamlessly handle Arabic digits (٠-٩)
--      and local Egyptian mobile formats (+20, 0020, spaces, dashes)
--   3. Hardens sp_customer_login, sp_customer_register, sp_get_customer_orders,
--      and sp_cancel_pending_order with automatic phone normalization
-- ==============================================================================

-- ── 1. Add is_active column to user_profiles ─────────────────────────────────
alter table public.user_profiles
  add column if not exists is_active boolean default true;

-- Ensure all existing profiles are active
update public.user_profiles
set is_active = true
where is_active is null;


-- ── 2. Phone Normalization Helper Function ───────────────────────────────────
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_res text;
begin
  if p_phone is null then
    return '';
  end if;

  v_res := trim(p_phone);

  -- 1. Translate Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Latin (0123456789)
  v_res := translate(v_res, '٠١٢٣٤٥٦٧٨٩', '0123456789');

  -- 2. Strip all non-digit characters
  v_res := regexp_replace(v_res, '[^0-9]', '', 'g');

  -- 3. Normalize international prefixes (+20, 0020, 20) to standard 01xxxxxxxxx
  if v_res ~ '^00201[0-2,5][0-9]{8}$' then
    v_res := '0' || substring(v_res from 5);
  elsif v_res ~ '^201[0-2,5][0-9]{8}$' then
    v_res := '0' || substring(v_res from 3);
  end if;

  return v_res;
end;
$$;


-- ── 3. Hardened sp_customer_login ─────────────────────────────────────────────
create or replace function public.sp_customer_login(p_phone text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_clean_phone text;
  v_user        record;
begin
  v_clean_phone := public.normalize_phone(p_phone);

  if v_clean_phone = '' then
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
  where (u.phone = v_clean_phone or public.normalize_phone(u.phone) = v_clean_phone)
    and u.role = 'customer'
    and coalesce(u.is_active, true) = true
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


-- ── 4. Hardened sp_customer_register ──────────────────────────────────────────
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
  v_clean_name  text;
  v_clean_phone text;
  v_existing    uuid;
  v_new_id      uuid;
begin
  v_clean_name  := trim(coalesce(p_name, ''));
  v_clean_phone := public.normalize_phone(p_phone);

  if v_clean_name = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال الاسم الكامل');
  end if;

  if v_clean_phone = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  -- Validate Egyptian mobile pattern (11 digits: 010, 011, 012, 015)
  if not (v_clean_phone ~ '^01[0-2,5][0-9]{8}$') then
    return jsonb_build_object(
      'success', false,
      'message', 'يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
    );
  end if;

  select id into v_existing
  from public.user_profiles
  where phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone
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


-- ── 5. Hardened sp_get_customer_orders ─────────────────────────────────────────
create or replace function public.sp_get_customer_orders(
  p_customer_id uuid,
  p_phone       text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_clean_phone text;
  v_orders      jsonb;
begin
  if p_customer_id is null or p_phone is null then
    return '[]'::jsonb;
  end if;

  v_clean_phone := public.normalize_phone(p_phone);

  if not exists (
    select 1 from public.user_profiles
    where id = p_customer_id
      and (phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone)
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


-- ── 6. Hardened sp_cancel_pending_order ───────────────────────────────────────
create or replace function public.sp_cancel_pending_order(
  p_order_id    uuid,
  p_customer_id uuid,
  p_phone       text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_clean_phone    text;
  v_current_status text;
  v_order_cust_id  uuid;
begin
  if p_order_id is null or p_customer_id is null or p_phone is null then
    return jsonb_build_object('success', false, 'message', 'بيانات التحقق غير مكتملة');
  end if;

  v_clean_phone := public.normalize_phone(p_phone);

  -- Verify customer ownership and identity
  if not exists (
    select 1 from public.user_profiles
    where id = p_customer_id
      and (phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone)
      and role = 'customer'
  ) then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: الحساب غير مطابق لرقم الهاتف');
  end if;

  -- Retrieve order status and customer
  select status, customer_id
  into v_current_status, v_order_cust_id
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  end if;

  if v_order_cust_id != p_customer_id then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: هذا الطلب لا يخص حسابك');
  end if;

  -- Only pending orders can be cancelled directly by customer
  if v_current_status != 'pending' then
    return jsonb_build_object(
      'success', false,
      'message', 'لا يمكن إلغاء الطلب بعد بدء التجهيز أو الشحن. يرجى التواصل مباشرة مع المندوب المسؤول.'
    );
  end if;

  -- Update order to returned (cancelled)
  update public.orders
  set
    status        = 'returned',
    return_reason = 'customer_request',
    return_notes  = coalesce(p_reason, 'تم إلغاء الطلب بواسطة العميل من حسابه'),
    returned_at   = now(),
    updated_at    = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الطلب بنجاح'
  );
end;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00014_create_audit_logs.sql
-- ------------------------------------------------------------------------------

-- =============================================================================
-- Migration 00014: Create audit_logs table for structured observability
-- Run in Supabase SQL Editor → New Query → Paste → Run
-- =============================================================================

-- ── Create audit_logs table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text NOT NULL,
  actor_id      uuid,
  actor_phone_hint text,
  target_id     uuid,
  target_type   text,
  metadata      jsonb,
  severity      text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by action type and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time
  ON public.audit_logs (action, created_at DESC);

-- Index for actor-specific audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id, created_at DESC);

-- ── RLS: Only service role can read/write audit logs ─────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Anon/authenticated cannot read audit logs
CREATE POLICY "audit_logs_deny_anon"
  ON public.audit_logs
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Service role bypasses RLS automatically (no policy needed)

-- ── Auto-cleanup: delete logs older than 90 days (via pg_cron if available) ──
-- NOTE: pg_cron must be enabled in Supabase for this to work.
-- If not available, set up a manual cleanup job or Supabase Edge Function.
-- Uncomment after enabling pg_cron:
/*
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 3 * * *',  -- runs daily at 03:00 UTC
  $$DELETE FROM public.audit_logs WHERE created_at < now() - interval '90 days';$$
);
*/

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail for critical B2B business events. Written by service role only.';



-- ------------------------------------------------------------------------------
-- Migration: 00015_fix_sticky_sales_rep_and_cancel_reason.sql
-- ------------------------------------------------------------------------------

-- =============================================================================
-- Migration 00015: Fix Sticky Sales Rep Assignment & Return Reason Constraint
-- Run in Supabase SQL Editor -> Paste -> Run
-- =============================================================================

-- ── 1. Fix sp_customer_register to assign Default Sticky Sales Rep ─────────────
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
  v_clean_name          text;
  v_clean_phone         text;
  v_existing            uuid;
  v_new_id              uuid;
  v_sticky_sales_rep_id uuid := '00000004-0000-0000-0000-000000000002'::uuid;
  v_rep_name            text := 'أحمد محمود (مندوب المبيعات المعتمد)';
  v_rep_phone           text := '01012345678';
begin
  v_clean_name  := trim(coalesce(p_name, ''));
  v_clean_phone := public.normalize_phone(p_phone);

  if v_clean_name = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال الاسم الكامل');
  end if;

  if v_clean_phone = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  -- Validate Egyptian mobile pattern (11 digits: 010, 011, 012, 015)
  if not (v_clean_phone ~ '^01[0-2,5][0-9]{8}$') then
    return jsonb_build_object(
      'success', false,
      'message', 'يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
    );
  end if;

  select id into v_existing
  from public.user_profiles
  where phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone
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
    assigned_sales_rep_id,
    is_active
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    nullif(trim(p_company), ''),
    'customer',
    v_sticky_sales_rep_id,
    true
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', nullif(trim(p_company), ''),
      'role', 'customer',
      'assigned_sales_rep_id', v_sticky_sales_rep_id,
      'assigned_sales_rep_name', v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone
    )
  );
end;
$$;


-- ── 2. Fix sp_cancel_pending_order to use valid return_reason ('other') ────────
create or replace function public.sp_cancel_pending_order(
  p_order_id    uuid,
  p_customer_id uuid,
  p_phone       text,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_clean_phone    text;
  v_current_status text;
  v_order_cust_id  uuid;
begin
  if p_order_id is null or p_customer_id is null or p_phone is null then
    return jsonb_build_object('success', false, 'message', 'بيانات التحقق غير مكتملة');
  end if;

  v_clean_phone := public.normalize_phone(p_phone);

  -- Verify customer ownership and identity
  if not exists (
    select 1 from public.user_profiles
    where id = p_customer_id
      and (phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone)
      and role = 'customer'
  ) then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: الحساب غير مطابق لرقم الهاتف');
  end if;

  -- Retrieve order status and customer
  select status, customer_id
  into v_current_status, v_order_cust_id
  from public.orders
  where id = p_order_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'الطلب غير موجود');
  end if;

  if v_order_cust_id != p_customer_id then
    return jsonb_build_object('success', false, 'message', 'غير مصرح: هذا الطلب لا يخص حسابك');
  end if;

  -- Only pending orders can be cancelled directly by customer
  if v_current_status != 'pending' then
    return jsonb_build_object(
      'success', false,
      'message', 'لا يمكن إلغاء الطلب بعد بدء التجهيز أو الشحن. يرجى التواصل مباشرة مع المندوب المسؤول.'
    );
  end if;

  -- Update order to returned (cancelled) using valid check constraint value ('other')
  update public.orders
  set
    status        = 'returned',
    return_reason = 'other',
    return_notes  = coalesce(p_reason, 'تم إلغاء الطلب بواسطة العميل من حسابه'),
    returned_at   = now(),
    updated_at    = now()
  where id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الطلب بنجاح'
  );
end;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00016_create_store_settings.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- 00016_create_store_settings.sql
-- Store Settings table for MH EL MAHDY B2B Storefront & Administration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL DEFAULT 'MH EL MAHDY - متجر المهدي للتجارة والتوزيع',
  tagline TEXT DEFAULT 'المنظومة المعتمدة لتوزيع إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية لقطاع الأعمال والشركات.',
  address TEXT DEFAULT 'القاهرة - وسط البلد - شارع عبد العزيز / المستودع المركزي بمدينة نصر',
  phone TEXT DEFAULT '01012345678',
  whatsapp_number TEXT DEFAULT '201012345678',
  whatsapp_message TEXT DEFAULT 'السلام عليكم، أرغب في الاستفسار عن طلب توريد بالجملة من متجر MH EL MAHDY',
  facebook_url TEXT DEFAULT 'https://facebook.com/mhelmahdy',
  instagram_url TEXT DEFAULT 'https://instagram.com/mhelmahdy',
  tiktok_url TEXT DEFAULT 'https://tiktok.com/@mhelmahdy',
  telegram_url TEXT DEFAULT 'https://t.me/mhelmahdy',
  youtube_url TEXT DEFAULT 'https://youtube.com/@mhelmahdy',
  working_hours TEXT DEFAULT 'السبت - الخميس: 9:00 ص - 10:00 م',
  announcement TEXT DEFAULT 'شحن فوري وتوصيل لكافة محافظات الجمهورية للمحلات والشركات مع إصدار بوليصة شحن وتتبع مباشر.',
  default_moq INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default row if not exists
INSERT INTO public.store_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- 1. Anyone (public/anon) can view store settings
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
  ON public.store_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Only authenticated staff can update store settings
DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
CREATE POLICY "Staff can update store settings"
  ON public.store_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Allow service_role full control
DROP POLICY IF EXISTS "Service role full control on store settings" ON public.store_settings;
CREATE POLICY "Service role full control on store settings"
  ON public.store_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);



-- ------------------------------------------------------------------------------
-- Migration: 00017_restore_first_touch_sticky_sales_rep_and_lock_settings.sql
-- ------------------------------------------------------------------------------

-- =============================================================================
-- Migration 00017: Restore First-Touch Sticky Sales Rep & Lock Store Settings RLS
-- Run in Supabase SQL Editor -> Paste -> Run
-- =============================================================================

-- ── 1. Revert sp_customer_register to leave assigned_sales_rep_id NULL ─────────
-- Customers register unassigned. First sales agent to handle customer's order claims them.
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
  v_clean_name  text;
  v_clean_phone text;
  v_existing    uuid;
  v_new_id      uuid;
begin
  v_clean_name  := trim(coalesce(p_name, ''));
  v_clean_phone := public.normalize_phone(p_phone);

  if v_clean_name = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال الاسم الكامل');
  end if;

  if v_clean_phone = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  -- Validate Egyptian mobile pattern (11 digits: 010, 011, 012, 015)
  if not (v_clean_phone ~ '^01[0-2,5][0-9]{8}$') then
    return jsonb_build_object(
      'success', false,
      'message', 'يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
    );
  end if;

  select id into v_existing
  from public.user_profiles
  where phone = v_clean_phone or public.normalize_phone(phone) = v_clean_phone
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
    assigned_sales_rep_id,
    is_active
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    nullif(trim(p_company), ''),
    'customer',
    null, -- Strictly unassigned upon registration (First-Touch Stickiness)
    true
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', nullif(trim(p_company), ''),
      'role', 'customer',
      'assigned_sales_rep_id', null,
      'assigned_sales_rep_name', null,
      'assigned_sales_rep_phone', null
    )
  );
end;
$$;


-- ── 2. Update sp_assign_sticky_sales_rep with First-Touch Protection ───────────
-- If p_force = false (default during automated order processing), existing sticky sales rep is preserved!
-- If p_force = true (admin reassignment via CRM CustomerManager), updates unconditionally.
create or replace function public.sp_assign_sticky_sales_rep(
  p_customer_id    uuid,
  p_sales_agent_id uuid,
  p_force          boolean default false
)
returns public.user_profiles
language plpgsql
security definer
as $$
declare
  v_profile     public.user_profiles;
  v_current_rep uuid;
begin
  select assigned_sales_rep_id into v_current_rep
  from public.user_profiles
  where id = p_customer_id;

  if not found then
    raise exception 'Customer with ID % not found', p_customer_id;
  end if;

  -- First-Touch Stickiness: preserve existing rep unless admin forces reassignment
  if v_current_rep is not null and not p_force then
    select * into v_profile from public.user_profiles where id = p_customer_id;
    return v_profile;
  end if;

  update public.user_profiles
  set
    assigned_sales_rep_id = p_sales_agent_id,
    updated_at            = now()
  where id = p_customer_id
  returning * into v_profile;

  return v_profile;
end;
$$;


-- ── 3. Lock store_settings RLS strictly to Admin ──────────────────────────────
-- Narrow update and insert policies from general "authenticated" to "public.current_user_role() = 'admin'"

drop policy if exists "Staff can update store settings" on public.store_settings;
drop policy if exists "Admin can update store settings" on public.store_settings;
create policy "Admin can update store settings"
  on public.store_settings
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can insert store settings" on public.store_settings;
create policy "Admin can insert store settings"
  on public.store_settings
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');



-- ------------------------------------------------------------------------------
-- Migration: 00018_reset_and_auto_sync_staff_roles.sql
-- ------------------------------------------------------------------------------

-- =============================================================================
-- Migration: 00018_reset_and_auto_sync_staff_roles.sql
-- تنظيف وإصلاح صلاحيات الأدمن والموظفين وربط Supabase Auth تلقائياً بـ user_profiles
-- قم بنسخ هذا الكود وتشغيله في Supabase Dashboard -> SQL Editor
-- =============================================================================

-- تفعيل ملحقات التشفير إن لم تكن مفعلة
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. دالة المزامنة التلقائية (Trigger Function):
-- تقوم بربط أي مستخدم يُنشأ في Supabase Auth بجدول user_profiles فوراً وتحديد دوره
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_staff_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_name text;
  v_phone text;
  v_existing_id uuid;
BEGIN
  -- تحديد الدور الوظيفي بدقة بناءً على البريد أو الميتاداتا
  IF LOWER(NEW.email) = 'admin@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') = 'admin' THEN
    v_role := 'admin';
  ELSIF LOWER(NEW.email) = 'sales@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') = 'sales_agent' THEN
    v_role := 'sales_agent';
  ELSIF LOWER(NEW.email) = 'warehouse@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') IN ('warehouse', 'warehouse_preparer') THEN
    v_role := 'warehouse_preparer';
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  END IF;

  -- تحديد الاسم
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    CASE 
      WHEN v_role = 'admin' THEN 'إدارة متجر MH المهدي (مدير النظام)'
      WHEN v_role = 'sales_agent' THEN 'مندوب مبيعات معتمد'
      WHEN v_role = 'warehouse_preparer' THEN 'مسؤول المستودع والتجهيز'
      ELSE split_part(NEW.email, '@', 1)
    END
  );

  -- تحديد الهاتف
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    CASE 
      WHEN v_role = 'admin' THEN '01000000001'
      ELSE '01000000000'
    END
  );

  -- فحص إذا كان هناك حساب مسبق في user_profiles بنفس البريد أو الـ auth_user_id
  SELECT id INTO v_existing_id FROM public.user_profiles 
  WHERE LOWER(email) = LOWER(NEW.email) OR auth_user_id = NEW.id 
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET
      auth_user_id = NEW.id,
      email = LOWER(NEW.email),
      -- حماية دور الأدمن من التغيير لأي دور آخر
      role = CASE WHEN role = 'admin' OR v_role = 'admin' THEN 'admin' ELSE v_role END,
      full_name = CASE WHEN role = 'admin' AND full_name IS NOT NULL THEN full_name ELSE v_name END,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.user_profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      CASE WHEN v_role = 'admin' THEN '00000004-0000-0000-0000-000000000001'::uuid ELSE gen_random_uuid() END,
      NEW.id,
      v_name,
      LOWER(NEW.email),
      v_phone,
      v_role,
      true,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- تفعيل التريجر على جدول المستخدمين في Supabase Auth
DROP TRIGGER IF EXISTS trg_sync_staff_user ON auth.users;
CREATE TRIGGER trg_sync_staff_user
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_staff_user_sync();

-- -----------------------------------------------------------------------------
-- 2. تنظيف وإصلاح حساب الأدمن الرئيسي وحسابات الموظفين الحالية فوراً
-- -----------------------------------------------------------------------------

-- إعادة تثبيت ملف الأدمن الرئيسي في user_profiles
INSERT INTO public.user_profiles (
  id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '00000004-0000-0000-0000-000000000001',
  'إدارة متجر MH المهدي',
  'admin@elmahdy.com',
  '01000000001',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'إدارة متجر MH المهدي',
  email = 'admin@elmahdy.com',
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- ربط كافة مستخدمي auth بملفاتهم في user_profiles بالبريد الإلكتروني
UPDATE public.user_profiles up
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(up.email) = LOWER(au.email);

-- -----------------------------------------------------------------------------
-- 3. تحديث كلمة مرور الأدمن والبيانات داخل auth.users
-- (كلمة المرور الافتراضية أدناه: Admin@123456 - يمكنك تغييرها لأي كلمة تريدها)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE LOWER(email) = 'admin@elmahdy.com' LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = crypt('Admin@123456', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"إدارة متجر MH المهدي","role":"admin","phone":"01000000001"}'::jsonb,
      updated_at = NOW()
    WHERE id = v_admin_id;

    UPDATE public.user_profiles
    SET auth_user_id = v_admin_id
    WHERE id = '00000004-0000-0000-0000-000000000001';
  ELSE
    -- في حال عدم وجود مستخدم admin@elmahdy.com في auth.users، يتم إنشاؤه مباشرة
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@elmahdy.com',
      crypt('Admin@123456', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"إدارة متجر MH المهدي","role":"admin","phone":"01000000001"}'::jsonb,
      false, ''
    )
    RETURNING id INTO v_admin_id;

    UPDATE public.user_profiles
    SET auth_user_id = v_admin_id
    WHERE id = '00000004-0000-0000-0000-000000000001';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. فحص النتيجة النهائية وتأكيد المزامنة
-- -----------------------------------------------------------------------------
SELECT 
  up.id AS profile_id,
  up.full_name,
  up.email,
  up.phone,
  up.role,
  up.auth_user_id,
  CASE WHEN au.id IS NOT NULL THEN 'متصل بنجاح ✓' ELSE 'غير متصل ✗' END AS auth_status
FROM public.user_profiles up
LEFT JOIN auth.users au ON au.id = up.auth_user_id
WHERE up.role IN ('admin', 'sales_agent', 'warehouse_preparer')
ORDER BY up.role, up.created_at;



-- ------------------------------------------------------------------------------
-- Migration: 00019_create_product_images_storage_bucket.sql
-- ------------------------------------------------------------------------------

-- =============================================================================
-- Migration: 00019_create_product_images_storage_bucket.sql
-- الغرض: إنشاء Storage Bucket الخاص بصور المنتجات وضبط صلاحياته
-- السبب: الكود في src/lib/storage.ts (uploadProductImage) يفترض وجود باكت
--         باسم 'product-images' جاهز مسبقًا، لكن لا يوجد أي migration سابق
--         ينشئه فعليًا في قاعدة البيانات — هذا هو السبب الأرجح لفشل رفع
--         الصور بالكامل من لوحة التحكم.
-- =============================================================================

-- 1. إنشاء الـ Bucket (لو مش موجود) — public = true عشان صور المنتجات
--    تحتاج تكون قابلة للعرض في المتجر الأمامي بدون تسجيل دخول
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB حد أقصى لكل صورة
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 2. صلاحيات القراءة: عامة بالكامل (أي زائر يشوف صور المنتجات في المتجر)
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- 3. صلاحيات الرفع/التعديل/الحذف: مقصورة على الأدمن فقط (نفس منطق باقي الجداول)
drop policy if exists "Admin upload product images" on storage.objects;
create policy "Admin upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );

drop policy if exists "Admin update product images" on storage.objects;
create policy "Admin update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );

drop policy if exists "Admin delete product images" on storage.objects;
create policy "Admin delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );


-- ------------------------------------------------------------------------------
-- Migration: 00020_add_category_image_and_delivery_settings.sql
-- ------------------------------------------------------------------------------

-- Migration 00019: Add category image_url and customizable delivery promises in store_settings
-- Adds image_url to categories table and delivery promises fields to store_settings

-- 1. Add image_url column to categories if not exists
ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add delivery promise columns to store_settings if not exists
ALTER TABLE IF EXISTS public.store_settings 
ADD COLUMN IF NOT EXISTS delivery_promise_1 text DEFAULT 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.',
ADD COLUMN IF NOT EXISTS delivery_promise_2 text DEFAULT 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.',
ADD COLUMN IF NOT EXISTS delivery_promise_3 text DEFAULT 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.';

-- Update any existing store_settings record with defaults if columns are null
UPDATE public.store_settings
SET 
  delivery_promise_1 = COALESCE(delivery_promise_1, 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.'),
  delivery_promise_2 = COALESCE(delivery_promise_2, 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.'),
  delivery_promise_3 = COALESCE(delivery_promise_3, 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.')
WHERE id IS NOT NULL;



-- ------------------------------------------------------------------------------
-- Migration: 00021_custom_roles_and_least_loaded_rep.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Migration 00021: Custom Roles, Granular Permissions & Least-Loaded Sales Rep
-- Description:
--   1. Creates custom_roles table with granular permissions (on/off toggles)
--   2. Adds custom_role_id and custom_role_name to user_profiles
--   3. Seeds system roles (Admin, Sales Agent, Warehouse)
--   4. Creates fn_get_least_loaded_sales_rep() for equal-opportunity assignment
--   5. Updates sp_customer_register & sp_create_pending_order to use automatic least-loaded rep
-- ==============================================================================

-- ── 1. Create custom_roles Table ─────────────────────────────────────────────
create table if not exists public.custom_roles (
  id                    uuid primary key default gen_random_uuid(),
  name_ar               text not null unique,
  description           text,
  is_system             boolean not null default false,
  
  -- Granular Permissions (ON / OFF)
  can_manage_products   boolean not null default false, -- إدخال وتعديل المنتجات
  can_receive_customers boolean not null default false, -- استقبال عملاء كمندوب وتوزيع تلقائي
  can_manage_orders     boolean not null default false, -- إدارة وتجهيز الطلبات
  can_manage_categories boolean not null default false, -- إدارة الأقسام والكتالوج
  can_manage_matrix     boolean not null default false, -- إدارة مصفوفة الموديلات والمخزون
  can_manage_customers  boolean not null default false, -- إدارة وعرض العملاء
  can_manage_shortages  boolean not null default false, -- مراجعة طلبات النواقص
  can_manage_settings   boolean not null default false, -- إعدادات المتجر العامة

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 2. Add Custom Role Columns to user_profiles ──────────────────────────────
alter table public.user_profiles 
  add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null,
  add column if not exists custom_role_name text;

-- Drop restrictive role check constraint to allow custom roles
alter table public.user_profiles drop constraint if exists user_profiles_role_check;

-- ── 3. Seed Default System Roles ─────────────────────────────────────────────
insert into public.custom_roles (
  name_ar,
  description,
  is_system,
  can_manage_products,
  can_receive_customers,
  can_manage_orders,
  can_manage_categories,
  can_manage_matrix,
  can_manage_customers,
  can_manage_shortages,
  can_manage_settings
) values 
(
  'مدير النظام (Admin)',
  'صلاحيات كاملة وغير مقيدة على كافة أقسام وإعدادات النظام',
  true,
  true, true, true, true, true, true, true, true
),
(
  'مندوب مبيعات معتمد (Sales Agent)',
  'استقبال ومتابعة العملاء والطلبات وتسجيل النواقص',
  true,
  false, true, true, false, false, true, true, false
),
(
  'مسؤول المستودع والتجهيز (Warehouse)',
  'تجهيز طلبيات الشحن ومطابقة المخزون ومصفوفة الموديلات',
  true,
  false, false, true, false, true, false, false, false
)
on conflict (name_ar) do update set
  is_system             = excluded.is_system,
  can_manage_products   = excluded.can_manage_products,
  can_receive_customers = excluded.can_receive_customers,
  can_manage_orders     = excluded.can_manage_orders,
  can_manage_categories = excluded.can_manage_categories,
  can_manage_matrix     = excluded.can_manage_matrix,
  can_manage_customers  = excluded.can_manage_customers,
  can_manage_shortages  = excluded.can_manage_shortages,
  can_manage_settings   = excluded.can_manage_settings;

-- Link existing staff to system custom_roles if unlinked
update public.user_profiles u
set 
  custom_role_id = r.id,
  custom_role_name = r.name_ar
from public.custom_roles r
where u.custom_role_id is null
  and (
    (u.role = 'admin' and r.name_ar = 'مدير النظام (Admin)') or
    (u.role = 'sales_agent' and r.name_ar = 'مندوب مبيعات معتمد (Sales Agent)') or
    (u.role = 'warehouse_preparer' and r.name_ar = 'مسؤول المستودع والتجهيز (Warehouse)')
  );

-- ── 4. RLS for custom_roles ──────────────────────────────────────────────────
alter table public.custom_roles enable row level security;

drop policy if exists "Anyone authenticated can view custom roles" on public.custom_roles;
create policy "Anyone authenticated can view custom roles"
  on public.custom_roles
  for select
  to authenticated
  using (true);

drop policy if exists "Admin can manage custom roles" on public.custom_roles;
create policy "Admin can manage custom roles"
  on public.custom_roles
  for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ── 5. Least-Loaded Sales Rep Function ───────────────────────────────────────
-- Returns the active sales agent (or staff with can_receive_customers = true)
-- who currently has the least number of assigned customers.
create or replace function public.fn_get_least_loaded_sales_rep()
returns uuid
language plpgsql
security definer
as $$
declare
  v_rep_id uuid;
begin
  select s.id into v_rep_id
  from public.user_profiles s
  left join public.custom_roles cr on s.custom_role_id = cr.id
  left join public.user_profiles c 
    on c.assigned_sales_rep_id = s.id and c.role = 'customer'
  where s.is_active = true
    and (
      s.role = 'sales_agent' 
      or coalesce(cr.can_receive_customers, false) = true
    )
  group by s.id, s.created_at
  order by count(c.id) asc, s.created_at asc
  limit 1;

  return v_rep_id;
end;
$$;

-- ── 6. Update Customer Registration to Auto-Assign Least-Loaded Rep ─────────
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
  v_new_id          uuid;
  v_clean_name      text;
  v_clean_phone     text;
  v_assigned_rep_id uuid;
  v_rep_name        text;
  v_rep_phone       text;
begin
  v_clean_name := trim(p_name);
  v_clean_phone := trim(p_phone);

  if length(v_clean_phone) = 10 and v_clean_phone ~ '^1[0-9]{9}$' then
    v_clean_phone := '0' || v_clean_phone;
  end if;

  if exists (select 1 from public.user_profiles where phone = v_clean_phone and role = 'customer') then
    return jsonb_build_object(
      'success', false,
      'message', 'هذا الرقم مسجل مسبقاً كعميل، يرجى تسجيل الدخول'
    );
  end if;

  -- Least-Loaded Automatic Sales Rep Assignment:
  v_assigned_rep_id := public.fn_get_least_loaded_sales_rep();

  if v_assigned_rep_id is not null then
    select full_name, phone into v_rep_name, v_rep_phone
    from public.user_profiles
    where id = v_assigned_rep_id;
  end if;

  v_new_id := gen_random_uuid();
  insert into public.user_profiles (
    id,
    full_name,
    phone,
    company_name,
    role,
    assigned_sales_rep_id,
    is_active
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    nullif(trim(p_company), ''),
    'customer',
    v_assigned_rep_id,
    true
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', nullif(trim(p_company), ''),
      'role', 'customer',
      'assigned_sales_rep_id', v_assigned_rep_id,
      'assigned_sales_rep_name', v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone
    )
  );
end;
$$;

-- ── 7. Update sp_create_pending_order to Auto-Assign Least-Loaded Rep ─────────
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
as $$
declare
  v_customer_id     uuid;
  v_order_id        uuid;
  v_order_number    text;
  v_date_str        text;
  v_random_seq      integer;
  v_item            jsonb;
  v_final_rep_id    uuid;
  v_existing_rep_id uuid;
begin
  -- 1. Find or create customer profile by phone
  select id, assigned_sales_rep_id into v_customer_id, v_existing_rep_id
  from public.user_profiles
  where phone = trim(p_customer_phone)
  limit 1;

  -- Determine assigned sales rep:
  -- Priority: 1) Existing assigned rep (First-Touch Stickiness)
  --           2) p_sales_agent_id if explicitly passed
  --           3) Auto least-loaded sales rep
  if v_existing_rep_id is not null then
    v_final_rep_id := v_existing_rep_id;
  elsif p_sales_agent_id is not null then
    v_final_rep_id := p_sales_agent_id;
  else
    v_final_rep_id := public.fn_get_least_loaded_sales_rep();
  end if;

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
      v_final_rep_id,
      true
    );
  else
    -- Update existing profile: preserve existing rep or assign if previously null
    update public.user_profiles
    set
      full_name             = coalesce(trim(p_customer_name), full_name),
      company_name          = coalesce(trim(p_customer_company), company_name),
      assigned_sales_rep_id = coalesce(assigned_sales_rep_id, v_final_rep_id)
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
    v_final_rep_id,
    'pending',
    p_total_amount,
    p_shipping_address,
    p_notes,
    now(),
    now()
  );

  -- 4. Insert Order Items
  if p_items is not null and jsonb_array_length(p_items) > 0 then
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
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'sales_agent_id', v_final_rep_id
  );
end;
$$;



-- ------------------------------------------------------------------------------
-- Migration: 00022_allow_product_deletion_and_clean_order_items.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store — Migration 00022: Allow Safe Product & Category Deletions
-- Version   : 00022
-- Created   : 2026-09-16
-- Description:
--   1. Preserve order history when products are deleted:
--      - Add product_title and product_sku to order_items to preserve historical records.
--      - Drop NOT NULL on order_items.product_id.
--      - Alter order_items_product_id_fkey to ON DELETE SET NULL.
--   2. Ensure custom roles with can_manage_products / can_manage_categories
--      can perform CRUD/deletions on products & categories via RLS.
-- ==============================================================================

-- 1. Add product snapshot columns to order_items to preserve financial history
ALTER TABLE IF EXISTS public.order_items 
  ADD COLUMN IF NOT EXISTS product_title text,
  ADD COLUMN IF NOT EXISTS product_sku text;

-- 2. Backfill existing order_items with product title and SKU from products table
UPDATE public.order_items oi
SET 
  product_title = COALESCE(oi.product_title, p.title_ar, 'منتج محذوف'),
  product_sku   = COALESCE(oi.product_sku, p.sku, '')
FROM public.products p
WHERE oi.product_id = p.id;

-- 3. Make order_items.product_id NULLABLE so deleting a product does NOT violate foreign key
ALTER TABLE IF EXISTS public.order_items 
  ALTER COLUMN product_id DROP NOT NULL;

-- 4. Update foreign key constraint on order_items to ON DELETE SET NULL
ALTER TABLE IF EXISTS public.order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE IF EXISTS public.order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.products(id) 
  ON DELETE SET NULL;

-- 5. Ensure product_categories has ON DELETE CASCADE on both sides
ALTER TABLE IF EXISTS public.product_categories 
  DROP CONSTRAINT IF EXISTS product_categories_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_categories_category_id_fkey;

ALTER TABLE IF EXISTS public.product_categories 
  ADD CONSTRAINT product_categories_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_categories_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- 6. Ensure product_model_matrix has ON DELETE CASCADE on product_id
ALTER TABLE IF EXISTS public.product_model_matrix 
  DROP CONSTRAINT IF EXISTS product_model_matrix_product_id_fkey;

ALTER TABLE IF EXISTS public.product_model_matrix 
  ADD CONSTRAINT product_model_matrix_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 7. Update RLS on products to allow Custom Roles with can_manage_products permission
DROP POLICY IF EXISTS "Admin and Managers full access to products" ON public.products;
DROP POLICY IF EXISTS "Admin full access to products" ON public.products;

CREATE POLICY "Admin and Managers full access to products"
  ON public.products FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 
      FROM public.user_profiles up
      JOIN public.custom_roles cr ON up.custom_role_id = cr.id
      WHERE up.auth_user_id = auth.uid()
        AND up.is_active = true
        AND cr.can_manage_products = true
    )
  );

-- 8. Update RLS on categories to allow Custom Roles with can_manage_categories permission
DROP POLICY IF EXISTS "Admin and Managers full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories" ON public.categories;

CREATE POLICY "Admin and Managers full access to categories"
  ON public.categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 
      FROM public.user_profiles up
      JOIN public.custom_roles cr ON up.custom_role_id = cr.id
      WHERE up.auth_user_id = auth.uid()
        AND up.is_active = true
        AND cr.can_manage_categories = true
    )
  );



-- ------------------------------------------------------------------------------
-- Migration: 00023_extend_rls_for_custom_roles.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store - Migration 00023: Extend RLS for All Custom Role Permissions
-- Version   : 00023
-- Created   : 2026-09-19
-- ==============================================================================

-- Helper function to check custom role permission
CREATE OR REPLACE FUNCTION public.current_user_custom_role_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $func$
DECLARE
  v_result boolean := false;
BEGIN
  SELECT
    CASE p_permission
      WHEN 'can_manage_products'   THEN cr.can_manage_products
      WHEN 'can_manage_categories' THEN cr.can_manage_categories
      WHEN 'can_manage_matrix'     THEN cr.can_manage_matrix
      WHEN 'can_manage_orders'     THEN cr.can_manage_orders
      WHEN 'can_receive_customers' THEN cr.can_receive_customers
      WHEN 'can_manage_customers'  THEN cr.can_manage_customers
      WHEN 'can_manage_shortages'  THEN cr.can_manage_shortages
      WHEN 'can_manage_settings'   THEN cr.can_manage_settings
      ELSE false
    END INTO v_result
  FROM public.user_profiles up
  JOIN public.custom_roles cr ON up.custom_role_id = cr.id
  WHERE up.auth_user_id = auth.uid()
    AND up.is_active = true
  LIMIT 1;
  RETURN coalesce(v_result, false);
END;
$func$;

-- 1. product_model_matrix
DROP POLICY IF EXISTS "Admin and Matrix Managers full access to matrix" ON public.product_model_matrix;
DROP POLICY IF EXISTS "Admin full access to compatibility matrix" ON public.product_model_matrix;
CREATE POLICY "Admin and Matrix Managers full access to matrix"
  ON public.product_model_matrix FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_matrix')
    OR public.current_user_role() = 'warehouse_preparer'
  );

-- 2. master_models
DROP POLICY IF EXISTS "Admin and Matrix Managers full access to master models" ON public.master_models;
DROP POLICY IF EXISTS "Admin full access to master models" ON public.master_models;
CREATE POLICY "Admin and Matrix Managers full access to master models"
  ON public.master_models FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_matrix')
    OR public.current_user_role() = 'warehouse_preparer'
  );

-- 3. shortage_requests
DROP POLICY IF EXISTS "Admin and Sales full access to shortage_requests" ON public.shortage_requests;
CREATE POLICY "Admin and Sales full access to shortage_requests"
  ON public.shortage_requests FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_role() = 'sales_agent'
    OR public.current_user_custom_role_permission('can_manage_shortages')
  );

-- 4. orders - custom roles view
DROP POLICY IF EXISTS "Custom roles can view orders" ON public.orders;
CREATE POLICY "Custom roles can view orders"
  ON public.orders FOR SELECT
  USING (
    public.current_user_custom_role_permission('can_manage_orders')
    OR (
      public.current_user_custom_role_permission('can_receive_customers')
      AND (sales_agent_id IS NULL OR sales_agent_id = (
        SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      ))
    )
  );

DROP POLICY IF EXISTS "Custom roles can update orders" ON public.orders;
CREATE POLICY "Custom roles can update orders"
  ON public.orders FOR UPDATE
  USING (
    public.current_user_custom_role_permission('can_manage_orders')
    OR public.current_user_custom_role_permission('can_receive_customers')
  );

-- 5. user_profiles - allow custom roles to view customers
DROP POLICY IF EXISTS "Managers can view customers" ON public.user_profiles;
CREATE POLICY "Managers can view customers"
  ON public.user_profiles FOR SELECT
  USING (
    public.current_user_custom_role_permission('can_manage_customers')
    OR public.current_user_custom_role_permission('can_receive_customers')
  );

DROP POLICY IF EXISTS "Managers can update customer assignments" ON public.user_profiles;
CREATE POLICY "Managers can update customer assignments"
  ON public.user_profiles FOR UPDATE
  USING (
    role = 'customer'
    AND (
      public.current_user_custom_role_permission('can_manage_customers')
      OR public.current_user_custom_role_permission('can_receive_customers')
      OR public.current_user_role() = 'admin'
      OR public.current_user_role() = 'sales_agent'
    )
  );

-- 6. Storage - product-images bucket
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload product images" ON storage.objects;
CREATE POLICY "Staff can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );

DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update product images" ON storage.objects;
CREATE POLICY "Staff can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );

DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete product images" ON storage.objects;
CREATE POLICY "Staff can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );




-- ------------------------------------------------------------------------------
-- Migration: 00024_sales_rep_assignments_and_reports.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store - Migration 00024: Sales Rep Assignments, Reports & Transfers
-- Version   : 00024
-- Created   : 2026-09-20
-- Description:
--   1. Create sales_rep_assignments table (Audit Data Log for customer-rep links).
--   2. Update sp_customer_register to allow optional preferred sales rep (customer choice)
--      or fallback to automatic fair distribution (least loaded).
--   3. Create sp_admin_transfer_customer_rep for administrative reassignment.
--   4. Enable RLS and permissions for sales reps and admins.
-- ==============================================================================

-- ── 1. Create sales_rep_assignments Table ──────────────────────────────────────
create table if not exists public.sales_rep_assignments (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid references public.user_profiles(id) on delete cascade,
  customer_name     text not null,
  customer_phone    text not null,
  customer_company  text,
  sales_rep_id      uuid references public.user_profiles(id) on delete set null,
  sales_rep_name    text,
  previous_rep_id   uuid references public.user_profiles(id) on delete set null,
  previous_rep_name text,
  assignment_type   text not null check (assignment_type in ('auto_fair_distribution', 'customer_choice', 'admin_transfer')),
  notes             text,
  assigned_by       uuid references public.user_profiles(id) on delete set null,
  assigned_by_name  text,
  created_at        timestamptz not null default now()
);

-- Indexes for lightning fast queries
create index if not exists idx_rep_assignments_rep_id on public.sales_rep_assignments(sales_rep_id, created_at desc);
create index if not exists idx_rep_assignments_customer_id on public.sales_rep_assignments(customer_id);
create index if not exists idx_rep_assignments_type on public.sales_rep_assignments(assignment_type);
create index if not exists idx_rep_assignments_created_at on public.sales_rep_assignments(created_at desc);

-- ── 2. RLS for sales_rep_assignments ──────────────────────────────────────────
alter table public.sales_rep_assignments enable row level security;

drop policy if exists "Admin full access to sales_rep_assignments" on public.sales_rep_assignments;
create policy "Admin full access to sales_rep_assignments"
  on public.sales_rep_assignments for all
  using (
    public.current_user_role() = 'admin'
    or public.current_user_custom_role_permission('can_manage_customers')
  );

drop policy if exists "Sales Reps read own assignments" on public.sales_rep_assignments;
create policy "Sales Reps read own assignments"
  on public.sales_rep_assignments for select
  using (
    sales_rep_id in (
      select id from public.user_profiles where auth_user_id = auth.uid()
    )
    or previous_rep_id in (
      select id from public.user_profiles where auth_user_id = auth.uid()
    )
  );

-- ── 3. Update sp_customer_register with Preferred Rep & Auto Distribution ──────
create or replace function public.sp_customer_register(
  p_name         text,
  p_phone        text,
  p_company      text default null,
  p_sales_rep_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_new_id          uuid;
  v_clean_name      text;
  v_clean_phone     text;
  v_clean_company   text;
  v_assigned_rep_id uuid;
  v_rep_name        text;
  v_rep_phone       text;
  v_assignment_type text;
  v_notes           text;
begin
  v_clean_name := trim(p_name);
  v_clean_phone := trim(p_phone);
  v_clean_company := nullif(trim(p_company), '');

  if length(v_clean_phone) = 10 and v_clean_phone ~ '^1[0-9]{9}$' then
    v_clean_phone := '0' || v_clean_phone;
  end if;

  if exists (select 1 from public.user_profiles where phone = v_clean_phone and role = 'customer') then
    return jsonb_build_object(
      'success', false,
      'message', 'هذا الرقم مسجل مسبقاً كعميل، يرجى تسجيل الدخول'
    );
  end if;

  -- Check if customer chose a specific valid sales rep:
  if p_sales_rep_id is not null and exists (
    select 1 from public.user_profiles where id = p_sales_rep_id and is_active = true
  ) then
    v_assigned_rep_id := p_sales_rep_id;
    v_assignment_type := 'customer_choice';
    v_notes := 'طلب العميل هذا المندوب مباشرة عند التسجيل';
  else
    -- Automatic Least-Loaded Fair Distribution:
    v_assigned_rep_id := public.fn_get_least_loaded_sales_rep();
    v_assignment_type := 'auto_fair_distribution';
    v_notes := 'توزيع تلقائي عادل (المندوب الأقل تشغيلاً)';
  end if;

  if v_assigned_rep_id is not null then
    select full_name, phone into v_rep_name, v_rep_phone
    from public.user_profiles
    where id = v_assigned_rep_id;
  end if;

  v_new_id := gen_random_uuid();
  insert into public.user_profiles (
    id,
    full_name,
    phone,
    company_name,
    role,
    assigned_sales_rep_id,
    is_active
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    v_clean_company,
    'customer',
    v_assigned_rep_id,
    true
  );

  -- Log into sales_rep_assignments (Data Log)
  insert into public.sales_rep_assignments (
    customer_id,
    customer_name,
    customer_phone,
    customer_company,
    sales_rep_id,
    sales_rep_name,
    assignment_type,
    notes
  ) values (
    v_new_id,
    v_clean_name,
    v_clean_phone,
    v_clean_company,
    v_assigned_rep_id,
    v_rep_name,
    v_assignment_type,
    v_notes
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_new_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', v_clean_company,
      'role', 'customer',
      'assigned_sales_rep_id', v_assigned_rep_id,
      'assigned_sales_rep_name', v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone,
      'assignment_type', v_assignment_type
    )
  );
end;
$func$;

-- ── 4. Procedure: sp_admin_transfer_customer_rep ──────────────────────────────
create or replace function public.sp_admin_transfer_customer_rep(
  p_customer_id             uuid,
  p_new_rep_id              uuid,
  p_notes                   text default null,
  p_admin_id                uuid default null,
  p_reassign_pending_orders boolean default true
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_customer_name    text;
  v_customer_phone   text;
  v_customer_company text;
  v_old_rep_id       uuid;
  v_old_rep_name     text;
  v_new_rep_name     text;
  v_admin_name       text;
  v_orders_updated   int := 0;
begin
  -- Fetch customer
  select full_name, phone, company_name, assigned_sales_rep_id
  into v_customer_name, v_customer_phone, v_customer_company, v_old_rep_id
  from public.user_profiles
  where id = p_customer_id and role = 'customer';

  if not found then
    return jsonb_build_object('success', false, 'message', 'لم يتم العثور على العميل المطلوب');
  end if;

  -- Fetch old rep name if exists
  if v_old_rep_id is not null then
    select full_name into v_old_rep_name from public.user_profiles where id = v_old_rep_id;
  end if;

  -- Fetch new rep name
  select full_name into v_new_rep_name from public.user_profiles where id = p_new_rep_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'المندوب الجديد غير موجود في النظام');
  end if;

  -- Fetch admin name if admin_id passed
  if p_admin_id is not null then
    select full_name into v_admin_name from public.user_profiles where id = p_admin_id;
  end if;

  -- Update customer profile
  update public.user_profiles
  set assigned_sales_rep_id = p_new_rep_id,
      updated_at = now()
  where id = p_customer_id;

  -- Reassign pending orders if requested
  if p_reassign_pending_orders = true then
    update public.orders
    set sales_agent_id = p_new_rep_id
    where customer_id = p_customer_id and status = 'pending';
    get diagnostics v_orders_updated = row_count;
  end if;

  -- Log into sales_rep_assignments
  insert into public.sales_rep_assignments (
    customer_id,
    customer_name,
    customer_phone,
    customer_company,
    sales_rep_id,
    sales_rep_name,
    previous_rep_id,
    previous_rep_name,
    assignment_type,
    notes,
    assigned_by,
    assigned_by_name
  ) values (
    p_customer_id,
    v_customer_name,
    v_customer_phone,
    v_customer_company,
    p_new_rep_id,
    v_new_rep_name,
    v_old_rep_id,
    v_old_rep_name,
    'admin_transfer',
    coalesce(nullif(trim(p_notes), ''), 'تحويل إداري من لوحة التحكم'),
    p_admin_id,
    v_admin_name
  );

  return jsonb_build_object(
    'success', true,
    'message', 'تم تحويل العميل بنجاح وتوثيق الحركة في سجل العمليات',
    'orders_updated', v_orders_updated,
    'new_rep_id', p_new_rep_id,
    'new_rep_name', v_new_rep_name
  );
end;
$func$;

-- ── 5. Allow Public/Customer to Read Active Sales Reps & Custom Roles ─────────
drop policy if exists "Public can read active sales reps" on public.user_profiles;
create policy "Public can read active sales reps"
  on public.user_profiles for select
  using (
    coalesce(is_active, true) = true
    and (
      role in ('sales_agent', 'admin')
      or exists (
        select 1 from public.custom_roles cr
        where cr.id = user_profiles.custom_role_id
          and cr.can_receive_customers = true
      )
    )
  );

-- Allow public and customers to read custom_roles table so joined queries don't fail under RLS
drop policy if exists "Anyone can view custom roles" on public.custom_roles;
create policy "Anyone can view custom roles"
  on public.custom_roles for select
  using (true);

grant select on public.custom_roles to authenticated, anon;

-- ── 6. RPC: sp_get_active_sales_reps (Security Definer) ───────────────────────
create or replace function public.sp_get_active_sales_reps()
returns table (
  id uuid,
  full_name text,
  phone text,
  role text,
  custom_role_name text
)
language sql
security definer
stable
as $func$
  select 
    up.id,
    up.full_name,
    up.phone,
    up.role,
    cr.name_ar as custom_role_name
  from public.user_profiles up
  left join public.custom_roles cr on up.custom_role_id = cr.id
  where coalesce(up.is_active, true) = true
    and (
      up.role in ('sales_agent', 'admin')
      or cr.can_receive_customers = true
    )
  order by up.full_name asc;
$func$;


-- ── 7. RPC: sp_customer_choose_sales_rep (Security Definer) ───────────────────
create or replace function public.sp_customer_choose_sales_rep(
  p_customer_id  uuid,
  p_sales_rep_id uuid default null,
  p_notes        text default null
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_customer_name    text;
  v_customer_phone   text;
  v_customer_company text;
  v_old_rep_id       uuid;
  v_old_rep_name     text;
  v_new_rep_id       uuid;
  v_new_rep_name     text;
  v_new_rep_phone    text;
  v_assignment_type  text;
  v_notes            text;
begin
  select full_name, phone, company_name, assigned_sales_rep_id
  into v_customer_name, v_customer_phone, v_customer_company, v_old_rep_id
  from public.user_profiles
  where id = p_customer_id and role = 'customer';

  if not found then
    return jsonb_build_object('success', false, 'message', 'العميل غير موجود');
  end if;

  if v_old_rep_id is not null then
    select full_name into v_old_rep_name from public.user_profiles where id = v_old_rep_id;
  end if;

  if p_sales_rep_id is not null and exists (
    select 1 from public.user_profiles where id = p_sales_rep_id and is_active = true
  ) then
    v_new_rep_id := p_sales_rep_id;
    v_assignment_type := 'customer_choice';
    v_notes := coalesce(nullif(trim(p_notes), ''), 'قام العميل باختيار هذا المندوب بنفسه من حسابه');
  else
    v_new_rep_id := public.fn_get_least_loaded_sales_rep();
    v_assignment_type := 'auto_fair_distribution';
    v_notes := 'طلب العميل إعادة التوزيع العادل التلقائي';
  end if;

  select full_name, phone into v_new_rep_name, v_new_rep_phone
  from public.user_profiles
  where id = v_new_rep_id;

  update public.user_profiles
  set assigned_sales_rep_id = v_new_rep_id,
      updated_at = now()
  where id = p_customer_id;

  -- Reassign any pending orders to new rep
  update public.orders
  set sales_agent_id = v_new_rep_id
  where customer_id = p_customer_id and status = 'pending';

  -- Log into sales_rep_assignments (Data Log)
  insert into public.sales_rep_assignments (
    customer_id,
    customer_name,
    customer_phone,
    customer_company,
    sales_rep_id,
    sales_rep_name,
    previous_rep_id,
    previous_rep_name,
    assignment_type,
    notes
  ) values (
    p_customer_id,
    v_customer_name,
    v_customer_phone,
    v_customer_company,
    v_new_rep_id,
    v_new_rep_name,
    v_old_rep_id,
    v_old_rep_name,
    v_assignment_type,
    v_notes
  );

  return jsonb_build_object(
    'success', true,
    'message', 'تم تحديث المندوب المعتمد لخدمتك بنجاح',
    'sales_rep_id', v_new_rep_id,
    'sales_rep_name', v_new_rep_name,
    'sales_rep_phone', v_new_rep_phone,
    'assignment_type', v_assignment_type
  );
end;
$func$;

-- ── 8. Permissions & Grants ──────────────────────────────────────────────────
grant execute on function public.sp_get_active_sales_reps() to authenticated, anon;
grant execute on function public.sp_customer_choose_sales_rep(uuid, uuid, text) to authenticated, anon;
grant execute on function public.fn_get_least_loaded_sales_rep() to authenticated, anon;
grant select on public.sales_rep_assignments to authenticated, anon;
grant insert on public.sales_rep_assignments to authenticated, anon;


-- ------------------------------------------------------------------------------
-- Migration: 00025_customer_management_and_admin_controls.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store - Migration 00025: Customer Management & Admin Controls
-- Version   : 00025
-- Created   : 2026-09-20
-- Description:
--   1. Ensures RLS policies on user_profiles allow reading and managing customer records
--   2. Adds sp_admin_get_customers() security definer function for guaranteed customer listing
--   3. Adds sp_admin_save_customer() for creating or updating customers from the dashboard
--   4. Adds sp_admin_toggle_customer_status() for activating/deactivating customers
--   5. Adds sp_admin_delete_customer() for safe deletion or deactivation
-- ==============================================================================

-- ── 1. Fix RLS on user_profiles for Customer Records ─────────────────────────
-- Ensure customers can always be read by staff, admins, and the system
drop policy if exists "Allow reading customer profiles" on public.user_profiles;
create policy "Allow reading customer profiles"
  on public.user_profiles for select
  using (
    role = 'customer'
    or is_active = true
  );

-- Ensure admins and authorized staff can update customers
drop policy if exists "Admin and managers update customers" on public.user_profiles;
create policy "Admin and managers update customers"
  on public.user_profiles for update
  using (
    role = 'customer'
    and (
      public.current_user_role() = 'admin'
      or public.current_user_role() = 'sales_agent'
      or public.current_user_custom_role_permission('can_manage_customers')
      or public.current_user_custom_role_permission('can_receive_customers')
    )
  );

-- Ensure admins can insert customer profiles
drop policy if exists "Admin and public insert customers" on public.user_profiles;
create policy "Admin and public insert customers"
  on public.user_profiles for insert
  with check (
    role = 'customer'
    or public.current_user_role() = 'admin'
  );

-- ── 2. RPC: sp_admin_get_customers (Security Definer) ─────────────────────────
create or replace function public.sp_admin_get_customers()
returns table (
  id                    uuid,
  full_name             text,
  phone                 text,
  company_name          text,
  city                  text,
  address               text,
  role                  text,
  is_active             boolean,
  assigned_sales_rep_id uuid,
  assigned_sales_rep_name text,
  assigned_sales_rep_phone text,
  assignment_type       text,
  created_at            timestamptz,
  updated_at            timestamptz
)
language sql
security definer
stable
as $func$
  select 
    c.id,
    c.full_name,
    c.phone,
    c.company_name,
    c.city,
    c.address,
    c.role,
    coalesce(c.is_active, true) as is_active,
    c.assigned_sales_rep_id,
    rep.full_name as assigned_sales_rep_name,
    rep.phone as assigned_sales_rep_phone,
    coalesce(latest_log.assignment_type, 'auto_fair_distribution') as assignment_type,
    c.created_at,
    c.updated_at
  from public.user_profiles c
  left join public.user_profiles rep on c.assigned_sales_rep_id = rep.id
  left join lateral (
    select assignment_type
    from public.sales_rep_assignments
    where customer_id = c.id
    order by created_at desc
    limit 1
  ) latest_log on true
  where c.role = 'customer'
  order by c.created_at desc;
$func$;


-- ── 3. RPC: sp_admin_save_customer (Create or Edit) ──────────────────────────
create or replace function public.sp_admin_save_customer(
  p_id                    uuid default null,
  p_full_name             text default null,
  p_phone                 text default null,
  p_company_name          text default null,
  p_is_active             boolean default true,
  p_assigned_sales_rep_id uuid default null,
  p_notes                 text default null,
  p_admin_id              uuid default null
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_customer_id       uuid;
  v_old_rep_id        uuid;
  v_old_rep_name      text;
  v_new_rep_id        uuid;
  v_new_rep_name      text;
  v_new_rep_phone     text;
  v_admin_name        text;
  v_clean_phone       text;
  v_clean_name        text;
  v_assignment_type   text;
  v_is_new            boolean := false;
begin
  v_clean_name := trim(p_full_name);
  v_clean_phone := trim(p_phone);

  if v_clean_name is null or v_clean_name = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال اسم العميل');
  end if;

  if v_clean_phone is null or v_clean_phone = '' then
    return jsonb_build_object('success', false, 'message', 'يرجى إدخال رقم الهاتف');
  end if;

  if p_admin_id is not null then
    select full_name into v_admin_name from public.user_profiles where id = p_admin_id;
  end if;

  -- Determine assigned sales rep
  if p_assigned_sales_rep_id is not null and exists (
    select 1 from public.user_profiles where id = p_assigned_sales_rep_id and is_active = true
  ) then
    v_new_rep_id := p_assigned_sales_rep_id;
    v_assignment_type := 'admin_transfer';
  else
    v_new_rep_id := public.fn_get_least_loaded_sales_rep();
    v_assignment_type := 'auto_fair_distribution';
  end if;

  select full_name, phone into v_new_rep_name, v_new_rep_phone
  from public.user_profiles
  where id = v_new_rep_id;

  if p_id is null then
    -- CREATE NEW CUSTOMER
    v_is_new := true;
    
    -- Check if phone already registered
    if exists (select 1 from public.user_profiles where phone = v_clean_phone and role = 'customer') then
      return jsonb_build_object('success', false, 'message', 'رقم الهاتف مسجل مسبقاً لعميل آخر');
    end if;

    insert into public.user_profiles (
      full_name,
      phone,
      company_name,
      role,
      is_active,
      assigned_sales_rep_id
    ) values (
      v_clean_name,
      v_clean_phone,
      trim(p_company_name),
      'customer',
      p_is_active,
      v_new_rep_id
    ) returning id into v_customer_id;


    -- Log assignment in data log
    insert into public.sales_rep_assignments (
      customer_id,
      customer_name,
      customer_phone,
      customer_company,
      sales_rep_id,
      sales_rep_name,
      assignment_type,
      notes,
      assigned_by,
      assigned_by_name
    ) values (
      v_customer_id,
      v_clean_name,
      v_clean_phone,
      trim(p_company_name),
      v_new_rep_id,
      v_new_rep_name,
      v_assignment_type,
      coalesce(nullif(trim(p_notes), ''), 'تمت إضافة العميل وتعيين المندوب من لوحة التحكم'),
      p_admin_id,
      v_admin_name
    );

  else
    -- UPDATE EXISTING CUSTOMER
    v_customer_id := p_id;

    select assigned_sales_rep_id into v_old_rep_id
    from public.user_profiles
    where id = v_customer_id and role = 'customer';

    if not found then
      return jsonb_build_object('success', false, 'message', 'العميل غير موجود');
    end if;

    if v_old_rep_id is not null then
      select full_name into v_old_rep_name from public.user_profiles where id = v_old_rep_id;
    end if;

    -- Check phone collision with other customers
    if exists (select 1 from public.user_profiles where phone = v_clean_phone and role = 'customer' and id <> v_customer_id) then
      return jsonb_build_object('success', false, 'message', 'رقم الهاتف مسجل مسبقاً لعميل آخر');
    end if;

    -- If rep didn't change, keep existing rep
    if p_assigned_sales_rep_id is not null and p_assigned_sales_rep_id = v_old_rep_id then
      v_new_rep_id := v_old_rep_id;
    end if;

    update public.user_profiles
    set full_name             = v_clean_name,
        phone                 = v_clean_phone,
        company_name          = trim(p_company_name),
        is_active             = p_is_active,
        assigned_sales_rep_id = v_new_rep_id,
        updated_at            = now()
    where id = v_customer_id;


    -- Log change if sales rep changed
    if v_new_rep_id <> coalesce(v_old_rep_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      -- Reassign pending orders
      update public.orders
      set sales_agent_id = v_new_rep_id
      where customer_id = v_customer_id and status = 'pending';

      insert into public.sales_rep_assignments (
        customer_id,
        customer_name,
        customer_phone,
        customer_company,
        sales_rep_id,
        sales_rep_name,
        previous_rep_id,
        previous_rep_name,
        assignment_type,
        notes,
        assigned_by,
        assigned_by_name
      ) values (
        v_customer_id,
        v_clean_name,
        v_clean_phone,
        trim(p_company_name),
        v_new_rep_id,
        v_new_rep_name,
        v_old_rep_id,
        v_old_rep_name,
        'admin_transfer',
        coalesce(nullif(trim(p_notes), ''), 'تعديل بيانات العميل وتحويل المندوب من الإدارة'),
        p_admin_id,
        v_admin_name
      );
    end if;

  end if;

  return jsonb_build_object(
    'success', true,
    'message', case when v_is_new then 'تمت إضافة العميل بنجاح' else 'تم حفظ بيانات العميل بنجاح' end,
    'customer', jsonb_build_object(
      'id', v_customer_id,
      'full_name', v_clean_name,
      'phone', v_clean_phone,
      'company_name', trim(p_company_name),
      'role', 'customer',
      'is_active', p_is_active,
      'assigned_sales_rep_id', v_new_rep_id,
      'assigned_sales_rep_name', v_new_rep_name,
      'assigned_sales_rep_phone', v_new_rep_phone,
      'assignment_type', v_assignment_type
    )
  );
end;
$func$;

-- ── 4. RPC: sp_admin_toggle_customer_status ──────────────────────────────────
create or replace function public.sp_admin_toggle_customer_status(
  p_customer_id uuid,
  p_is_active   boolean
)
returns jsonb
language plpgsql
security definer
as $func$
begin
  update public.user_profiles
  set is_active = p_is_active,
      updated_at = now()
  where id = p_customer_id and role = 'customer';

  if not found then
    return jsonb_build_object('success', false, 'message', 'العميل غير موجود');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', case when p_is_active then 'تم تفعيل حساب العميل بنجاح' else 'تم تعطيل حساب العميل بنجاح' end
  );
end;
$func$;

-- ── 5. RPC: sp_admin_delete_customer ──────────────────────────────────────────
create or replace function public.sp_admin_delete_customer(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_has_orders boolean;
begin
  select exists(select 1 from public.orders where customer_id = p_customer_id)
  into v_has_orders;

  if v_has_orders then
    -- Cannot hard delete because of foreign key constraint in orders; deactivate instead
    update public.user_profiles
    set is_active = false,
        updated_at = now()
    where id = p_customer_id and role = 'customer';

    return jsonb_build_object(
      'success', true,
      'action', 'deactivated',
      'message', 'تم تعطيل حساب العميل بنجاح (لا يمكن الحذف النهائي لوجود طلبات مسجلة باسمه حفظاً للبيانات المالية)'
    );
  else
    -- Delete assignment logs
    delete from public.sales_rep_assignments where customer_id = p_customer_id;
    -- Delete customer profile
    delete from public.user_profiles where id = p_customer_id and role = 'customer';

    return jsonb_build_object(
      'success', true,
      'action', 'deleted',
      'message', 'تم حذف العميل وسجلاته بنجاح'
    );
  end if;
end;
$func$;

-- ── 6. Permissions & Grants ──────────────────────────────────────────────────
grant execute on function public.sp_admin_get_customers() to authenticated, anon;
grant execute on function public.sp_admin_save_customer(uuid, text, text, text, boolean, uuid, text, uuid) to authenticated, anon;
grant execute on function public.sp_admin_toggle_customer_status(uuid, boolean) to authenticated, anon;
grant execute on function public.sp_admin_delete_customer(uuid) to authenticated, anon;



-- ------------------------------------------------------------------------------
-- Migration: 00026_custom_roles_full_catalog_permissions.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store - Migration 00026: Full Custom Roles Catalog & Category RLS
-- Version   : 00026
-- Created   : 2026-09-22
-- Purpose   : Extend RLS on products, product_categories, categories, and
--             store_settings so custom roles with the right permissions can
--             INSERT / UPDATE / DELETE in addition to SELECT.
-- ==============================================================================

-- ── 1. products ─────────────────────────────────────────────────────────────
-- Replace existing policy (already created in 00022) to use the helper function
-- current_user_custom_role_permission for cleaner / consistent lookups.
DROP POLICY IF EXISTS "Admin and Managers full access to products" ON public.products;
DROP POLICY IF EXISTS "Admin full access to products"             ON public.products;

CREATE POLICY "Admin and Managers full access to products"
  ON public.products FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
  );

-- ── 2. product_categories ───────────────────────────────────────────────────
-- Junction table — custom roles with can_manage_products or can_manage_categories
-- must be able to link/unlink products ↔ categories.
DROP POLICY IF EXISTS "Admin and Managers full access to product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin full access to product categories"              ON public.product_categories;

CREATE POLICY "Admin and Managers full access to product categories"
  ON public.product_categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
    OR public.current_user_custom_role_permission('can_manage_categories')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
    OR public.current_user_custom_role_permission('can_manage_categories')
  );

-- ── 3. categories ────────────────────────────────────────────────────────────
-- Replace the policy created in 00022 to use the helper function.
DROP POLICY IF EXISTS "Admin and Managers full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories"             ON public.categories;

CREATE POLICY "Admin and Managers full access to categories"
  ON public.categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_categories')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_categories')
  );

-- ── 4. store_settings ────────────────────────────────────────────────────────
-- Only admins and custom roles with can_manage_settings may UPDATE / INSERT.
DROP POLICY IF EXISTS "Staff can update store settings"             ON public.store_settings;
DROP POLICY IF EXISTS "Admin and Settings Managers full access"     ON public.store_settings;

-- Keep the existing public SELECT open (from 00016).
-- Add a stricter UPDATE/INSERT/DELETE policy for settings managers.
CREATE POLICY "Admin and Settings Managers full access"
  ON public.store_settings FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_settings')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_settings')
  );



-- ------------------------------------------------------------------------------
-- Migration: 00027_customer_approval_system.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- MH EL MAHDY Store - Migration 00027: Customer Approval System
-- Version   : 00027
-- Created   : 2026-10-06
-- Purpose   : Add approval_status + rejection_reason to user_profiles for
--             customers; update sp_customer_register to set pending by default;
--             add sp_admin_approve_customer and sp_admin_reject_customer RPCs;
--             update sp_admin_get_customers to include approval status;
--             add a safe products_public view for unauthenticated browsing.
-- ==============================================================================

-- ── 1. Add approval and safety columns to user_profiles ───────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text
    DEFAULT 'approved'  -- existing customers/staff keep approved; new customers get pending via sp_customer_register
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'auto_fair_distribution';

-- ── 2. Set ALL existing customers to 'approved' so no one is locked out ──────
UPDATE public.user_profiles
  SET approval_status = 'approved'
  WHERE role = 'customer' AND (approval_status IS NULL OR approval_status = '');

-- ── 3. Update sp_customer_register to auto-set pending ───────────────────────
CREATE OR REPLACE FUNCTION public.sp_customer_register(
  p_name    text,
  p_phone   text,
  p_company text DEFAULT NULL,
  p_sales_rep_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone           text;
  v_clean_name      text;
  v_clean_company   text;
  v_existing_id     uuid;
  v_new_id          uuid;
  v_rep_id          uuid;
  v_rep_name        text;
  v_rep_phone       text;
  v_assignment_type text;
  v_notes           text;
BEGIN
  -- Normalize inputs
  v_clean_name    := trim(p_name);
  v_clean_company := nullif(trim(p_company), '');
  v_phone         := regexp_replace(trim(p_phone), '^(\+20|20|0)', '');

  IF char_length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير صالح');
  END IF;
  v_phone := '0' || v_phone;

  -- Check for duplicates
  SELECT id INTO v_existing_id
    FROM public.user_profiles
    WHERE phone = v_phone AND role = 'customer'
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول');
  END IF;

  -- Resolve sales rep
  v_rep_id          := NULL;
  v_rep_name        := NULL;
  v_rep_phone       := NULL;
  v_assignment_type := 'auto_fair_distribution';
  v_notes           := 'توزيع تلقائي عادل (المندوب الأقل تشغيلاً)';

  -- Case 1: Customer explicitly chose an active rep
  IF p_sales_rep_id IS NOT NULL THEN
    SELECT id, full_name, phone INTO v_rep_id, v_rep_name, v_rep_phone
      FROM public.user_profiles
      WHERE id = p_sales_rep_id AND is_active = true
      LIMIT 1;
    IF v_rep_id IS NOT NULL THEN
      v_assignment_type := 'customer_choice';
      v_notes           := 'طلب العميل هذا المندوب مباشرة عند التسجيل';
    END IF;
  END IF;

  -- Case 2: Automatic least-loaded distribution if none chosen
  IF v_rep_id IS NULL THEN
    BEGIN
      v_rep_id := public.fn_get_least_loaded_sales_rep();
    EXCEPTION WHEN OTHERS THEN
      v_rep_id := NULL;
    END;

    IF v_rep_id IS NOT NULL THEN
      SELECT full_name, phone INTO v_rep_name, v_rep_phone
        FROM public.user_profiles
        WHERE id = v_rep_id
        LIMIT 1;
    END IF;
  END IF;

  -- Insert new customer with approval_status = 'pending'
  v_new_id := gen_random_uuid();
  INSERT INTO public.user_profiles (
    id,
    full_name,
    phone,
    company_name,
    role,
    assigned_sales_rep_id,
    is_active,
    approval_status
  ) VALUES (
    v_new_id,
    v_clean_name,
    v_phone,
    v_clean_company,
    'customer',
    v_rep_id,
    true,
    'pending'
  );

  -- Log into sales_rep_assignments (Data Log table)
  BEGIN
    INSERT INTO public.sales_rep_assignments (
      customer_id,
      customer_name,
      customer_phone,
      customer_company,
      sales_rep_id,
      sales_rep_name,
      assignment_type,
      notes
    ) VALUES (
      v_new_id,
      v_clean_name,
      v_phone,
      v_clean_company,
      v_rep_id,
      v_rep_name,
      v_assignment_type,
      v_notes
    );
  EXCEPTION WHEN OTHERS THEN
    -- If sales_rep_assignments logging encounters any issue, registration still succeeds
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                       v_new_id,
      'full_name',                v_clean_name,
      'phone',                    v_phone,
      'company_name',             v_clean_company,
      'approval_status',          'pending',
      'assigned_sales_rep_id',    v_rep_id,
      'assigned_sales_rep_name',  v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone,
      'assignment_type',          v_assignment_type
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 4. Admin: approve customer ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sp_admin_approve_customer(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
    SET approval_status = 'approved',
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تمت الموافقة على العميل وتفعيل حسابه');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 5. Admin: reject customer ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sp_admin_reject_customer(
  p_customer_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
    SET approval_status = 'rejected',
        rejection_reason = p_reason,
        updated_at = now()
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تم رفض طلب العميل');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 6. Update sp_customer_login to return approval_status ────────────────────
CREATE OR REPLACE FUNCTION public.sp_customer_login(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone           text;
  v_profile         record;
  v_rep             record;
  v_assignment_type text;
BEGIN
  v_phone := regexp_replace(trim(p_phone), '^(\+20|20|0)', '');
  IF char_length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير صالح');
  END IF;
  v_phone := '0' || v_phone;

  SELECT * INTO v_profile
    FROM public.user_profiles
    WHERE phone = v_phone AND role = 'customer' AND is_active = true
    LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد');
  END IF;

  -- Fetch rep info if assigned
  IF v_profile.assigned_sales_rep_id IS NOT NULL THEN
    SELECT full_name, phone INTO v_rep
      FROM public.user_profiles
      WHERE id = v_profile.assigned_sales_rep_id
      LIMIT 1;
  END IF;

  -- Fetch latest assignment type
  BEGIN
    SELECT assignment_type INTO v_assignment_type
      FROM public.sales_rep_assignments
      WHERE customer_id = v_profile.id
      ORDER BY created_at DESC
      LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_assignment_type := 'auto_fair_distribution';
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                       v_profile.id,
      'full_name',                v_profile.full_name,
      'phone',                    v_profile.phone,
      'company_name',             v_profile.company_name,
      'approval_status',          coalesce(v_profile.approval_status, 'approved'),
      'rejection_reason',         v_profile.rejection_reason,
      'assigned_sales_rep_id',    v_profile.assigned_sales_rep_id,
      'assigned_sales_rep_name',  v_rep.full_name,
      'assigned_sales_rep_phone', v_rep.phone,
      'assignment_type',          coalesce(v_assignment_type, 'auto_fair_distribution')
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 7. Update sp_admin_get_customers to include approval status ──────────────
DROP FUNCTION IF EXISTS public.sp_admin_get_customers();

CREATE OR REPLACE FUNCTION public.sp_admin_get_customers()
RETURNS TABLE (
  id                      uuid,
  full_name               text,
  phone                   text,
  company_name            text,
  city                    text,
  address                 text,
  role                    text,
  is_active               boolean,
  approval_status         text,
  rejection_reason        text,
  assigned_sales_rep_id   uuid,
  assigned_sales_rep_name text,
  assigned_sales_rep_phone text,
  assignment_type         text,
  created_at              timestamptz,
  updated_at              timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $func$
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.company_name,
    c.city,
    c.address,
    c.role,
    coalesce(c.is_active, true) as is_active,
    coalesce(c.approval_status, 'approved') as approval_status,
    c.rejection_reason,
    c.assigned_sales_rep_id,
    rep.full_name as assigned_sales_rep_name,
    rep.phone as assigned_sales_rep_phone,
    coalesce(latest_log.assignment_type, 'auto_fair_distribution') as assignment_type,
    c.created_at,
    c.updated_at
  FROM public.user_profiles c
  LEFT JOIN public.user_profiles rep ON c.assigned_sales_rep_id = rep.id
  LEFT JOIN LATERAL (
    SELECT assignment_type
    FROM public.sales_rep_assignments
    WHERE customer_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) latest_log ON true
  WHERE c.role = 'customer'
  ORDER BY c.created_at DESC;
$func$;

-- ── 8. Permissions ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sp_admin_approve_customer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_admin_reject_customer(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_customer_register(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_customer_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_admin_get_customers() TO anon, authenticated;

-- ── 9. Index for fast pending lookups ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status
  ON public.user_profiles (approval_status)
  WHERE role = 'customer';

-- ── 10. Public view for catalog browsing (no prices/costs/descriptions) ────────
CREATE OR REPLACE VIEW public.products_public AS
  SELECT 
    id,
    sku,
    title_ar,
    image_url,
    gallery_urls,
    is_featured,
    is_exchange_only,
    has_compatibility_matrix,
    is_active,
    created_at,
    updated_at
  FROM public.products
  WHERE is_active = true;

GRANT SELECT ON public.products_public TO anon, authenticated;


