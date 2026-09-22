-- ==============================================================================
-- MH EL MAHDY Store - Migration 00026: Full Custom Roles Catalog & Category RLS
-- Version   : 00026
-- Created   : 2026-09-22
-- Purpose   : Extend RLS on products, product_categories, categories, and
--             store_settings so custom roles with the right permissions can
--             INSERT / UPDATE / DELETE in addition to SELECT.
-- ==============================================================================

-- ── 1. products ─────────────────────────────────────────────────────────────
-- Replace existing policy (already created in 00022) to use the helper function
-- current_user_custom_role_permission for cleaner / consistent lookups.
DROP POLICY IF EXISTS "Admin and Managers full access to products" ON public.products;
DROP POLICY IF EXISTS "Admin full access to products"             ON public.products;

CREATE POLICY "Admin and Managers full access to products"
  ON public.products FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
  );

-- ── 2. product_categories ───────────────────────────────────────────────────
-- Junction table — custom roles with can_manage_products or can_manage_categories
-- must be able to link/unlink products ↔ categories.
DROP POLICY IF EXISTS "Admin and Managers full access to product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin full access to product categories"              ON public.product_categories;

CREATE POLICY "Admin and Managers full access to product categories"
  ON public.product_categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
    OR public.current_user_custom_role_permission('can_manage_categories')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_products')
    OR public.current_user_custom_role_permission('can_manage_categories')
  );

-- ── 3. categories ────────────────────────────────────────────────────────────
-- Replace the policy created in 00022 to use the helper function.
DROP POLICY IF EXISTS "Admin and Managers full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories"             ON public.categories;

CREATE POLICY "Admin and Managers full access to categories"
  ON public.categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_categories')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_categories')
  );

-- ── 4. store_settings ────────────────────────────────────────────────────────
-- Only admins and custom roles with can_manage_settings may UPDATE / INSERT.
DROP POLICY IF EXISTS "Staff can update store settings"             ON public.store_settings;
DROP POLICY IF EXISTS "Admin and Settings Managers full access"     ON public.store_settings;

-- Keep the existing public SELECT open (from 00016).
-- Add a stricter UPDATE/INSERT/DELETE policy for settings managers.
CREATE POLICY "Admin and Settings Managers full access"
  ON public.store_settings FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_settings')
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR public.current_user_custom_role_permission('can_manage_settings')
  );
