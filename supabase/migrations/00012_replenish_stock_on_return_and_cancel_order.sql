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
