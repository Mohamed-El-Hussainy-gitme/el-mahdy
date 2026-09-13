# خارطة الطريق التشغيلية الشاملة — متجر MH EL MAHDY B2B
## MASTER OPERATIONAL ROADMAP

> هذا الملف هو خطة العمل الفعلية — يُقرأ مع `Mh elmahdy store spec.md` (مصدر الحقيقة).
> الترتيب: إزالة المحاكاة أولاً → قاعدة بيانات حية → لوحة تحكم احترافية → تكامل متجر/لوحة تحكم.

---

## القسم الأول: تشخيص الوضع الراهن

### ما يعمل بشكل صحيح

| العنصر | الحالة |
|---|---|
| بنية الأنواع types/index.ts | متكاملة — Product, Order, Category, MasterModel, UserProfile, ShortageRequest |
| منطق RBAC في authService.ts | 3 أدوار صحيحة — admin, sales_agent, warehouse_preparer |
| منطق دورة حياة الطلب في orderService.ts | انتقالات الحالة محمية بصلاحيات |
| قاعدة حجز المخزون matrixService.ts | الخصم فقط عند pending → preparation |
| مصفوفة التوافق Product-Model Matrix | المنطق الهيكلي صحيح |
| شجرة التصنيفات اللانهائية | buildCategoryTree يعمل |
| Supabase migrations 00001-00004 | Schema سليم |
| التزامن مع Supabase في StoreContext | يقرأ من DB عند التهيئة |

---

### ما ينقص تشغيلياً (التشخيص الكامل)

#### 1. مشكلة المحاكاة — الأولوية القصوى

```
src/lib/mockData.ts  ← يجب الحذف الكامل
src/context/StoreContext.tsx ← يعتمد على INITIAL_* كـ useState initial values (خطأ جوهري)
```

المشكلة: StoreContext يُهيّئ الـ state من mock أولاً ثم يحاول override بـ Supabase.
النتيجة: إذا Supabase فارغ أو بطيء تظهر بيانات وهمية للمستخدم.
الحل: قراءة من Supabase فقط — useState([]) حتى تأتي البيانات الحقيقية.

---

#### 2. لوحة التحكم — ما ينقص تشغيلياً

**أ. واجهة الطلبات OrdersManager**
- لا طباعة قائمة التجهيز (إذن صرف مخزني) — ضرورة تشغيلية للمستودع
- لا طباعة فاتورة تسليم عند الانتقال لـ delivered
- تسجيل سبب المرتجع مفقود (مرفوض / تالف / خطأ موديل)
- لا يوجد carrier_name وrqm البوليصة منفصل عن tracking_notes
- كشف حساب العميل الإجمالي غير موجود

**ب. واجهة المنتجات ProductManager**
- رفع الصور إلى Supabase Storage غير موجود (URL نصي فقط)
- معرض الصور gallery_urls موجود في الـ type لكن غير مبني في الـ UI
- سعر التكلفة الداخلي (للأدمن فقط) لحساب هامش الربح غير موجود
- النسخ الجماعي للمصفوفة بين المنتجات مفقود
- لا تفعيل/تعطيل المنتج (is_active toggle) من الجدول مباشرة

**ج. واجهة مصفوفة التوافق CompatibilityMatrixManager**
- إضافة جماعية (Bulk Add) لموديلات متعددة دفعة واحدة مفقودة
- فلتر بالماركة عند البحث في الموديلات مفقود
- لا تصدير المصفوفة إلى CSV

**د. لوحة الإحصائيات Dashboard — غير موجودة أصلاً**
- لا يوجد أي صفحة Dashboard تُظهر:
  - إجمالي الطلبات اليوم / الأسبوع
  - قيمة الطلبات المعلقة Pending
  - تحذيرات المخزون المنخفض
  - الطلبات التي تجاوزت 48 ساعة في pending بدون تأكيد

**هـ. إدارة العملاء Customer Management — غير موجودة أصلاً**
- لا قائمة بالعملاء المسجلين
- لا ملف عميل (تاريخ طلباته وإجمالي مشترياته)
- لا تعديل المندوب يدوياً من الأدمن
- لا زر واتساب مباشر من قائمة العملاء

---

#### 3. المتجر الأمامي — ما ينقص

- تسجيل حساب العميل الحقيقي مع Supabase Auth (حالياً localStorage فقط — وهمي)
- صفحة /account لعرض طلبات العميل وحالاتها الحقيقية
- Realtime updates لحالة الطلبات بدون refresh

---

## القسم الثاني: خطة إزالة Mock Data الكاملة

### الشرط المسبق — تهيئة قاعدة البيانات

