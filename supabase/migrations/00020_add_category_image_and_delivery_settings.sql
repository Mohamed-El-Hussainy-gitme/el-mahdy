-- Migration 00019: Add category image_url and customizable delivery promises in store_settings
-- Adds image_url to categories table and delivery promises fields to store_settings

-- 1. Add image_url column to categories if not exists
ALTER TABLE IF EXISTS public.categories 
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add delivery promise columns to store_settings if not exists
ALTER TABLE IF EXISTS public.store_settings 
ADD COLUMN IF NOT EXISTS delivery_promise_1 text DEFAULT 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.',
ADD COLUMN IF NOT EXISTS delivery_promise_2 text DEFAULT 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.',
ADD COLUMN IF NOT EXISTS delivery_promise_3 text DEFAULT 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.';

-- Update any existing store_settings record with defaults if columns are null
UPDATE public.store_settings
SET 
  delivery_promise_1 = COALESCE(delivery_promise_1, 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.'),
  delivery_promise_2 = COALESCE(delivery_promise_2, 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.'),
  delivery_promise_3 = COALESCE(delivery_promise_3, 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.')
WHERE id IS NOT NULL;
