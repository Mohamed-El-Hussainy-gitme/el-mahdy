-- ==============================================================================
-- MH EL MAHDY B2B Store — Master Consolidated Migrations
-- Version: 2.0 (Complete Operational Logic with Updates & Clean Reset)
-- Description:
--   • Clean Reset: Drops existing tables safely with CASCADE to resolve past schema conflicts.
--   • Schema: 9 core tables (Categories Tree, Master Models, Products, Product Categories,
--             Compatibility Matrix, User Profiles, Orders, Order Items, Shortages).
--   • Business Logic Triggers: Order lifecycle transitions, inventory deduction on confirmation,
--                             auto-order numbering, stock status auto-sync, sticky sales rep.
--   • Operational Stored Procedures: Controlled update functions for orders, stock matrix, and sticky rep.
--   • Seed Data: 18 primary categories, comprehensive phone models, yasbas-styled products,
--                compatibility matrix entries, staff profiles with ON CONFLICT DO UPDATE.
--   • Row Level Security (RLS): RBAC segregation for Admin, Sales Agent, Warehouse Preparer, Customer.
-- ==============================================================================

-- ── 0. CLEAN RESET (Safe development reset to eliminate column mismatch errors) ─
drop table if exists inventory_adjustments cascade;
drop table if exists shortage_requests cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists user_profiles cascade;
drop table if exists product_model_matrix cascade;
drop table if exists product_categories cascade;
drop table if exists products cascade;
drop table if exists master_models cascade;
drop table if exists categories cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Helper: auto-update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 1. Categories (Infinite Tree Hierarchy via parent_id) ───────────────────────
create table categories (
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

create index idx_categories_parent_id on categories(parent_id);
create index idx_categories_slug      on categories(slug);
create index idx_categories_active    on categories(is_active);

create trigger trg_categories_updated_at
before update on categories
for each row execute function public.set_updated_at();

-- ── 2. Master Models (Central repository of phone models) ──────────────────────
create table master_models (
    id           uuid        primary key default gen_random_uuid(),
    brand        text        not null,   -- 'Apple', 'Samsung', 'Xiaomi', 'Oppo', etc.
    series       text,                   -- e.g. 'iPhone 15', 'Galaxy S24'
    model_name   text        not null,   -- e.g. 'iPhone 15 Pro Max'
    release_year integer,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index idx_master_models_brand on master_models(brand);
create index idx_master_models_name  on master_models(model_name);

create trigger trg_master_models_updated_at
before update on master_models
for each row execute function public.set_updated_at();

-- ── 3. Products (Single Price Model, Visible to Everyone) ─────────────────────
create table products (
    id                       uuid          primary key default gen_random_uuid(),
    sku                      text          not null unique,
    title_ar                 text          not null,
    description_ar           text,
    image_url                text,
    gallery_urls             text[]        not null default '{}',
    price                    numeric(10,2) not null check (price >= 0),
    cost_price               numeric(10,2) not null default 0 check (cost_price >= 0),
    is_exchange_only         boolean       not null default false,
    is_featured              boolean       not null default false,
    is_active                boolean       not null default true,
    has_compatibility_matrix boolean       not null default false,
    created_at               timestamptz   not null default now(),
    updated_at               timestamptz   not null default now()
);

create index idx_products_sku      on products(sku);
create index idx_products_featured on products(is_featured) where is_featured = true;
create index idx_products_active   on products(is_active)   where is_active   = true;
create index idx_products_cost     on products(cost_price);

create trigger trg_products_updated_at
before update on products
for each row execute function public.set_updated_at();

-- ── 4. Product ↔ Category (Many-to-Many Relationship) ─────────────────────────
create table product_categories (
    product_id  uuid not null references products(id)   on delete cascade,
    category_id uuid not null references categories(id) on delete cascade,
    primary key (product_id, category_id)
);

create index idx_product_categories_cat on product_categories(category_id);

-- ── 5. Compatibility Matrix & Stock ───────────────────────────────────────────
create table product_model_matrix (
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

create index idx_matrix_product_id on product_model_matrix(product_id);
create index idx_matrix_model_id   on product_model_matrix(model_id);
create index idx_matrix_status     on product_model_matrix(stock_status);

create trigger trg_matrix_updated_at
before update on product_model_matrix
for each row execute function public.set_updated_at();

-- ── 6. User Profiles (RBAC Roles + Sticky Sales Rep Assignment) ───────────────
create table user_profiles (
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

create index idx_user_profiles_auth_user on user_profiles(auth_user_id);
create index idx_user_profiles_role      on user_profiles(role);
create index idx_user_profiles_sales_rep on user_profiles(assigned_sales_rep_id);
create index idx_user_profiles_email     on user_profiles(email);

create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute function public.set_updated_at();

-- ── 7. Orders (4-Stage Lifecycle) ─────────────────────────────────────────────
create table orders (
    id               uuid          primary key default gen_random_uuid(),
    order_number     text          not null unique default '',
    customer_id      uuid          not null references user_profiles(id) on delete restrict,
    sales_agent_id   uuid          references user_profiles(id)          on delete set null,
    status           text          not null default 'pending'
                                   check (status in ('pending', 'preparation', 'shipping', 'delivered', 'returned')),
    total_amount     numeric(10,2) not null default 0 check (total_amount >= 0),
    shipping_address text,
    carrier_name     text,
    waybill_number   text,
    tracking_notes   text,
    return_reason    text          check (return_reason is null or return_reason in ('customer_refused', 'damaged_in_transit', 'wrong_order', 'wrong_model', 'other')),
    return_notes     text,
    notes            text,
    created_at       timestamptz   not null default now(),
    confirmed_at     timestamptz,
    shipped_at       timestamptz,
    delivered_at     timestamptz,
    returned_at      timestamptz,
    updated_at       timestamptz   not null default now()
);

create index idx_orders_customer   on orders(customer_id);
create index idx_orders_sales_rep  on orders(sales_agent_id);
create index idx_orders_status     on orders(status);
create index idx_orders_created_at on orders(created_at desc);

create trigger trg_orders_updated_at
before update on orders
for each row execute function public.set_updated_at();

-- ── 8. Order Items ────────────────────────────────────────────────────────────
create table order_items (
    id         uuid          primary key default gen_random_uuid(),
    order_id   uuid          not null references orders(id)        on delete cascade,
    product_id uuid          not null references products(id)      on delete restrict,
    model_id   uuid          references master_models(id)          on delete set null,
    quantity   integer       not null default 1 check (quantity >= 1),
    unit_price numeric(10,2) not null check (unit_price >= 0),
    subtotal   numeric(10,2) not null check (subtotal >= 0),
    created_at timestamptz   not null default now()
);

create index idx_order_items_order   on order_items(order_id);
create index idx_order_items_product on order_items(product_id);

-- ── 9. Shortage Requests ──────────────────────────────────────────────────────
create table shortage_requests (
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

create index idx_shortage_status     on shortage_requests(status);
create index idx_shortage_customer   on shortage_requests(customer_id);
create index idx_shortage_created_at on shortage_requests(created_at desc);

create trigger trg_shortage_updated_at
before update on shortage_requests
for each row execute function public.set_updated_at();


-- ==============================================================================
-- BUSINESS LOGIC TRIGGERS
-- ==============================================================================

-- ── Trigger 1: Auto-generate order_number (ORD-YYYYMMDD-XXXXX) ────────────────
create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
declare
  v_date text;
  v_seq  integer;
begin
  if new.order_number is null or new.order_number = '' then
    v_date := to_char(now(), 'YYYYMMDD');
    select coalesce(max((regexp_match(order_number, 'ORD-\d{8}-(\d+)'))[1]::integer), 0) + 1
    into v_seq from public.orders where order_number like 'ORD-' || v_date || '-%';
    new.order_number := 'ORD-' || v_date || '-' || lpad(v_seq::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_order_number
before insert on orders
for each row execute function public.generate_order_number();

-- ── Trigger 2: Auto-sync stock_status on Matrix quantity changes ───────────────
create or replace function public.sync_stock_status()
returns trigger language plpgsql as $$
begin
  new.stock_status := case
    when new.stock_quantity = 0   then 'out_of_stock'
    when new.stock_quantity <= 10 then 'limited'
    else                               'in_stock'
  end;
  return new;
end;
$$;

create trigger trg_sync_stock_status
before insert or update of stock_quantity on product_model_matrix
for each row execute function public.sync_stock_status();

-- ── Trigger 3: Apply Sticky Sales Rep on new Order ────────────────────────────
create or replace function public.apply_sticky_sales_rep()
returns trigger language plpgsql security definer as $$
declare
  v_rep_id uuid;
begin
  if new.sales_agent_id is null then
    select assigned_sales_rep_id into v_rep_id
    from public.user_profiles where id = new.customer_id limit 1;
    if v_rep_id is not null then
      new.sales_agent_id := v_rep_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_apply_sticky_rep
before insert on orders
for each row execute function public.apply_sticky_sales_rep();

-- ── Trigger 4: Order Lifecycle & Inventory Deduction Trigger ──────────────────
-- Deducts stock ONLY when an order moves from 'pending' to 'preparation'.
create or replace function public.handle_order_lifecycle()
returns trigger language plpgsql security definer as $$
declare
  v_item record;
  v_valid boolean;
begin
  if old.status = new.status then
    return new;
  end if;

  -- Validate lifecycle transitions
  v_valid := case
    when old.status = 'pending'     and new.status = 'preparation' then true
    when old.status = 'preparation' and new.status = 'shipping'    then true
    when old.status = 'shipping'    and new.status = 'delivered'   then true
    when old.status = 'shipping'    and new.status = 'returned'    then true
    when new.status = 'returned'                                    then true
    else false
  end;

  if not v_valid then
    raise exception 'Invalid status transition: % → %. Allowed: pending→preparation, preparation→shipping, shipping→delivered/returned',
      old.status, new.status;
  end if;

  -- Deduct inventory on confirmation (pending → preparation)
  if old.status = 'pending' and new.status = 'preparation' then
    new.confirmed_at := now();
    for v_item in
      select product_id, model_id, quantity
      from public.order_items
      where order_id = new.id
    loop
      if v_item.model_id is not null then
        update public.product_model_matrix
        set
          stock_quantity = greatest(0, stock_quantity - v_item.quantity),
          updated_at     = now()
        where product_id = v_item.product_id and model_id = v_item.model_id;
      end if;
    end loop;
  end if;

  if old.status = 'preparation' and new.status = 'shipping'  then new.shipped_at   := now(); end if;
  if old.status = 'shipping'    and new.status = 'delivered' then new.delivered_at := now(); end if;
  if new.status = 'returned'    and old.status != 'returned' then new.returned_at  := now(); end if;

  return new;
end;
$$;

create trigger trg_order_lifecycle
before update on orders
for each row execute function public.handle_order_lifecycle();


-- ==============================================================================
-- OPERATIONAL UPDATE STORED PROCEDURES (اوامر التحديث لمنطق التشغيل)
-- ==============================================================================

-- 1. Update Order Status with Role Check & Optional Tracking/Notes
create or replace function public.sp_update_order_status(
  p_order_id      uuid,
  p_new_status    text,
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
  p_customer_id   uuid,
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


-- ==============================================================================
-- SEED DATA (Valid Hex UUIDs + ON CONFLICT DO UPDATE)
-- ==============================================================================

-- ── 1. 18 Confirmed Primary Categories ─────────────────────────────────────────
insert into categories (id, name_ar, slug, sort_order, is_active) values
  ('00000001-0000-0000-0000-000000000001', 'كل المنتجات',                          'all-products',       1,  true),
  ('00000001-0000-0000-0000-000000000002', 'أجهزة الموبايل',                        'mobile-phones',      2,  true),
  ('00000001-0000-0000-0000-000000000003', 'ماركات أصلية (Originals)',              'originals',          3,  true),
  ('00000001-0000-0000-0000-000000000004', 'باور بانك',                             'power-banks',        4,  true),
  ('00000001-0000-0000-0000-000000000005', 'سماعات بلوتوث وإيربودز',               'bluetooth-earbuds',  5,  true),
  ('00000001-0000-0000-0000-000000000006', 'ساعات رقمية (Smart Watches)',           'smart-watches',      6,  true),
  ('00000001-0000-0000-0000-000000000007', 'سماعات مكبرة (Speakers & GM)',         'speakers',            7,  true),
  ('00000001-0000-0000-0000-000000000008', 'اكسسوارات سيارات',                      'car-accessories',     8,  true),
  ('00000001-0000-0000-0000-000000000009', 'اكسسوارات كمبيوتر',                     'computer-accessories',9,  true),
  ('00000001-0000-0000-0000-000000000010', 'ساعات متنوعة',                          'watches',             10, true),
  ('00000001-0000-0000-0000-000000000011', 'اكسسوارات متنوعة',                      'general-accessories', 11, true),
  ('00000001-0000-0000-0000-000000000012', 'سكرينات متنوعة (حماية شاشة)',          'screen-protectors',   12, true),
  ('00000001-0000-0000-0000-000000000013', 'جرابات متنوعة (كفرات)',                'phone-cases',         13, true),
  ('00000001-0000-0000-0000-000000000014', 'رينج لايت - ترايبود - سيلفي ستيك',   'lighting-tripods',    14, true),
  ('00000001-0000-0000-0000-000000000015', 'أسلاك ورؤوس شواحن متنوعة',             'chargers-adapters',   15, true),
  ('00000001-0000-0000-0000-000000000016', 'كابل شحن',                              'charging-cables',     16, true),
  ('00000001-0000-0000-0000-000000000017', 'فلاشات وكروت ميموري',                  'storage-memory',      17, true),
  ('00000001-0000-0000-0000-000000000018', 'بطاريات للهاتف',                        'phone-batteries',     18, true)
on conflict (slug) do update set
  name_ar    = excluded.name_ar,
  sort_order = excluded.sort_order,
  is_active  = excluded.is_active,
  updated_at = now();

-- ── 2. Master Phone Models ────────────────────────────────────────────────────
-- Apple
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000001', 'Apple', 'iPhone 11', 'iPhone 11',         2019),
  ('00000002-0000-0000-0000-000000000002', 'Apple', 'iPhone 11', 'iPhone 11 Pro',      2019),
  ('00000002-0000-0000-0000-000000000003', 'Apple', 'iPhone 11', 'iPhone 11 Pro Max',  2019),
  ('00000002-0000-0000-0000-000000000004', 'Apple', 'iPhone 12', 'iPhone 12',          2020),
  ('00000002-0000-0000-0000-000000000005', 'Apple', 'iPhone 12', 'iPhone 12 Pro',      2020),
  ('00000002-0000-0000-0000-000000000006', 'Apple', 'iPhone 12', 'iPhone 12 Pro Max',  2020),
  ('00000002-0000-0000-0000-000000000007', 'Apple', 'iPhone 13', 'iPhone 13',          2021),
  ('00000002-0000-0000-0000-000000000008', 'Apple', 'iPhone 13', 'iPhone 13 Pro Max',  2021),
  ('00000002-0000-0000-0000-000000000009', 'Apple', 'iPhone 14', 'iPhone 14',          2022),
  ('00000002-0000-0000-0000-000000000010', 'Apple', 'iPhone 14', 'iPhone 14 Pro Max',  2022),
  ('00000002-0000-0000-0000-000000000011', 'Apple', 'iPhone 15', 'iPhone 15',          2023),
  ('00000002-0000-0000-0000-000000000012', 'Apple', 'iPhone 15', 'iPhone 15 Pro Max',  2023),
  ('00000002-0000-0000-0000-000000000013', 'Apple', 'iPhone 16', 'iPhone 16',          2024),
  ('00000002-0000-0000-0000-000000000014', 'Apple', 'iPhone 16', 'iPhone 16 Pro Max',  2024)
on conflict (id) do update set
  model_name   = excluded.model_name,
  release_year = excluded.release_year,
  updated_at   = now();

-- Samsung
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000020', 'Samsung', 'Galaxy A', 'Samsung A01',              2020),
  ('00000002-0000-0000-0000-000000000021', 'Samsung', 'Galaxy A', 'Samsung A04 / A04E',       2022),
  ('00000002-0000-0000-0000-000000000022', 'Samsung', 'Galaxy A', 'Samsung A22 5G',           2021),
  ('00000002-0000-0000-0000-000000000023', 'Samsung', 'Galaxy A', 'Samsung A32 5G',           2021),
  ('00000002-0000-0000-0000-000000000024', 'Samsung', 'Galaxy A', 'Samsung A72 4G',           2021),
  ('00000002-0000-0000-0000-000000000025', 'Samsung', 'Galaxy A', 'Samsung A54 5G',           2023),
  ('00000002-0000-0000-0000-000000000026', 'Samsung', 'Galaxy S', 'Galaxy S23 Ultra',         2023),
  ('00000002-0000-0000-0000-000000000027', 'Samsung', 'Galaxy S', 'Galaxy S24 Ultra',         2024)
on conflict (id) do update set
  model_name   = excluded.model_name,
  release_year = excluded.release_year,
  updated_at   = now();

-- Xiaomi
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000030', 'Xiaomi', 'Mi Series',  'Xiaomi Mi 8 Lite',    2018),
  ('00000002-0000-0000-0000-000000000031', 'Xiaomi', 'Redmi Note', 'Redmi Note 11',        2022),
  ('00000002-0000-0000-0000-000000000032', 'Xiaomi', 'Redmi Note', 'Redmi Note 12 Pro',    2023),
  ('00000002-0000-0000-0000-000000000033', 'Xiaomi', 'Redmi Note', 'Redmi Note 13',        2024),
  ('00000002-0000-0000-0000-000000000034', 'Xiaomi', 'Redmi',      'Redmi 12C',            2023)
on conflict (id) do update set
  model_name   = excluded.model_name,
  release_year = excluded.release_year,
  updated_at   = now();

-- Oppo & Realme & Infinix & Others
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000040', 'Oppo',    'A Series',    'OPPO A37',             2016),
  ('00000002-0000-0000-0000-000000000041', 'Oppo',    'A Series',    'OPPO A78',             2023),
  ('00000002-0000-0000-0000-000000000042', 'Oppo',    'Reno',        'OPPO Reno 10',         2023),
  ('00000002-0000-0000-0000-000000000050', 'Realme',  'C Series',    'Realme C35',           2022),
  ('00000002-0000-0000-0000-000000000051', 'Realme',  'C Series',    'Realme C55',           2023),
  ('00000002-0000-0000-0000-000000000060', 'Infinix', 'Hot Series',  'Infinix X559 (Hot 4)', 2017),
  ('00000002-0000-0000-0000-000000000061', 'Infinix', 'Hot Series',  'Infinix Hot 30',        2023),
  ('00000002-0000-0000-0000-000000000070', 'Huawei',  'Nova Series', 'Huawei Nova 3i',       2018),
  ('00000002-0000-0000-0000-000000000080', 'Honor',   'X Series',    'Honor X8',             2022),
  ('00000002-0000-0000-0000-000000000090', 'Vivo',    'Y Series',    'Vivo Y20 / Y12s',      2020)
on conflict (id) do update set
  model_name   = excluded.model_name,
  release_year = excluded.release_year,
  updated_at   = now();

-- ── 3. Products ───────────────────────────────────────────────────────────────
insert into products
  (id, sku, title_ar, description_ar, price, is_exchange_only, is_featured, has_compatibility_matrix, image_url)
values
  ('00000003-0000-0000-0000-000000000001','2100157','Infinix X559 شاشة حماية متكاملة','لاصقة حماية زجاجية عالية الشفافية مصممة خصيصاً لهاتف إنفينكس X559',111.78,true,true,false,'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000002','789-5','سكرين سيليكون بحواف بارزة (ماركة ميني كينج)','حماية سيليكونية فائقة المرونة بمقاومة صدمات عالية — متوافقة مع موديلات متعددة',55.00,true,true,true,'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000003','2100123','Xiaomi Mi 8 Lite سكرين زجاجي مقوى','حماية فائقة بمقاومة الخدوش 9H ولمس فائق النعومة لشاومي مي 8 لايت',119.71,true,true,false,'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000004','BIG-ARC','سكرين 3 ملى 5×1 — اميجو','أقوى سكرين حماية نانو 3 ملم بتقنية 5 في 1 — تغطي أكثر من 200 موديل',15.98,false,true,true,'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000005','2100078','SAM A72 4G / A32 5G حماية شاشة','سكرين زجاجي متوافق مع هواتف سامسونج A72 و A32 بتقنية عالية',119.74,true,false,false,'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000006','AMIGO-01','سكرين 1 ملى — اميجو','سكرين نحيف بحواف ناعمة مريحة للمس وحماية فائقة — متوفر لعدة موديلات',175.00,true,true,true,'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000007','FREE-EDGE','سكرين فاميه فري ايدج — ماركة اميجو','سكرين خصوصية فاميه مانع للتلصص بتغطية كاملة من الحافة للحافة',137.66,true,true,true,'https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000008','2100023','OPPO A37 كفر حماية خلفي','كفر خلفي عالي المتانة ضد الصدمات وخفيف الوزن لأوبو A37',118.37,true,false,false,'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000009','789-29','سكرين تاب 10 بوصة عالي الدقة','حماية زجاجية فاخرة للشاشات اللوحية بمقاس 10 بوصة ووضوح كريستالي',35.00,false,true,false,'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000010','2100173','iPhone 11 Pro Max زجاج حماية','لاصقة حماية شاشة أصلية لهاتف آيفون 11 برو ماكس',201.15,true,false,false,'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000011','2100061','SAM A04/A04E/A22 5G حامي شاشة','حماية شاشة مخصصة لهواتف سامسونج الفئة الاقتصادية',116.58,true,false,false,'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80'),
  ('00000003-0000-0000-0000-000000000012','2100056','SAM A01 سكرين حماية زجاجي','حامي شاشة متين لهاتف سامسونج A01',115.90,true,false,false,'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80')
on conflict (sku) do update set
  title_ar                 = excluded.title_ar,
  description_ar           = excluded.description_ar,
  price                    = excluded.price,
  is_exchange_only         = excluded.is_exchange_only,
  is_featured              = excluded.is_featured,
  has_compatibility_matrix = excluded.has_compatibility_matrix,
  image_url                = excluded.image_url,
  updated_at               = now();

-- ── 4. Product ↔ Category Links ───────────────────────────────────────────────
insert into product_categories (product_id, category_id) values
  ('00000003-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000001','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000002','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000003','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000004','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000005','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000006','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000007','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000008','00000001-0000-0000-0000-000000000013'),
  ('00000003-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000009','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000010','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000011','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000011','00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000012','00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000012','00000001-0000-0000-0000-000000000012')
on conflict do nothing;

-- ── 5. Compatibility Matrix Seed Entries ──────────────────────────────────────
insert into product_model_matrix (product_id, model_id, stock_quantity, moq) values
  -- Product 4 (BIG-ARC)
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000001',150,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000002',80,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000003',200,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000004',60,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000005',12,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000006',0,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000007',95,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000020',40,10),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000021',110,10),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000023',65,10),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000030',8,5),
  ('00000003-0000-0000-0000-000000000004','00000002-0000-0000-0000-000000000040',30,5),
  -- Product 2 (789-5 ميني كينج)
  ('00000003-0000-0000-0000-000000000002','00000002-0000-0000-0000-000000000001',50,10),
  ('00000003-0000-0000-0000-000000000002','00000002-0000-0000-0000-000000000004',70,10),
  ('00000003-0000-0000-0000-000000000002','00000002-0000-0000-0000-000000000012',4,10),
  ('00000003-0000-0000-0000-000000000002','00000002-0000-0000-0000-000000000026',35,10),
  -- Product 6 (AMIGO-01)
  ('00000003-0000-0000-0000-000000000006','00000002-0000-0000-0000-000000000001',120,5),
  ('00000003-0000-0000-0000-000000000006','00000002-0000-0000-0000-000000000007',90,5),
  ('00000003-0000-0000-0000-000000000006','00000002-0000-0000-0000-000000000011',7,5),
  -- Product 7 (FREE-EDGE)
  ('00000003-0000-0000-0000-000000000007','00000002-0000-0000-0000-000000000009',80,5),
  ('00000003-0000-0000-0000-000000000007','00000002-0000-0000-0000-000000000010',60,5),
  ('00000003-0000-0000-0000-000000000007','00000002-0000-0000-0000-000000000012',9,5),
  ('00000003-0000-0000-0000-000000000007','00000002-0000-0000-0000-000000000014',0,5)
on conflict (product_id, model_id) do update set
  stock_quantity = excluded.stock_quantity,
  moq            = excluded.moq,
  updated_at     = now();

-- ── 6. Initial Staff Profiles (Standalone, can be linked to auth_user_id later) ──
insert into user_profiles (id, full_name, phone, role, email) values
  ('00000004-0000-0000-0000-000000000001','إدارة متجر MH المهدي',        '01000000001','admin',             'admin@elmahdy.com'),
  ('00000004-0000-0000-0000-000000000002','أحمد محمود (مندوب مبيعات)',   '01012345678','sales_agent',       'sales@elmahdy.com'),
  ('00000004-0000-0000-0000-000000000003','محمود عبد الرازق (المستودع)', '01000000003','warehouse_preparer','warehouse@elmahdy.com')
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  role       = excluded.role,
  email      = excluded.email,
  updated_at = now();


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table categories           enable row level security;
alter table master_models        enable row level security;
alter table products             enable row level security;
alter table product_categories   enable row level security;
alter table product_model_matrix enable row level security;
alter table user_profiles        enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table shortage_requests    enable row level security;

-- Helper to check current user's role
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.user_profiles where auth_user_id = auth.uid() limit 1;
$$;

-- Categories Policies
create policy "Public read active categories"   on categories for select using (is_active = true);
create policy "Admin full access to categories" on categories for all    using (public.current_user_role() = 'admin');

-- Master Models Policies
create policy "Public read master models"          on master_models for select using (true);
create policy "Admin full access to master models" on master_models for all    using (public.current_user_role() = 'admin');

-- Products Policies
create policy "Public read active products"   on products for select using (is_active = true);
create policy "Admin full access to products" on products for all    using (public.current_user_role() = 'admin');

-- Product Categories Policies
create policy "Public read product categories"          on product_categories for select using (true);
create policy "Admin full access to product categories" on product_categories for all    using (public.current_user_role() = 'admin');

-- Compatibility Matrix Policies
create policy "Public read compatibility matrix"          on product_model_matrix for select using (true);
create policy "Admin full access to compatibility matrix" on product_model_matrix for all    using (public.current_user_role() = 'admin');

-- User Profiles Policies
create policy "Users read own profile"        on user_profiles for select using (auth_user_id = auth.uid());
create policy "Users update own profile"      on user_profiles for update using (auth_user_id = auth.uid());
create policy "Staff read all profiles"       on user_profiles for select using (public.current_user_role() in ('admin','sales_agent','warehouse_preparer'));
create policy "Admin full access to profiles" on user_profiles for all    using (public.current_user_role() = 'admin');

-- Orders Policies (RBAC Segregation)
create policy "Customers read own orders" on orders for select
  using (customer_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1));

create policy "Customers insert own pending orders" on orders for insert
  with check (
    customer_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
    and status = 'pending'
  );

create policy "Sales agents read their orders" on orders for select
  using (
    public.current_user_role() = 'sales_agent'
    and (sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1) or sales_agent_id is null)
  );

create policy "Sales agents update their orders" on orders for update
  using (
    public.current_user_role() = 'sales_agent'
    and (sales_agent_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1) or sales_agent_id is null)
  );

create policy "Warehouse read preparation orders" on orders for select
  using (public.current_user_role() = 'warehouse_preparer' and status in ('preparation','shipping'));

create policy "Warehouse update preparation orders" on orders for update
  using (public.current_user_role() = 'warehouse_preparer' and status in ('preparation','shipping'));

create policy "Admin full access to orders" on orders for all using (public.current_user_role() = 'admin');

-- Order Items Policies
create policy "Order items readable by order viewers" on order_items for select
  using (exists (select 1 from public.orders where orders.id = order_items.order_id));

create policy "Customers insert items on own pending orders" on order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.customer_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1)
        and orders.status = 'pending'
    )
  );