```sql
-- تشغيل supabase/all_migrations.sql في Supabase SQL Editor
-- التأكد من وجود:
-- 18 تصنيف في categories
-- 20+ موديل في master_models
-- 3 موظفين في user_profiles (admin, sales_agent, warehouse_preparer)
```

### المرحلة الأولى — StoreContext: Supabase-First

```typescript
// قبل (خاطئ):
const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);

// بعد (صحيح):
const [categories, setCategories] = useState<Category[]>([]);
const [isLoading, setIsLoading] = useState(true);
// لا تُعرض بيانات حتى يكتمل fetchFromSupabase()
// عند خطأ Supabase → رسالة خطأ، لا fallback لـ mock
```

### المرحلة الثانية — Staff Auth → Supabase Auth الحقيقي

```typescript
// قبل (hardcoded — خطير):
if (trimmed === 'admin@elmahdy.com' && pass === 'admin123') { ... }

// بعد (Supabase Auth):
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();
setStaffSession(profile);
```

### المرحلة الثالثة — Customer Auth → Supabase Auth

```typescript
const { data } = await supabase.auth.signUp({
  email: `${phone.replace(/\D/g,'')}@elmahdy.b2b`,
  password: phone.replace(/\D/g,''),
  options: { data: { full_name: name, phone, company_name: company } }
});
// user_profile يُنشأ تلقائياً عبر DB trigger (migration 00003)
// Sticky Rep يُعيَّن عبر sp_assign_sticky_sales_rep
```

### المرحلة الرابعة — حذف mockData.ts

```bash
# بعد التأكد من عمل كل شيء مع Supabase:
rm src/lib/mockData.ts

# التحقق من عدم وجود imports متبقية:
grep -r "mockData" src/ --include="*.ts" --include="*.tsx"
# يجب ألا يظهر أي نتيجة
```

---

## القسم الثالث: لوحة التحكم — المواصفة الكاملة

### الهيكل المعماري الجديد

```
/admin/
├── page.tsx                     ← Dashboard / لوحة الإحصائيات (NEW)
├── orders/
│   ├── page.tsx                 ← قائمة الطلبات مع فلاتر
│   └── [id]/page.tsx            ← تفاصيل طلب + طباعة
├── products/
│   ├── page.tsx                 ← كتالوج المنتجات
│   └── [id]/
│       ├── page.tsx             ← تعديل المنتج + gallery
│       └── matrix/page.tsx      ← مصفوفة التوافق لمنتج واحد
├── categories/page.tsx          ← شجرة التصنيفات
├── customers/
│   ├── page.tsx                 ← قائمة العملاء
│   └── [id]/page.tsx            ← ملف العميل + طلباته
├── master-models/page.tsx       ← إدارة موديلات الهواتف
├── shortages/page.tsx           ← النواقص مع تجميع
├── inventory/page.tsx           ← تسويات المخزون (NEW)
└── login/page.tsx               ← موجود
```

---

### 3.1 صفحة Dashboard — عناصرها

4 بطاقات KPI:
1. طلبات اليوم (COUNT من orders حيث created_at::date = CURRENT_DATE)
2. قيمة المعلق — SUM(total_amount) حيث status = 'pending'
3. تحذيرات المخزون — عدد الموديلات في حالة limited أو out_of_stock
4. طلبات النواقص الجديدة — COUNT من shortage_requests حيث status = 'pending'

تنبيه خاص: قائمة الطلبات التي تجاوزت 48 ساعة في pending بدون تأكيد:
```sql
SELECT * FROM orders
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '48 hours'
ORDER BY created_at ASC;
```

أكثر 5 موديلات طلباً هذا الشهر:
```sql
SELECT mm.model_name, mm.brand, SUM(oi.quantity) as total_ordered
FROM order_items oi
JOIN master_models mm ON oi.model_id = mm.id
JOIN orders o ON oi.order_id = o.id
WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY mm.id, mm.model_name, mm.brand
ORDER BY total_ordered DESC
LIMIT 5;
```

---

### 3.2 إدارة الطلبات — الميزات المطلوبة

**طباعة قائمة التجهيز (Picking Slip):**

```typescript
// src/lib/print.ts
export function printPickingSlip(order: Order): void {
  const html = `
    <html dir="rtl"><head><style>
      body { font-family: Cairo, sans-serif; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; }
    </style></head>
    <body>
      <h2>MH EL MAHDY — إذن صرف مخزني</h2>
      <p>رقم الطلب: ${order.order_number} | التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
      <p>العميل: ${order.customer_name} | المندوب: ${order.sales_agent_name}</p>
      <table>
        <thead><tr><th>المنتج</th><th>الموديل</th><th>الكمية</th></tr></thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${item.product_title} (${item.product_sku})</td>
              <td>${item.model_name || '—'}</td>
              <td>${item.quantity} قطعة</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <br/>
      <p>توقيع المجهز: __________________ توقيع المشرف: __________________</p>
    </body></html>
  `;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.print();
}
```

