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
