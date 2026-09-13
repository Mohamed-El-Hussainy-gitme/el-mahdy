-- ==============================================================================
-- MH EL MAHDY Store — Migration 00002: Seed Data
-- Version   : 00002
-- Created   : 2026-09-08
-- Description:
--   Inserts the 18 confirmed primary categories, a comprehensive Master Models
--   repository across all major brands, and sample products with compatibility
--   matrix entries and category links.
--
--   All IDs use valid hex-only UUIDs (format: XXXXXXXX-0000-0000-0000-XXXXXXXXXXXX).
--   Prefix legend:
--     00000001-…  = categories
--     00000002-…  = master_models
--     00000003-…  = products
--     00000004-…  = user_profiles (staff)
--
--   Uses ON CONFLICT … DO UPDATE so this script is safely re-runnable.
-- ==============================================================================

-- ── 1. 18 Primary Categories ──────────────────────────────────────────────────
insert into categories (id, name_ar, slug, sort_order, is_active) values
  ('00000001-0000-0000-0000-000000000001', 'كل المنتجات',                          'all-products',       1,  true),
  ('00000001-0000-0000-0000-000000000002', 'أجهزة الموبايل',                        'mobile-phones',      2,  true),
  ('00000001-0000-0000-0000-000000000003', 'ماركات أصلية (Originals)',              'originals',          3,  true),
  ('00000001-0000-0000-0000-000000000004', 'باور بانك',                             'power-banks',        4,  true),
  ('00000001-0000-0000-0000-000000000005', 'سماعات بلوتوث وإيربودز',               'bluetooth-earbuds',  5,  true),
  ('00000001-0000-0000-0000-000000000006', 'ساعات رقمية (Smart Watches)',           'smart-watches',      6,  true),
  ('00000001-0000-0000-0000-000000000007', 'سماعات مكبرة (Speakers & GM)',         'speakers',           7,  true),
  ('00000001-0000-0000-0000-000000000008', 'اكسسوارات سيارات',                      'car-accessories',    8,  true),
  ('00000001-0000-0000-0000-000000000009', 'اكسسوارات كمبيوتر',                     'computer-accessories',9, true),
  ('00000001-0000-0000-0000-000000000010', 'ساعات متنوعة',                          'watches',            10, true),
  ('00000001-0000-0000-0000-000000000011', 'اكسسوارات متنوعة',                      'general-accessories',11, true),
  ('00000001-0000-0000-0000-000000000012', 'سكرينات متنوعة (حماية شاشة)',          'screen-protectors',  12, true),
  ('00000001-0000-0000-0000-000000000013', 'جرابات متنوعة (كفرات)',                'phone-cases',        13, true),
  ('00000001-0000-0000-0000-000000000014', 'رينج لايت - ترايبود - سيلفي ستيك',   'lighting-tripods',   14, true),
  ('00000001-0000-0000-0000-000000000015', 'أسلاك ورؤوس شواحن متنوعة',             'chargers-adapters',  15, true),
  ('00000001-0000-0000-0000-000000000016', 'كابل شحن',                              'charging-cables',    16, true),
  ('00000001-0000-0000-0000-000000000017', 'فلاشات وكروت ميموري',                  'storage-memory',     17, true),
  ('00000001-0000-0000-0000-000000000018', 'بطاريات للهاتف',                        'phone-batteries',    18, true)
on conflict (slug) do update set
  name_ar    = excluded.name_ar,
  sort_order = excluded.sort_order,
  is_active  = excluded.is_active;

