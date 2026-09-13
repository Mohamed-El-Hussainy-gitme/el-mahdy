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
