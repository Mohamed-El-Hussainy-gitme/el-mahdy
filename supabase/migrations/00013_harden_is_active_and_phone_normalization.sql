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
