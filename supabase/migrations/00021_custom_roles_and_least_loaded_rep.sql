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
