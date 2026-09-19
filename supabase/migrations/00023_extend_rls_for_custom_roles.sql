-- ==============================================================================
-- MH EL MAHDY Store - Migration 00023: Extend RLS for All Custom Role Permissions
-- Version   : 00023
-- Created   : 2026-09-19
-- ==============================================================================

-- Helper function to check custom role permission
CREATE OR REPLACE FUNCTION public.current_user_custom_role_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $func$
DECLARE
  v_result boolean := false;
BEGIN
  SELECT
    CASE p_permission
      WHEN 'can_manage_products'   THEN cr.can_manage_products
      WHEN 'can_manage_categories' THEN cr.can_manage_categories
      WHEN 'can_manage_matrix'     THEN cr.can_manage_matrix
      WHEN 'can_manage_orders'     THEN cr.can_manage_orders
      WHEN 'can_receive_customers' THEN cr.can_receive_customers
      WHEN 'can_manage_customers'  THEN cr.can_manage_customers
      WHEN 'can_manage_shortages'  THEN cr.can_manage_shortages
      WHEN 'can_manage_settings'   THEN cr.can_manage_settings
      ELSE false
    END INTO v_result
  FROM public.user_profiles up
  JOIN public.custom_roles cr ON up.custom_role_id = cr.id
  WHERE up.auth_user_id = auth.uid()
    AND up.is_active = true
  LIMIT 1;
  RETURN coalesce(v_result, false);
END;
$func$;

-- 1. product_model_matrix
DROP POLICY IF EXISTS "Admin and Matrix Managers full access to matrix" ON public.product_model_matrix;
DROP POLICY IF EXISTS "Admin full access to compatibility matrix" ON public.product_model_matrix;
CREATE POLICY "Admin and Matrix Managers full access to matrix"
  ON public.product_model_matrix FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_matrix')
    OR public.current_user_role() = 'warehouse_preparer'
  );

-- 2. master_models
DROP POLICY IF EXISTS "Admin and Matrix Managers full access to master models" ON public.master_models;
DROP POLICY IF EXISTS "Admin full access to master models" ON public.master_models;
CREATE POLICY "Admin and Matrix Managers full access to master models"
  ON public.master_models FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_matrix')
    OR public.current_user_role() = 'warehouse_preparer'
  );

-- 3. shortage_requests
DROP POLICY IF EXISTS "Admin and Sales full access to shortage_requests" ON public.shortage_requests;
CREATE POLICY "Admin and Sales full access to shortage_requests"
  ON public.shortage_requests FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_role() = 'sales_agent'
    OR public.current_user_custom_role_permission('can_manage_shortages')
  );

-- 4. orders - custom roles view
DROP POLICY IF EXISTS "Custom roles can view orders" ON public.orders;
CREATE POLICY "Custom roles can view orders"
  ON public.orders FOR SELECT
  USING (
    public.current_user_custom_role_permission('can_manage_orders')
    OR (
      public.current_user_custom_role_permission('can_receive_customers')
      AND (sales_agent_id IS NULL OR sales_agent_id = (
        SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      ))
    )
  );

DROP POLICY IF EXISTS "Custom roles can update orders" ON public.orders;
CREATE POLICY "Custom roles can update orders"
  ON public.orders FOR UPDATE
  USING (
    public.current_user_custom_role_permission('can_manage_orders')
    OR public.current_user_custom_role_permission('can_receive_customers')
  );

-- 5. user_profiles - allow custom roles to view customers
DROP POLICY IF EXISTS "Managers can view customers" ON public.user_profiles;
CREATE POLICY "Managers can view customers"
  ON public.user_profiles FOR SELECT
  USING (
    public.current_user_custom_role_permission('can_manage_customers')
    OR public.current_user_custom_role_permission('can_receive_customers')
  );

DROP POLICY IF EXISTS "Managers can update customer assignments" ON public.user_profiles;
CREATE POLICY "Managers can update customer assignments"
  ON public.user_profiles FOR UPDATE
  USING (
    role = 'customer'
    AND (
      public.current_user_custom_role_permission('can_manage_customers')
      OR public.current_user_custom_role_permission('can_receive_customers')
      OR public.current_user_role() = 'admin'
      OR public.current_user_role() = 'sales_agent'
    )
  );

-- 6. Storage - product-images bucket
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload product images" ON storage.objects;
CREATE POLICY "Staff can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );

DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update product images" ON storage.objects;
CREATE POLICY "Staff can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );

DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete product images" ON storage.objects;
CREATE POLICY "Staff can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (
      public.current_user_role() = 'admin'
      OR public.current_user_custom_role_permission('can_manage_products')
      OR public.current_user_custom_role_permission('can_manage_categories')
    )
  );