**حقول إضافية للشحن والمرتجع (يضاف لـ Order type وDB):**

```typescript
// في types/index.ts:
export interface Order {
  // ... الحقول الموجودة
  carrier_name?: string;     // اسم شركة الشحن
  waybill_number?: string;   // رقم البوليصة
  return_reason?: 'customer_refused' | 'damaged_in_transit' | 'wrong_order' | 'wrong_model' | 'other';
  return_notes?: string;
}
```

---

### 3.3 إدارة المنتجات — حقول إضافية

```sql
-- Migration 00005_product_enhancements.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';
```

**رفع الصور:**

```typescript
// src/lib/storage.ts
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const fileName = `products/${productId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);
  return publicUrl;
}
```

---

### 3.4 مصفوفة التوافق — الإضافة الجماعية

```sql
-- Migration 00008_bulk_matrix.sql
CREATE OR REPLACE PROCEDURE sp_bulk_upsert_matrix_items(
  p_product_id UUID,
  p_items JSONB
)
LANGUAGE plpgsql AS $$
DECLARE item JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO product_model_matrix (product_id, model_id, stock_quantity, moq, stock_status)
    VALUES (
      p_product_id,
      (item->>'model_id')::UUID,
      (item->>'stock_quantity')::INT,
      (item->>'moq')::INT,
      CASE
        WHEN (item->>'stock_quantity')::INT = 0 THEN 'out_of_stock'
        WHEN (item->>'stock_quantity')::INT <= 10 THEN 'limited'
        ELSE 'in_stock'
      END
    )
    ON CONFLICT (product_id, model_id) DO UPDATE SET
      stock_quantity = EXCLUDED.stock_quantity,
      moq = EXCLUDED.moq,
      stock_status = EXCLUDED.stock_status,
      updated_at = now();
  END LOOP;
END;
$$;
```

**واجهة Bulk Add:**
- فلتر بالماركة + بحث نصي في قائمة الموديلات
- checkbox لكل موديل + حقل كمية + حقل MOQ
- زر "تطبيق نفس الكمية على كل المحدد"
- زر "حفظ الكل دفعة واحدة" يستدعي sp_bulk_upsert_matrix_items
- خيار "نسخ مصفوفة من منتج آخر" (select منتج ثم نسخ موديلاته)

---

### 3.5 إدارة العملاء — جديدة كلياً

```sql
-- Query الرئيسي لقائمة العملاء مع الإحصائيات
SELECT
  up.id, up.full_name, up.phone, up.company_name,
  sr.full_name AS sales_rep_name, sr.phone AS sales_rep_phone,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_value,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'pending'), 0) AS pending_value
FROM user_profiles up
LEFT JOIN user_profiles sr ON up.assigned_sales_rep_id = sr.id
LEFT JOIN orders o ON o.customer_id = up.id
WHERE up.role = 'customer'
GROUP BY up.id, sr.full_name, sr.phone
ORDER BY delivered_value DESC;
```

**عناصر صفحة العملاء:**
- جدول: الاسم | الشركة | الهاتف | المندوب | إجمالي الطلبات | قيمة المشتريات المُسلَّمة
- زر واتساب مباشر: https://wa.me/{phone}
- إمكانية تغيير المندوب (Admin Only)
- ملف عميل كامل مع قائمة طلباته وحالاتها

---

### 3.6 تسويات المخزون — جدول جديد

```sql
-- Migration 00006_inventory_adjustments.sql
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  model_id UUID REFERENCES master_models(id) ON DELETE CASCADE,
  adjusted_by UUID REFERENCES user_profiles(id),
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN ('surplus', 'deficit', 'damage', 'correction', 'return_stock')
  ),
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,  -- موجب = زيادة، سالب = نقص
  quantity_after INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_adjustments" ON inventory_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## القسم الرابع: المتجر الأمامي — التكامل المفقود

### 4.1 تسجيل العميل الحقيقي

```typescript
// UserAccountModal.tsx
const handleAuth = async (name: string, phone: string, company?: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const email = `${cleanPhone}@elmahdy.b2b`;
  const password = cleanPhone;

  // محاولة تسجيل
  const { error: signUpError } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name, phone, company_name: company } }
  });

  if (signUpError?.message?.includes('already registered')) {
    // تسجيل دخول إن كان موجوداً
    await supabase.auth.signInWithPassword({ email, password });
  }
  // user_profile يُنشأ عبر DB trigger (migration 00003)
};
```

