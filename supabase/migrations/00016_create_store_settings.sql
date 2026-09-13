-- ==============================================================================
-- 00016_create_store_settings.sql
-- Store Settings table for MH EL MAHDY B2B Storefront & Administration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL DEFAULT 'MH EL MAHDY - متجر المهدي للتجارة والتوزيع',
  tagline TEXT DEFAULT 'المنظومة المعتمدة لتوزيع إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية لقطاع الأعمال والشركات.',
  address TEXT DEFAULT 'القاهرة - وسط البلد - شارع عبد العزيز / المستودع المركزي بمدينة نصر',
  phone TEXT DEFAULT '01012345678',
  whatsapp_number TEXT DEFAULT '201012345678',
  whatsapp_message TEXT DEFAULT 'السلام عليكم، أرغب في الاستفسار عن طلب توريد بالجملة من متجر MH EL MAHDY',
  facebook_url TEXT DEFAULT 'https://facebook.com/mhelmahdy',
  instagram_url TEXT DEFAULT 'https://instagram.com/mhelmahdy',
  tiktok_url TEXT DEFAULT 'https://tiktok.com/@mhelmahdy',
  telegram_url TEXT DEFAULT 'https://t.me/mhelmahdy',
  youtube_url TEXT DEFAULT 'https://youtube.com/@mhelmahdy',
  working_hours TEXT DEFAULT 'السبت - الخميس: 9:00 ص - 10:00 م',
  announcement TEXT DEFAULT 'شحن فوري وتوصيل لكافة محافظات الجمهورية للمحلات والشركات مع إصدار بوليصة شحن وتتبع مباشر.',
  default_moq INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default row if not exists
INSERT INTO public.store_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- 1. Anyone (public/anon) can view store settings
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
  ON public.store_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Only authenticated staff can update store settings
DROP POLICY IF EXISTS "Staff can update store settings" ON public.store_settings;
CREATE POLICY "Staff can update store settings"
  ON public.store_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Allow service_role full control
DROP POLICY IF EXISTS "Service role full control on store settings" ON public.store_settings;
CREATE POLICY "Service role full control on store settings"
  ON public.store_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
