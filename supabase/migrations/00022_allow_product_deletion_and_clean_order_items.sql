-- ==============================================================================
-- MH EL MAHDY Store — Migration 00022: Allow Safe Product & Category Deletions
-- Version   : 00022
-- Created   : 2026-09-16
-- Description:
--   1. Preserve order history when products are deleted:
--      - Add product_title and product_sku to order_items to preserve historical records.
--      - Drop NOT NULL on order_items.product_id.
--      - Alter order_items_product_id_fkey to ON DELETE SET NULL.
--   2. Ensure custom roles with can_manage_products / can_manage_categories
--      can perform CRUD/deletions on products & categories via RLS.
-- ==============================================================================

-- 1. Add product snapshot columns to order_items to preserve financial history
ALTER TABLE IF EXISTS public.order_items 
  ADD COLUMN IF NOT EXISTS product_title text,
  ADD COLUMN IF NOT EXISTS product_sku text;

-- 2. Backfill existing order_items with product title and SKU from products table
UPDATE public.order_items oi
SET 
  product_title = COALESCE(oi.product_title, p.title_ar, 'منتج محذوف'),
  product_sku   = COALESCE(oi.product_sku, p.sku, '')
FROM public.products p
WHERE oi.product_id = p.id;

-- 3. Make order_items.product_id NULLABLE so deleting a product does NOT violate foreign key
ALTER TABLE IF EXISTS public.order_items 
  ALTER COLUMN product_id DROP NOT NULL;

-- 4. Update foreign key constraint on order_items to ON DELETE SET NULL
ALTER TABLE IF EXISTS public.order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE IF EXISTS public.order_items 
  ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.products(id) 
  ON DELETE SET NULL;

-- 5. Ensure product_categories has ON DELETE CASCADE on both sides
ALTER TABLE IF EXISTS public.product_categories 
  DROP CONSTRAINT IF EXISTS product_categories_product_id_fkey,
  DROP CONSTRAINT IF EXISTS product_categories_category_id_fkey;

ALTER TABLE IF EXISTS public.product_categories 
  ADD CONSTRAINT product_categories_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  ADD CONSTRAINT product_categories_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- 6. Ensure product_model_matrix has ON DELETE CASCADE on product_id
ALTER TABLE IF EXISTS public.product_model_matrix 
  DROP CONSTRAINT IF EXISTS product_model_matrix_product_id_fkey;

ALTER TABLE IF EXISTS public.product_model_matrix 
  ADD CONSTRAINT product_model_matrix_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 7. Update RLS on products to allow Custom Roles with can_manage_products permission
DROP POLICY IF EXISTS "Admin and Managers full access to products" ON public.products;
DROP POLICY IF EXISTS "Admin full access to products" ON public.products;

CREATE POLICY "Admin and Managers full access to products"
  ON public.products FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 
      FROM public.user_profiles up
      JOIN public.custom_roles cr ON up.custom_role_id = cr.id
      WHERE up.auth_user_id = auth.uid()
        AND up.is_active = true
        AND cr.can_manage_products = true
    )
  );

-- 8. Update RLS on categories to allow Custom Roles with can_manage_categories permission
DROP POLICY IF EXISTS "Admin and Managers full access to categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories" ON public.categories;

CREATE POLICY "Admin and Managers full access to categories"
  ON public.categories FOR ALL
  USING (
    public.current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 
      FROM public.user_profiles up
      JOIN public.custom_roles cr ON up.custom_role_id = cr.id
      WHERE up.auth_user_id = auth.uid()
        AND up.is_active = true
        AND cr.can_manage_categories = true
    )
  );
