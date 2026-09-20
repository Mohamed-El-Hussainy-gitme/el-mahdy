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