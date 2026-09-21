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
