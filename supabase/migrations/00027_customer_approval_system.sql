-- ==============================================================================
-- MH EL MAHDY Store - Migration 00027: Customer Approval System
-- Version   : 00027
-- Created   : 2026-10-06
-- Purpose   : Add approval_status + rejection_reason to user_profiles for
--             customers; update sp_customer_register to set pending by default;
--             add sp_admin_approve_customer and sp_admin_reject_customer RPCs;
--             update sp_admin_get_customers to include approval status;
--             add a safe products_public view for unauthenticated browsing.
-- ==============================================================================

-- ── 1. Add approval and safety columns to user_profiles ───────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text
    DEFAULT 'approved'  -- existing customers/staff keep approved; new customers get pending via sp_customer_register
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'auto_fair_distribution';

-- ── 2. Set ALL existing customers to 'approved' so no one is locked out ──────
UPDATE public.user_profiles
  SET approval_status = 'approved'
  WHERE role = 'customer' AND (approval_status IS NULL OR approval_status = '');

-- ── 3. Update sp_customer_register to auto-set pending ───────────────────────
CREATE OR REPLACE FUNCTION public.sp_customer_register(
  p_name    text,
  p_phone   text,
  p_company text DEFAULT NULL,
  p_sales_rep_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone           text;
  v_clean_name      text;
  v_clean_company   text;
  v_existing_id     uuid;
  v_new_id          uuid;
  v_rep_id          uuid;
  v_rep_name        text;
  v_rep_phone       text;
  v_assignment_type text;
  v_notes           text;
BEGIN
  -- Normalize inputs
  v_clean_name    := trim(p_name);
  v_clean_company := nullif(trim(p_company), '');
  v_phone         := regexp_replace(trim(p_phone), '^(\+20|20|0)', '');

  IF char_length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير صالح');
  END IF;
  v_phone := '0' || v_phone;

  -- Check for duplicates
  SELECT id INTO v_existing_id
    FROM public.user_profiles
    WHERE phone = v_phone AND role = 'customer'
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول');
  END IF;

  -- Resolve sales rep
  v_rep_id          := NULL;
  v_rep_name        := NULL;
  v_rep_phone       := NULL;
  v_assignment_type := 'auto_fair_distribution';
  v_notes           := 'توزيع تلقائي عادل (المندوب الأقل تشغيلاً)';

  -- Case 1: Customer explicitly chose an active rep
  IF p_sales_rep_id IS NOT NULL THEN
    SELECT id, full_name, phone INTO v_rep_id, v_rep_name, v_rep_phone
      FROM public.user_profiles
      WHERE id = p_sales_rep_id AND is_active = true
      LIMIT 1;
    IF v_rep_id IS NOT NULL THEN
      v_assignment_type := 'customer_choice';
      v_notes           := 'طلب العميل هذا المندوب مباشرة عند التسجيل';
    END IF;
  END IF;

  -- Case 2: Automatic least-loaded distribution if none chosen
  IF v_rep_id IS NULL THEN
    BEGIN
      v_rep_id := public.fn_get_least_loaded_sales_rep();
    EXCEPTION WHEN OTHERS THEN
      v_rep_id := NULL;
    END;

    IF v_rep_id IS NOT NULL THEN
      SELECT full_name, phone INTO v_rep_name, v_rep_phone
        FROM public.user_profiles
        WHERE id = v_rep_id
        LIMIT 1;
    END IF;
  END IF;

  -- Insert new customer with approval_status = 'pending'
  v_new_id := gen_random_uuid();
  INSERT INTO public.user_profiles (
    id,
    full_name,
    phone,
    company_name,
    role,
    assigned_sales_rep_id,
    is_active,
    approval_status
  ) VALUES (
    v_new_id,
    v_clean_name,
    v_phone,
    v_clean_company,
    'customer',
    v_rep_id,
    true,
    'pending'
  );

  -- Log into sales_rep_assignments (Data Log table)
  BEGIN
    INSERT INTO public.sales_rep_assignments (
      customer_id,
      customer_name,
      customer_phone,
      customer_company,
      sales_rep_id,
      sales_rep_name,
      assignment_type,
      notes
    ) VALUES (
      v_new_id,
      v_clean_name,
      v_phone,
      v_clean_company,
      v_rep_id,
      v_rep_name,
      v_assignment_type,
      v_notes
    );
  EXCEPTION WHEN OTHERS THEN
    -- If sales_rep_assignments logging encounters any issue, registration still succeeds
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                       v_new_id,
      'full_name',                v_clean_name,
      'phone',                    v_phone,
      'company_name',             v_clean_company,
      'approval_status',          'pending',
      'assigned_sales_rep_id',    v_rep_id,
      'assigned_sales_rep_name',  v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone,
      'assignment_type',          v_assignment_type
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 4. Admin: approve customer ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sp_admin_approve_customer(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
    SET approval_status = 'approved',
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تمت الموافقة على العميل وتفعيل حسابه');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 5. Admin: reject customer ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sp_admin_reject_customer(
  p_customer_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
    SET approval_status = 'rejected',
        rejection_reason = p_reason,
        updated_at = now()
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تم رفض طلب العميل');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 6. Update sp_customer_login to return approval_status ────────────────────
CREATE OR REPLACE FUNCTION public.sp_customer_login(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone           text;
  v_profile         record;
  v_rep             record;
  v_assignment_type text;
BEGIN
  v_phone := regexp_replace(trim(p_phone), '^(\+20|20|0)', '');
  IF char_length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير صالح');
  END IF;
  v_phone := '0' || v_phone;

  SELECT * INTO v_profile
    FROM public.user_profiles
    WHERE phone = v_phone AND role = 'customer' AND is_active = true
    LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد');
  END IF;

  -- Fetch rep info if assigned
  IF v_profile.assigned_sales_rep_id IS NOT NULL THEN
    SELECT full_name, phone INTO v_rep
      FROM public.user_profiles
      WHERE id = v_profile.assigned_sales_rep_id
      LIMIT 1;
  END IF;

  -- Fetch latest assignment type
  BEGIN
    SELECT assignment_type INTO v_assignment_type
      FROM public.sales_rep_assignments
      WHERE customer_id = v_profile.id
      ORDER BY created_at DESC
      LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_assignment_type := 'auto_fair_distribution';
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                       v_profile.id,
      'full_name',                v_profile.full_name,
      'phone',                    v_profile.phone,
      'company_name',             v_profile.company_name,
      'approval_status',          coalesce(v_profile.approval_status, 'approved'),
      'rejection_reason',         v_profile.rejection_reason,
      'assigned_sales_rep_id',    v_profile.assigned_sales_rep_id,
      'assigned_sales_rep_name',  v_rep.full_name,
      'assigned_sales_rep_phone', v_rep.phone,
      'assignment_type',          coalesce(v_assignment_type, 'auto_fair_distribution')
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 7. Update sp_admin_get_customers to include approval status ──────────────
DROP FUNCTION IF EXISTS public.sp_admin_get_customers();

CREATE OR REPLACE FUNCTION public.sp_admin_get_customers()
RETURNS TABLE (
  id                      uuid,
  full_name               text,
  phone                   text,
  company_name            text,
  city                    text,
  address                 text,
  role                    text,
  is_active               boolean,
  approval_status         text,
  rejection_reason        text,
  assigned_sales_rep_id   uuid,
  assigned_sales_rep_name text,
  assigned_sales_rep_phone text,
  assignment_type         text,
  created_at              timestamptz,
  updated_at              timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $func$
  SELECT 
    c.id,
    c.full_name,
    c.phone,
    c.company_name,
    c.city,
    c.address,
    c.role,
    coalesce(c.is_active, true) as is_active,
    coalesce(c.approval_status, 'approved') as approval_status,
    c.rejection_reason,
    c.assigned_sales_rep_id,
    rep.full_name as assigned_sales_rep_name,
    rep.phone as assigned_sales_rep_phone,
    coalesce(latest_log.assignment_type, 'auto_fair_distribution') as assignment_type,
    c.created_at,
    c.updated_at
  FROM public.user_profiles c
  LEFT JOIN public.user_profiles rep ON c.assigned_sales_rep_id = rep.id
  LEFT JOIN LATERAL (
    SELECT assignment_type
    FROM public.sales_rep_assignments
    WHERE customer_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) latest_log ON true
  WHERE c.role = 'customer'
  ORDER BY c.created_at DESC;
$func$;

-- ── 8. Permissions ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sp_admin_approve_customer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_admin_reject_customer(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_customer_register(text, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_customer_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sp_admin_get_customers() TO anon, authenticated;

-- ── 9. Index for fast pending lookups ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status
  ON public.user_profiles (approval_status)
  WHERE role = 'customer';

-- ── 10. Public view for catalog browsing (no prices/costs/descriptions) ────────
CREATE OR REPLACE VIEW public.products_public AS
  SELECT 
    id,
    sku,
    title_ar,
    image_url,
    gallery_urls,
    is_featured,
    is_exchange_only,
    has_compatibility_matrix,
    is_active,
    created_at,
    updated_at
  FROM public.products
  WHERE is_active = true;

GRANT SELECT ON public.products_public TO anon, authenticated;