-- ── 2. Master Phone Models ────────────────────────────────────────────────────
-- Apple
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000001', 'Apple', 'iPhone 11',  'iPhone 11',          2019),
  ('00000002-0000-0000-0000-000000000002', 'Apple', 'iPhone 11',  'iPhone 11 Pro',       2019),
  ('00000002-0000-0000-0000-000000000003', 'Apple', 'iPhone 11',  'iPhone 11 Pro Max',   2019),
  ('00000002-0000-0000-0000-000000000004', 'Apple', 'iPhone 12',  'iPhone 12',           2020),
  ('00000002-0000-0000-0000-000000000005', 'Apple', 'iPhone 12',  'iPhone 12 Pro',       2020),
  ('00000002-0000-0000-0000-000000000006', 'Apple', 'iPhone 12',  'iPhone 12 Pro Max',   2020),
  ('00000002-0000-0000-0000-000000000007', 'Apple', 'iPhone 13',  'iPhone 13',           2021),
  ('00000002-0000-0000-0000-000000000008', 'Apple', 'iPhone 13',  'iPhone 13 Pro Max',   2021),
  ('00000002-0000-0000-0000-000000000009', 'Apple', 'iPhone 14',  'iPhone 14',           2022),
  ('00000002-0000-0000-0000-000000000010', 'Apple', 'iPhone 14',  'iPhone 14 Pro Max',   2022),
  ('00000002-0000-0000-0000-000000000011', 'Apple', 'iPhone 15',  'iPhone 15',           2023),
  ('00000002-0000-0000-0000-000000000012', 'Apple', 'iPhone 15',  'iPhone 15 Pro Max',   2023),
  ('00000002-0000-0000-0000-000000000013', 'Apple', 'iPhone 16',  'iPhone 16',           2024),
  ('00000002-0000-0000-0000-000000000014', 'Apple', 'iPhone 16',  'iPhone 16 Pro Max',   2024)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Samsung
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000020', 'Samsung', 'Galaxy A', 'Samsung A01',              2020),
  ('00000002-0000-0000-0000-000000000021', 'Samsung', 'Galaxy A', 'Samsung A04 / A04E',       2022),
  ('00000002-0000-0000-0000-000000000022', 'Samsung', 'Galaxy A', 'Samsung A22 5G',           2021),
  ('00000002-0000-0000-0000-000000000023', 'Samsung', 'Galaxy A', 'Samsung A32 5G',           2021),
  ('00000002-0000-0000-0000-000000000024', 'Samsung', 'Galaxy A', 'Samsung A72 4G',           2021),
  ('00000002-0000-0000-0000-000000000025', 'Samsung', 'Galaxy A', 'Samsung A54 5G',           2023),
  ('00000002-0000-0000-0000-000000000026', 'Samsung', 'Galaxy S', 'Galaxy S23 Ultra',         2023),
  ('00000002-0000-0000-0000-000000000027', 'Samsung', 'Galaxy S', 'Galaxy S24 Ultra',         2024)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Xiaomi / Redmi
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000030', 'Xiaomi', 'Mi Series',    'Xiaomi Mi 8 Lite',         2018),
  ('00000002-0000-0000-0000-000000000031', 'Xiaomi', 'Redmi Note',   'Redmi Note 11',             2022),
  ('00000002-0000-0000-0000-000000000032', 'Xiaomi', 'Redmi Note',   'Redmi Note 12 Pro',         2023),
  ('00000002-0000-0000-0000-000000000033', 'Xiaomi', 'Redmi Note',   'Redmi Note 13',             2024),
  ('00000002-0000-0000-0000-000000000034', 'Xiaomi', 'Redmi',        'Redmi 12C',                 2023)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Oppo
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000040', 'Oppo', 'A Series', 'OPPO A37',         2016),
  ('00000002-0000-0000-0000-000000000041', 'Oppo', 'A Series', 'OPPO A78',         2023),
  ('00000002-0000-0000-0000-000000000042', 'Oppo', 'Reno',     'OPPO Reno 10',     2023),
  ('00000002-0000-0000-0000-000000000043', 'Oppo', 'Reno',     'OPPO Reno 11',     2024)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Realme
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000050', 'Realme', 'C Series', 'Realme C35',  2022),
  ('00000002-0000-0000-0000-000000000051', 'Realme', 'C Series', 'Realme C55',  2023),
  ('00000002-0000-0000-0000-000000000052', 'Realme', '11 Series','Realme 11',   2023)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Infinix
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000060', 'Infinix', 'Hot Series',  'Infinix X559 (Hot 4)',  2017),
  ('00000002-0000-0000-0000-000000000061', 'Infinix', 'Hot Series',  'Infinix Hot 30',        2023),
  ('00000002-0000-0000-0000-000000000062', 'Infinix', 'Zero Series', 'Infinix Zero 30',       2023),
  ('00000002-0000-0000-0000-000000000063', 'Infinix', 'Note Series', 'Infinix Note 30',       2023)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- Huawei / Honor / Vivo
insert into master_models (id, brand, series, model_name, release_year) values
  ('00000002-0000-0000-0000-000000000070', 'Huawei', 'Nova Series', 'Huawei Nova 3i',        2018),
  ('00000002-0000-0000-0000-000000000071', 'Huawei', 'Nova Series', 'Huawei Nova 2',         2017),
  ('00000002-0000-0000-0000-000000000080', 'Honor',  'X Series',    'Honor X8',              2022),
  ('00000002-0000-0000-0000-000000000090', 'Vivo',   'Y Series',    'Vivo Y20 / Y12s',       2020),
  ('00000002-0000-0000-0000-000000000091', 'Vivo',   'Y Series',    'Vivo Y35',              2022)
