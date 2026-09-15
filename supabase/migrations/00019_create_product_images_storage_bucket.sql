-- =============================================================================
-- Migration: 00019_create_product_images_storage_bucket.sql
-- الغرض: إنشاء Storage Bucket الخاص بصور المنتجات وضبط صلاحياته
-- السبب: الكود في src/lib/storage.ts (uploadProductImage) يفترض وجود باكت
--         باسم 'product-images' جاهز مسبقًا، لكن لا يوجد أي migration سابق
--         ينشئه فعليًا في قاعدة البيانات — هذا هو السبب الأرجح لفشل رفع
--         الصور بالكامل من لوحة التحكم.
-- =============================================================================

-- 1. إنشاء الـ Bucket (لو مش موجود) — public = true عشان صور المنتجات
--    تحتاج تكون قابلة للعرض في المتجر الأمامي بدون تسجيل دخول
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB حد أقصى لكل صورة
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 2. صلاحيات القراءة: عامة بالكامل (أي زائر يشوف صور المنتجات في المتجر)
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- 3. صلاحيات الرفع/التعديل/الحذف: مقصورة على الأدمن فقط (نفس منطق باقي الجداول)
drop policy if exists "Admin upload product images" on storage.objects;
create policy "Admin upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );

drop policy if exists "Admin update product images" on storage.objects;
create policy "Admin update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );

drop policy if exists "Admin delete product images" on storage.objects;
create policy "Admin delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.current_user_role() = 'admin'
  );