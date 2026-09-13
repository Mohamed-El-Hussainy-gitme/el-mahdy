-- ============================================================
-- Migration: 00009_seed_staff_auth_users.sql
-- Seed initial staff accounts into auth.users and link them
-- to user_profiles via auth_user_id.
--
-- IMPORTANT: Run this in the Supabase SQL Editor (Dashboard)
-- under your project. The supabase_admin role is required
-- to insert into auth.users.
-- ============================================================

-- Step 1: Create staff users in auth.users (if they don't exist)
-- Passwords are hashed — change these before production!
-- Default passwords: admin -> Admin@elmahdy2024, sales -> Sales@elmahdy2024, warehouse -> Ware@elmahdy2024

DO $$
DECLARE
  v_admin_auth_id   uuid;
  v_sales_auth_id   uuid;
  v_ware_auth_id    uuid;
BEGIN

  -- ---- Admin User ----
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@elmahdy.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@elmahdy.com',
      crypt('Admin@elmahdy2024', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"إدارة متجر MH المهدي","role":"admin"}'::jsonb,
      false, ''
    )
    RETURNING id INTO v_admin_auth_id;
  ELSE
    SELECT id INTO v_admin_auth_id FROM auth.users WHERE email = 'admin@elmahdy.com';
  END IF;

  -- Link admin auth_user_id in user_profiles
  UPDATE user_profiles
  SET auth_user_id = v_admin_auth_id
  WHERE email = 'admin@elmahdy.com' AND (auth_user_id IS NULL OR auth_user_id != v_admin_auth_id);

  -- ---- Sales Agent User ----
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sales@elmahdy.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'sales@elmahdy.com',
      crypt('Sales@elmahdy2024', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"أحمد محمود (مندوب المبيعات)","role":"sales_agent"}'::jsonb,
      false, ''
    )
    RETURNING id INTO v_sales_auth_id;
  ELSE
    SELECT id INTO v_sales_auth_id FROM auth.users WHERE email = 'sales@elmahdy.com';
  END IF;

  UPDATE user_profiles
  SET auth_user_id = v_sales_auth_id
  WHERE email = 'sales@elmahdy.com' AND (auth_user_id IS NULL OR auth_user_id != v_sales_auth_id);

  -- ---- Warehouse User ----
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'warehouse@elmahdy.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'warehouse@elmahdy.com',
      crypt('Ware@elmahdy2024', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"محمود عبد الرازق (مسؤول المستودع)","role":"warehouse_preparer"}'::jsonb,
      false, ''
    )
    RETURNING id INTO v_ware_auth_id;
  ELSE
    SELECT id INTO v_ware_auth_id FROM auth.users WHERE email = 'warehouse@elmahdy.com';
  END IF;

  UPDATE user_profiles
  SET auth_user_id = v_ware_auth_id
  WHERE email = 'warehouse@elmahdy.com' AND (auth_user_id IS NULL OR auth_user_id != v_ware_auth_id);

  RAISE NOTICE 'Staff auth users seeded/linked successfully.';
  RAISE NOTICE 'Admin auth_id: %', v_admin_auth_id;
  RAISE NOTICE 'Sales auth_id: %', v_sales_auth_id;
  RAISE NOTICE 'Warehouse auth_id: %', v_ware_auth_id;

END $$;

-- Step 2: Verify the result
SELECT
  up.id,
  up.full_name,
  up.email,
  up.role,
  up.auth_user_id,
  CASE WHEN au.id IS NOT NULL THEN 'مرتبط' ELSE 'غير مرتبط' END AS auth_link_status
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.auth_user_id
WHERE up.role IN ('admin', 'sales_agent', 'warehouse_preparer')
ORDER BY up.created_at;