on conflict (id) do update set
  brand        = excluded.brand,
  series       = excluded.series,
  model_name   = excluded.model_name,
  release_year = excluded.release_year;

-- ── 3. Products ───────────────────────────────────────────────────────────────
-- Prices are in EGP (ج.م). image_url uses placeholder images for dev.
insert into products
  (id, sku, title_ar, description_ar, price, is_exchange_only, is_featured, has_compatibility_matrix, image_url)
values
  ( '00000003-0000-0000-0000-000000000001',
    '2100157',
    'Infinix X559 شاشة حماية متكاملة',
    'لاصقة حماية زجاجية عالية الشفافية مصممة خصيصاً لهاتف إنفينكس X559',
    111.78, true, true, false,
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000002',
    '789-5',
    'سكرين سيليكون بحواف بارزة (ماركة ميني كينج)',
    'حماية سيليكونية فائقة المرونة بمقاومة صدمات عالية — متوافقة مع موديلات متعددة',
    55.00, true, true, true,
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000003',
    '2100123',
    'Xiaomi Mi 8 Lite سكرين زجاجي مقوى',
    'حماية فائقة بمقاومة الخدوش 9H ولمس فائق النعومة لشاومي مي 8 لايت',
    119.71, true, true, false,
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000004',
    'BIG-ARC',
    'سكرين 3 ملى 5×1 — اميجو',
    'أقوى سكرين حماية نانو 3 ملم بتقنية 5 في 1 — تغطي أكثر من 200 موديل',
    15.98, false, true, true,
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000005',
    '2100078',
    'SAM A72 4G / A32 5G حماية شاشة',
    'سكرين زجاجي متوافق مع هواتف سامسونج A72 و A32 بتقنية عالية',
    119.74, true, false, false,
    'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000006',
    'AMIGO-01',
    'سكرين 1 ملى — اميجو',
    'سكرين نحيف بحواف ناعمة مريحة للمس وحماية فائقة — متوفر لعدة موديلات',
    175.00, true, true, true,
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000007',
    'FREE-EDGE',
    'سكرين فاميه فري ايدج — ماركة اميجو',
    'سكرين خصوصية فاميه مانع للتلصص بتغطية كاملة من الحافة للحافة',
    137.66, true, true, true,
    'https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000008',
    '2100023',
    'OPPO A37 كفر حماية خلفي',
    'كفر خلفي عالي المتانة ضد الصدمات وخفيف الوزن لأوبو A37',
    118.37, true, false, false,
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000009',
    '789-29',
    'سكرين تاب 10 بوصة عالي الدقة',
    'حماية زجاجية فاخرة للشاشات اللوحية بمقاس 10 بوصة ووضوح كريستالي',
    35.00, false, true, false,
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000010',
    '2100173',
    'iPhone 11 Pro Max زجاج حماية',
    'لاصقة حماية شاشة أصلية لهاتف آيفون 11 برو ماكس',
    201.15, true, false, false,
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000011',
    '2100061',
    'SAM A04 / A04E / A22 5G حامي شاشة',
    'حماية شاشة مخصصة لهواتف سامسونج الفئة الاقتصادية',
    116.58, true, false, false,
    'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80' ),

  ( '00000003-0000-0000-0000-000000000012',
    '2100056',
    'SAM A01 سكرين حماية زجاجي',
    'حامي شاشة متين لهاتف سامسونج A01',
    115.90, true, false, false,
    'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=600&auto=format&fit=crop&q=80' )
on conflict (sku) do update set
  title_ar                 = excluded.title_ar,
  description_ar           = excluded.description_ar,
  price                    = excluded.price,
  is_exchange_only         = excluded.is_exchange_only,
  is_featured              = excluded.is_featured,
  has_compatibility_matrix = excluded.has_compatibility_matrix,
  image_url                = excluded.image_url,
  updated_at               = now();

