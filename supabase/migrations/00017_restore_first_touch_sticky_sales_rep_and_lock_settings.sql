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
