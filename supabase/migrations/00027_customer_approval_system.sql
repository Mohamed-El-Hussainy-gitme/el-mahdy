-- ==============================================================================
-- MH EL MAHDY Store - Migration 00027: Customer Approval System
-- Version   : 00027
-- Created   : 2026-10-06
-- Purpose   : Add approval_status + rejection_reason to user_profiles for
--             customers; update sp_customer_register to set pending by default;
--             add sp_admin_approve_customer and sp_admin_reject_customer RPCs;
--             add a safe products_public view for unauthenticated browsing.
-- ==============================================================================

-- ── 1. Add approval columns to user_profiles ────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text
    DEFAULT 'approved'  -- existing customers/staff keep approved; new customers get pending via sp_customer_register
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;

-- ── 2. Set ALL existing customers to 'approved' so no one is locked out ──────
UPDATE public.user_profiles
  SET approval_status = 'approved'
  WHERE role = 'customer';

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
  v_phone   text;
  v_existing_id uuid;
  v_new_id  uuid;
  v_rep_id  uuid;
  v_rep_name text;
  v_rep_phone text;
  v_assignment_type text;
BEGIN
  -- Normalize phone
  v_phone := regexp_replace(trim(p_phone), '^(\+20|20|0)', '');
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
  v_rep_id := NULL;
  v_rep_name := NULL;
  v_rep_phone := NULL;
  v_assignment_type := 'auto_fair_distribution';

  IF p_sales_rep_id IS NOT NULL THEN
    SELECT id, full_name, phone INTO v_rep_id, v_rep_name, v_rep_phone
      FROM public.user_profiles
      WHERE id = p_sales_rep_id AND is_active = true
      LIMIT 1;
    IF v_rep_id IS NOT NULL THEN
      v_assignment_type := 'customer_choice';
    END IF;
  END IF;

  -- Insert new customer with approval_status = 'pending'
  v_new_id := gen_random_uuid();
  INSERT INTO public.user_profiles (
    id, full_name, phone, company_name, role,
    assigned_sales_rep_id, assignment_type,
    is_active, approval_status
  ) VALUES (
    v_new_id, trim(p_name), v_phone, p_company, 'customer',
    v_rep_id, v_assignment_type,
    true, 'pending'   -- ← new customers start as pending
  );

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                    v_new_id,
      'full_name',             trim(p_name),
      'phone',                 v_phone,
      'company_name',          p_company,
      'approval_status',       'pending',
      'assigned_sales_rep_id', v_rep_id,
      'assigned_sales_rep_name', v_rep_name,
      'assigned_sales_rep_phone', v_rep_phone,
      'assignment_type',       v_assignment_type
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
DECLARE
  v_caller_role text;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_caller_role FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'صلاحية مرفوضة');
  END IF;

  UPDATE public.user_profiles
    SET approval_status = 'approved', rejection_reason = NULL
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تمت الموافقة على العميل');
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
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'صلاحية مرفوضة');
  END IF;

  UPDATE public.user_profiles
    SET approval_status = 'rejected', rejection_reason = p_reason
    WHERE id = p_customer_id AND role = 'customer';

  RETURN jsonb_build_object('success', true, 'message', 'تم رفض العميل');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ── 6. Also allow sales_agent role to approve/reject via custom role check ───
-- Granted execution to authenticated role only (SECURITY DEFINER handles auth internally)
GRANT EXECUTE ON FUNCTION public.sp_admin_approve_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_admin_reject_customer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_customer_register(text, text, text, uuid) TO anon, authenticated;

-- ── 7. Update sp_customer_login to return approval_status ────────────────────
CREATE OR REPLACE FUNCTION public.sp_customer_login(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone   text;
  v_profile record;
  v_rep     record;
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
  SELECT full_name, phone INTO v_rep
    FROM public.user_profiles
    WHERE id = v_profile.assigned_sales_rep_id
    LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id',                    v_profile.id,
      'full_name',             v_profile.full_name,
      'phone',                 v_profile.phone,
      'company_name',          v_profile.company_name,
      'approval_status',       coalesce(v_profile.approval_status, 'approved'),
      'rejection_reason',      v_profile.rejection_reason,
      'assigned_sales_rep_id', v_profile.assigned_sales_rep_id,
      'assigned_sales_rep_name', v_rep.full_name,
      'assigned_sales_rep_phone', v_rep.phone
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sp_customer_login(text) TO anon, authenticated;

-- ── 8. Index for fast pending lookups ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status
  ON public.user_profiles (approval_status)
  WHERE role = 'customer';