-- ── 4. Product ↔ Category Links ───────────────────────────────────────────────
insert into product_categories (product_id, category_id) values
  -- Screen protectors also appear under "كل المنتجات"
  ('00000003-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000007', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000007', '00000001-0000-0000-0000-000000000012'),
  -- Phone case under "كل المنتجات" + "جرابات"
  ('00000003-0000-0000-0000-000000000008', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000008', '00000001-0000-0000-0000-000000000013'),
  -- Tablet screen under screen-protectors
  ('00000003-0000-0000-0000-000000000009', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000009', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000010', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000010', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000011', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000011', '00000001-0000-0000-0000-000000000012'),
  ('00000003-0000-0000-0000-000000000012', '00000001-0000-0000-0000-000000000001'),
  ('00000003-0000-0000-0000-000000000012', '00000001-0000-0000-0000-000000000012')
on conflict do nothing;

-- ── 5. Compatibility Matrix ───────────────────────────────────────────────────
-- stock_status values: 'in_stock' (>10), 'limited' (1-10), 'out_of_stock' (0)

-- Product 4 — "سكرين 3 ملى 5×1 اميجو" (multi-model screen protector)
insert into product_model_matrix (product_id, model_id, stock_quantity, moq, stock_status) values
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000001', 150, 5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000002', 80,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000003', 200, 5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000004', 60,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000005', 12,  5,  'limited'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000006', 0,   5,  'out_of_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000007', 95,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000008', 40,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000020', 40,  10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000021', 110, 10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000023', 65,  10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000030', 8,   5,  'limited'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000040', 30,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000060', 25,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000004', '00000002-0000-0000-0000-000000000090', 20,  5,  'in_stock')
on conflict (product_id, model_id) do update set
  stock_quantity = excluded.stock_quantity,
  moq            = excluded.moq,
  stock_status   = excluded.stock_status,
  updated_at     = now();

-- Product 2 — "سكرين سيليكون بحواف بارزة ميني كينج"
insert into product_model_matrix (product_id, model_id, stock_quantity, moq, stock_status) values
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000001', 50,  10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000004', 70,  10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000012', 4,   10, 'limited'),
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000026', 35,  10, 'in_stock'),
  ('00000003-0000-0000-0000-000000000002', '00000002-0000-0000-0000-000000000030', 15,  10, 'in_stock')
on conflict (product_id, model_id) do update set
  stock_quantity = excluded.stock_quantity,
  moq            = excluded.moq,
  stock_status   = excluded.stock_status,
  updated_at     = now();

-- Product 6 — "سكرين 1 ملى اميجو"
insert into product_model_matrix (product_id, model_id, stock_quantity, moq, stock_status) values
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000001', 120, 5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000007', 90,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000008', 55,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000011', 7,   5,  'limited'),
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000013', 0,   5,  'out_of_stock'),
  ('00000003-0000-0000-0000-000000000006', '00000002-0000-0000-0000-000000000030', 40,  5,  'in_stock')
on conflict (product_id, model_id) do update set
  stock_quantity = excluded.stock_quantity,
  moq            = excluded.moq,
  stock_status   = excluded.stock_status,
  updated_at     = now();

-- Product 7 — "سكرين فاميه فري ايدج اميجو"
insert into product_model_matrix (product_id, model_id, stock_quantity, moq, stock_status) values
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000009', 80,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000010', 60,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000011', 45,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000012', 9,   5,  'limited'),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000013', 30,  5,  'in_stock'),
  ('00000003-0000-0000-0000-000000000007', '00000002-0000-0000-0000-000000000014', 0,   5,  'out_of_stock')
on conflict (product_id, model_id) do update set
  stock_quantity = excluded.stock_quantity,
  moq            = excluded.moq,
  stock_status   = excluded.stock_status,
  updated_at     = now();

-- ── 6. Initial Staff Profiles (no auth_user_id yet — linked after Supabase Auth setup) ──
-- These are standalone profile rows for the three staff roles.
-- auth_user_id will be set via UPDATE after creating actual Auth users in Supabase Dashboard.
insert into user_profiles (id, full_name, phone, role, email) values
  ('00000004-0000-0000-0000-000000000001', 'إدارة متجر MH المهدي',               '01000000001', 'admin',               'admin@elmahdy.com'),
  ('00000004-0000-0000-0000-000000000002', 'أحمد محمود (مندوب مبيعات)',          '01012345678', 'sales_agent',         'sales@elmahdy.com'),
  ('00000004-0000-0000-0000-000000000003', 'محمود عبد الرازق (المستودع)',         '01000000003', 'warehouse_preparer',  'warehouse@elmahdy.com')
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  role       = excluded.role,
  email      = excluded.email,
  updated_at = now();
