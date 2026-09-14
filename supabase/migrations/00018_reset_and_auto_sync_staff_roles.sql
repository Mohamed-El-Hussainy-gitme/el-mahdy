-- =============================================================================
-- Migration: 00018_reset_and_auto_sync_staff_roles.sql
-- تنظيف وإصلاح صلاحيات الأدمن والموظفين وربط Supabase Auth تلقائياً بـ user_profiles
-- قم بنسخ هذا الكود وتشغيله في Supabase Dashboard -> SQL Editor
-- =============================================================================

-- تفعيل ملحقات التشفير إن لم تكن مفعلة
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. دالة المزامنة التلقائية (Trigger Function):
-- تقوم بربط أي مستخدم يُنشأ في Supabase Auth بجدول user_profiles فوراً وتحديد دوره
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_staff_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_name text;
  v_phone text;
  v_existing_id uuid;
BEGIN
  -- تحديد الدور الوظيفي بدقة بناءً على البريد أو الميتاداتا
  IF LOWER(NEW.email) = 'admin@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') = 'admin' THEN
    v_role := 'admin';
  ELSIF LOWER(NEW.email) = 'sales@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') = 'sales_agent' THEN
    v_role := 'sales_agent';
  ELSIF LOWER(NEW.email) = 'warehouse@elmahdy.com' OR (NEW.raw_user_meta_data->>'role') IN ('warehouse', 'warehouse_preparer') THEN
    v_role := 'warehouse_preparer';
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  END IF;

  -- تحديد الاسم
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    CASE 
      WHEN v_role = 'admin' THEN 'إدارة متجر MH المهدي (مدير النظام)'
      WHEN v_role = 'sales_agent' THEN 'مندوب مبيعات معتمد'
      WHEN v_role = 'warehouse_preparer' THEN 'مسؤول المستودع والتجهيز'
      ELSE split_part(NEW.email, '@', 1)
    END
  );

  -- تحديد الهاتف
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    CASE 
      WHEN v_role = 'admin' THEN '01000000001'
      ELSE '01000000000'
    END
  );

  -- فحص إذا كان هناك حساب مسبق في user_profiles بنفس البريد أو الـ auth_user_id
  SELECT id INTO v_existing_id FROM public.user_profiles 
  WHERE LOWER(email) = LOWER(NEW.email) OR auth_user_id = NEW.id 
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET
      auth_user_id = NEW.id,
      email = LOWER(NEW.email),
      -- حماية دور الأدمن من التغيير لأي دور آخر
      role = CASE WHEN role = 'admin' OR v_role = 'admin' THEN 'admin' ELSE v_role END,
      full_name = CASE WHEN role = 'admin' AND full_name IS NOT NULL THEN full_name ELSE v_name END,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.user_profiles (
      id,
      auth_user_id,
      full_name,
      email,
      phone,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      CASE WHEN v_role = 'admin' THEN '00000004-0000-0000-0000-000000000001'::uuid ELSE gen_random_uuid() END,
      NEW.id,
      v_name,
      LOWER(NEW.email),
      v_phone,
      v_role,
      true,
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- تفعيل التريجر على جدول المستخدمين في Supabase Auth
DROP TRIGGER IF EXISTS trg_sync_staff_user ON auth.users;
CREATE TRIGGER trg_sync_staff_user
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_staff_user_sync();

-- -----------------------------------------------------------------------------
-- 2. تنظيف وإصلاح حساب الأدمن الرئيسي وحسابات الموظفين الحالية فوراً
-- -----------------------------------------------------------------------------

-- إعادة تثبيت ملف الأدمن الرئيسي في user_profiles
INSERT INTO public.user_profiles (
  id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '00000004-0000-0000-0000-000000000001',
  'إدارة متجر MH المهدي',
  'admin@elmahdy.com',
  '01000000001',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'إدارة متجر MH المهدي',
  email = 'admin@elmahdy.com',
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- ربط كافة مستخدمي auth بملفاتهم في user_profiles بالبريد الإلكتروني
UPDATE public.user_profiles up
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(up.email) = LOWER(au.email);

-- -----------------------------------------------------------------------------
-- 3. تحديث كلمة مرور الأدمن والبيانات داخل auth.users
-- (كلمة المرور الافتراضية أدناه: Admin@123456 - يمكنك تغييرها لأي كلمة تريدها)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE LOWER(email) = 'admin@elmahdy.com' LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      encrypted_password = crypt('Admin@123456', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"إدارة متجر MH المهدي","role":"admin","phone":"01000000001"}'::jsonb,
      updated_at = NOW()
    WHERE id = v_admin_id;

    UPDATE public.user_profiles
    SET auth_user_id = v_admin_id
    WHERE id = '00000004-0000-0000-0000-000000000001';
  ELSE
    -- في حال عدم وجود مستخدم admin@elmahdy.com في auth.users، يتم إنشاؤه مباشرة
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@elmahdy.com',
      crypt('Admin@123456', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"إدارة متجر MH المهدي","role":"admin","phone":"01000000001"}'::jsonb,
      false, ''
    )
    RETURNING id INTO v_admin_id;

    UPDATE public.user_profiles
    SET auth_user_id = v_admin_id
    WHERE id = '00000004-0000-0000-0000-000000000001';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. فحص النتيجة النهائية وتأكيد المزامنة
-- -----------------------------------------------------------------------------
SELECT 
  up.id AS profile_id,
  up.full_name,
  up.email,
  up.phone,
  up.role,
  up.auth_user_id,
  CASE WHEN au.id IS NOT NULL THEN 'متصل بنجاح ✓' ELSE 'غير متصل ✗' END AS auth_status
FROM public.user_profiles up
LEFT JOIN auth.users au ON au.id = up.auth_user_id
WHERE up.role IN ('admin', 'sales_agent', 'warehouse_preparer')
ORDER BY up.role, up.created_at;
