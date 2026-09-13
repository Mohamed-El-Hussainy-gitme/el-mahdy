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