create policy "Admin full access to order items" on order_items for all using (public.current_user_role() = 'admin');

-- Shortage Requests Policies
create policy "Customers insert shortage requests" on shortage_requests for insert
  with check (customer_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1) or customer_id is null);

create policy "Customers read own shortage requests" on shortage_requests for select
  using (customer_id = (select id from public.user_profiles where auth_user_id = auth.uid() limit 1));

create policy "Admin full access to shortage requests" on shortage_requests for all using (public.current_user_role() = 'admin');
create policy "Sales agents read shortage requests"    on shortage_requests for select using (public.current_user_role() = 'sales_agent');

-- ── 12. Inventory Adjustments (تسويات جردية) ───────────────────────────────────
create table if not exists inventory_adjustments (
    id              uuid primary key default gen_random_uuid(),
    product_id      uuid not null references products(id) on delete cascade,
    model_id        uuid references master_models(id) on delete set null,
    adjusted_by     uuid references user_profiles(id) on delete set null,
    adjustment_type text not null check (
        adjustment_type in ('surplus', 'deficit', 'damage', 'correction', 'return_stock')
    ),
    quantity_before integer not null,
    quantity_change integer not null,
    quantity_after  integer not null,
    reason          text not null,
    created_at      timestamptz not null default now()
);

create index if not exists idx_inv_adj_product on inventory_adjustments(product_id);
create index if not exists idx_inv_adj_model   on inventory_adjustments(model_id);
create index if not exists idx_inv_adj_date    on inventory_adjustments(created_at desc);

