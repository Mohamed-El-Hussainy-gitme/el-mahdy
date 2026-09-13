'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  Boxes,
  Truck,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Users,
  Smartphone,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export function ExecutiveDashboard() {
  const { orders, products, customers, shortages } = useStore();

  // Metrics
  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter((o) => o.status !== 'returned')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    const pendingOrders = orders.filter((o) => o.status === 'pending');
    const prepOrders = orders.filter((o) => o.status === 'preparation');
    const shippingOrders = orders.filter((o) => o.status === 'shipping');
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const returnedOrders = orders.filter((o) => o.status === 'returned');

    // Orders pending > 48 hours
    const now = Date.now();
    const twoDaysAgo = now - 48 * 60 * 60 * 1000;
    const staleOrders = pendingOrders.filter((o) => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime < twoDaysAgo;
    });

    // Out of stock matrix items count
    let outOfStockCount = 0;
    let limitedStockCount = 0;
    products.forEach((p) => {
      if (p.matrix_items) {
        p.matrix_items.forEach((m) => {
          if (m.stock_status === 'out_of_stock' || m.stock_quantity === 0) {
            outOfStockCount++;
          } else if (m.stock_status === 'limited') {
            limitedStockCount++;
          }
        });
      }
    });

    // Unreviewed shortages
    const pendingShortages = shortages.filter((s) => s.status === 'pending');

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingCount: pendingOrders.length,
      prepCount: prepOrders.length,
      shippingCount: shippingOrders.length,
      deliveredCount: deliveredOrders.length,
      returnedCount: returnedOrders.length,
      staleOrders,
      outOfStockCount,
      limitedStockCount,
      pendingShortagesCount: pendingShortages.length,
      customersCount: customers.length,
    };
  }, [orders, products, customers, shortages]);

  // Top ordered models calculation
  const topModels = useMemo(() => {
    const counts: Record<string, { brand: string; modelName: string; quantity: number; revenue: number }> = {};
    orders.forEach((o) => {
      if (o.status === 'returned') return;
      o.items.forEach((item) => {
        if (item.model_name) {
          const key = item.model_name;
          if (!counts[key]) {
            counts[key] = {
              brand: '',
              modelName: item.model_name,
              quantity: 0,
              revenue: 0,
            };
          }
          counts[key].quantity += item.quantity;
          counts[key].revenue += item.subtotal;
        }
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders]);

  // Low Stock Items (Matrix items with <= 10 pieces)
  const lowStockItems = useMemo(() => {
    const list: Array<{ productTitle: string; sku: string; modelName?: string; stock: number; moq: number }> = [];
    products.forEach((p) => {
      if (p.matrix_items && p.matrix_items.length > 0) {
        p.matrix_items.forEach((m) => {
          if (m.stock_quantity <= 10) {
            list.push({
              productTitle: p.title_ar,
              sku: p.sku,
              modelName: m.model?.model_name || 'موديل عام',
              stock: m.stock_quantity,
              moq: m.moq,
            });
          }
        });
      }
    });
    return list.slice(0, 6);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-sky-950 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>لوحة القيادة والمؤشرات التنفيذية (B2B Executive)</span>
          </div>
          <h1 className="text-2xl font-black">مرحباً بك في مركز إدارة MH EL MAHDY</h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            متابعة حية وشاملة للمبيعات، وحركات المستودع، وطلبات العملاء، والنواقص والمناديب المعتمدين.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-left md:text-right">
          <span className="text-[11px] text-slate-300 block">إجمالي مبيعات المتجر المحققة</span>
          <span className="text-2xl font-black text-sky-400 font-mono">
            {stats.totalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">بدون الطلبات المرتجعة</span>
        </div>
      </div>

      {/* Stale Orders Warning Banner (> 48 hours pending) */}
      {stats.staleOrders.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-950 shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-extrabold text-sm mb-1 text-amber-900">
              تنبيه حرج: يوجد ({stats.staleOrders.length}) طلبات معلقة تجاوزت 48 ساعة دون تأكيد!
            </div>
            <p className="text-amber-800 leading-relaxed mb-2">
              هذه الطلبات ما زالت بحالة &quot;قيد المراجعة&quot; ولم يتم تأكيدها أو حجز مخزونها من قبل المندوب المعين.
              يُرجى اتخاذ إجراء فوري لتجنب إلغاء العميل لطلبه.
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.staleOrders.slice(0, 3).map((st) => (
                <Link
                  key={st.id}
                  href="/admin/orders"
                  className="bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2.5 py-1 rounded-lg font-bold font-mono text-[11px] transition"
                >
                  {st.order_number} ({st.customer_name})
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Pending */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">قيد المراجعة</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.pendingCount}</div>
          <span className="text-[10px] text-amber-600 font-bold block">بانتظار المندوب</span>
        </div>

        {/* Preparation */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">التجهيز</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.prepCount}</div>
          <span className="text-[10px] text-blue-600 font-bold block">المخزون محجوز</span>
        </div>

        {/* Shipping */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">قيد الشحن</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.shippingCount}</div>
          <span className="text-[10px] text-purple-600 font-bold block">مع شركة الشحن</span>
        </div>

        {/* Delivered */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">تم التسليم</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.deliveredCount}</div>
          <span className="text-[10px] text-emerald-600 font-bold block">مكتملة بنجاح</span>
        </div>

        {/* Returned */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">مرتجع</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.returnedCount}</div>
          <span className="text-[10px] text-rose-600 font-bold block">مستردة للمخزن</span>
        </div>

        {/* Out of stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">موديلات نفدت</span>
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600">{stats.outOfStockCount}</div>
          <span className="text-[10px] text-red-500 font-bold block">تحتاج توريد</span>
        </div>
      </div>

      {/* Two Columns: Top Models & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Ordered Models */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#0099DD]" />
              <span>الموديلات الأكثر طلباً (Top Ordered)</span>
            </h3>
            <Link href="/admin/orders" className="text-xs font-bold text-[#0099DD] hover:underline flex items-center gap-1">
              <span>كل الطلبات</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topModels.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              لم تسجل طلبات مكتملة بعد لحساب الموديلات الأكثر طلباً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topModels.map((m, idx) => (
                <div key={m.modelName} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{m.modelName}</div>
                      <div className="text-[10px] text-slate-400">موديل هاتف</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-slate-900 block">{m.quantity} قطعة</span>
                    <span className="text-[10px] text-[#0099DD] font-mono font-bold">
                      {m.revenue.toFixed(2)} ج.م
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-500" />
              <span>تنبيهات المخزون المنخفض (≤ 10 قطع)</span>
            </h3>
            <Link href="/admin/matrix" className="text-xs font-bold text-[#0099DD] hover:underline flex items-center gap-1">
              <span>مصفوفة التوافق</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-600 font-bold">
              جميع أصناف المستودع بحالة جيدة ولا توجد كميات منخفضة.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{item.productTitle}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      <span className="font-mono bg-slate-100 px-1 rounded">{item.sku}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700">{item.modelName}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        item.stock === 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.stock === 0 ? 'نافد (0)' : `${item.stock} قطع متبقية`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Link
          href="/admin/customers"
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-[#0099DD] transition shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0099DD] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">إدارة العملاء والمناديب</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.customersCount} عميل مسجل • ربط المندوب الدائم
            </div>
          </div>
        </Link>

        <Link
          href="/admin/shortages"
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-[#0099DD] transition shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">طلبات وتنبيهات النواقص</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stats.pendingShortagesCount} طلبات تنتظر المراجعة
            </div>
          </div>
        </Link>

        <Link
          href="/admin/products"
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-[#0099DD] transition shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900">كتالوج المنتجات والأسعار</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {products.length} منتج مسجل بالكتالوج
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
