-- ============================================================
-- FIX: Clear corrupt auth rows and fix GoTrue NULL check
-- Run this in Supabase Dashboard -> SQL Editor (أيقونة >_ في القائمة اليسرى)
-- ============================================================

-- 1. Remove manually inserted rows that are missing internal GoTrue fields
DELETE FROM auth.identities WHERE identity_data->>'email' IN ('admin@elmahdy.com', 'sales@elmahdy.com', 'warehouse@elmahdy.com');
DELETE FROM auth.users WHERE email IN ('admin@elmahdy.com', 'sales@elmahdy.com', 'warehouse@elmahdy.com');

-- 2. Fix NULL columns in any other existing rows in auth.users (Supabase GoTrue requires empty string instead of NULL)
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change = COALESCE(email_change, ''),
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb);

-- 3. Reset auth_user_id in user_profiles to be cleanly linked upon login
UPDATE public.user_profiles
SET auth_user_id = NULL
WHERE email IN ('admin@elmahdy.com', 'sales@elmahdy.com', 'warehouse@elmahdy.com');

SELECT 'تم تنظيف قاعدة البيانات بنجاح، يمكنك الآن الضغط على Create user' AS status;