### 4.2 صفحة /account للعميل

عناصرها:
- اسم العميل والشركة
- المندوب المعتمد + زر واتساب مباشر
- قائمة طلباتي مع الحالة والمبلغ والتاريخ
- نموذج تسجيل نقص (Shortage Request)

### 4.3 Realtime Order Updates

```typescript
useEffect(() => {
  if (!currentUser) return;
  const channel = supabase
    .channel('my-orders')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `customer_id=eq.${currentUser.id}`,
    }, (payload) => {
      setOrders(prev => prev.map(o =>
        o.id === payload.new.id ? { ...o, ...payload.new } : o
      ));
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [currentUser]);
```

---

## القسم الخامس: Migrations المطلوبة

| رقم | الملف | المحتوى |
|---|---|---|
| 00001 | موجود | Initial Schema |
| 00002 | موجود | Seed Data |
| 00003 | موجود | RLS & Policies & Triggers |
| 00004 | موجود | Stored Procedures |
| 00005 | مطلوب | Product: cost_price, gallery_urls |
| 00006 | مطلوب | Inventory Adjustments Table + RLS |
| 00007 | مطلوب | Order: carrier_name, waybill_number, return_reason, return_notes |
| 00008 | مطلوب | sp_bulk_upsert_matrix_items |

---

## القسم السادس: خطة التنفيذ المرحلية

### المرحلة الأولى — الأساس (أولوية قصوى)
الهدف: صفر mock data + Auth حقيقي

1. تحويل StoreContext: useState([]) بدلاً من useState(INITIAL_*)
2. Staff Auth → Supabase Auth (حذف hardcoded credentials)
3. Customer Auth → Supabase Auth
4. حذف src/lib/mockData.ts نهائياً
5. كتابة Migrations 00005, 00006, 00007, 00008

### المرحلة الثانية — لوحة التحكم الأساسية
الهدف: الأدمن يعمل 100% بيانات حقيقية

1. Dashboard Analytics Page (KPIs + تحذيرات + طلبات متأخرة)
2. Bulk Add في مصفوفة التوافق مع فلتر ماركة
3. Image Upload → Supabase Storage
4. Cost Price + هامش الربح (Admin Only)
5. is_active toggle من جدول المنتجات
6. Print Picking Slip + فاتورة التسليم

### المرحلة الثالثة — الكمال التشغيلي
الهدف: نظام مكتمل احترافياً

1. إدارة العملاء /admin/customers
2. صفحة حسابي /account للعميل
3. تسويات المخزون /admin/inventory
4. Realtime Order Updates
5. تسجيل سبب المرتجع + حقول بوليصة الشحن
6. نسخ مصفوفة توافق بين المنتجات
7. تجميع النواقص (aggregate view)

---

## القسم السابع: معايير الجودة الإلزامية

### قواعد لا تُكسر أبداً (من spec.md)

1. لا تظهر كلمة "استيراد" أو "بيع بالجملة" في أي نص واجهة أمامية
2. لا Guest Checkout — تأكيد الطلب يتطلب حساب مسجل دائماً
3. لا دفع أونلاين — لا حقل طريقة دفع في أي مكان
4. لا خصم مخزون عند الإضافة للسلة — الخصم فقط عند pending → preparation
5. سعر موحد للجميع — لا يتغير بحسب العميل أو الكمية
6. Sticky Rep — أول مندوب يتواصل مع العميل يبقى مندوبه الدائم
7. مستودع واحد — لا منطق فروع أو نقل بضاعة

### قواعد الكود الإلزامية

- لا hardcoded credentials في الكود — كل env variables في .env.local
- كل migration رقمي ومرتب (00001, 00002, ...)
- لا ملف أكبر من 400 سطر — تقسيم إلى components مستقلة
- كل component يأخذ props من الخارج ولا يقرأ من Context مباشرة
- TypeScript strict — لا any إلا عند الضرورة مع تعليق توضيحي
- كل تعامل مع Supabase في services/ أو lib/ — لا في components مباشرة
- loading states واضحة + empty states جميلة + error states صريحة

### ترتيب بناء كل وحدة جديدة

```
1. Service/Function — المنطق مستقل عن الـ UI
2. Integration — التأكد من التواصل مع Supabase DB بالبيانات الحقيقية
3. Component/UI — الواجهة فوق منطق مؤكد الصحة
```

---

*آخر تحديث: 2026-09-08 — مبني على تحليل كامل للكود الحالي والـ spec الأصلي*