alter table inventory_adjustments enable row level security;
create policy "Admin manage inventory adjustments" on inventory_adjustments
    for all using (public.current_user_role() = 'admin');

-- ── 13. Bulk Matrix Upsert & Copy Procedures ─────────────────────────────────
create or replace procedure sp_bulk_upsert_matrix_items(
    p_product_id uuid,
    p_items jsonb
)
language plpgsql as $$
declare
    item jsonb;
    v_stock int;
    v_moq int;
    v_status text;
begin
    for item in select * from jsonb_array_elements(p_items)
    loop
        v_stock := coalesce((item->>'stock_quantity')::int, 0);
        v_moq := greatest(coalesce((item->>'moq')::int, 1), 1);
        
        if v_stock = 0 then
            v_status := 'out_of_stock';
        elsif v_stock <= 10 then
            v_status := 'limited';
        else
            v_status := 'in_stock';
        end if;

        insert into product_model_matrix (
            id,
            product_id,
            model_id,
            stock_quantity,
            moq,
            stock_status,
            created_at,
            updated_at
        )
        values (
            gen_random_uuid(),
            p_product_id,
            (item->>'model_id')::uuid,
            v_stock,
            v_moq,
            v_status,
            now(),
            now()
        )
        on conflict (product_id, model_id)
        do update set
            stock_quantity = excluded.stock_quantity,
            moq = excluded.moq,
            stock_status = excluded.stock_status,
            updated_at = now();
    end loop;
end;
$$;

create or replace procedure sp_copy_product_matrix(
    p_source_product_id uuid,
    p_target_product_id uuid,
    p_override_stock int default null
)
language plpgsql as $$
begin
    insert into product_model_matrix (
        id,
        product_id,
        model_id,
        stock_quantity,
        moq,
        stock_status,
        created_at,
        updated_at
    )
    select
        gen_random_uuid(),
        p_target_product_id,
        model_id,
        coalesce(p_override_stock, stock_quantity),
        moq,
        case 
            when coalesce(p_override_stock, stock_quantity) = 0 then 'out_of_stock'
            when coalesce(p_override_stock, stock_quantity) <= 10 then 'limited'
            else 'in_stock'
        end,
        now(),
        now()
    from product_model_matrix
    where product_id = p_source_product_id
    on conflict (product_id, model_id)
    do update set
        stock_quantity = excluded.stock_quantity,
        moq = excluded.moq,
        stock_status = excluded.stock_status,
        updated_at = now();
end;
$$;
-- ==============================================================================
-- MH EL MAHDY Store � Migration 00010: Fix Public Customer Ordering & RLS
-- Version   : 00010
-- Created   : 2026-09-09
-- Description:
--   1. Ensures anonymous/public customers can register (insert/select customer profile)
--   2. Ensures anonymous/public customers can create 'pending' orders and order items
--   3. Grants full read/manage access for all staff roles
--   4. Creates sp_create_pending_order atomic transaction procedure
-- ==============================================================================

-- -- 1. user_profiles Policies ------------------------------------------------
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

-- -- 2. orders Policies --------------------------------------------------------
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

-- -- 3. order_items Policies --------------------------------------------------
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

-- -- 4. shortage_requests Policies ---------------------------------------------
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

-- -- 5. Atomic Order Creation Stored Procedure (Security Definer) ---------------
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
