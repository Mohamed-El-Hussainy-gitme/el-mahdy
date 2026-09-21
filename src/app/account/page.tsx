'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Building,
  MapPin,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  RotateCcw,
  Boxes,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  LogOut,
  AlertCircle,
  ArrowRight,
  Calendar,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { useStore, DEFAULT_STICKY_SALES_REP } from '@/context/StoreContext';
import { Order, OrderStatus } from '@/types';

// ========================
// Status badge helper
// ========================
function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: 'قيد المراجعة',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Clock className="w-3 h-3" />,
    },
    preparation: {
      label: 'جاري التجهيز',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Boxes className="w-3 h-3" />,
    },
    shipping: {
      label: 'في الشحن',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Truck className="w-3 h-3" />,
    },
    delivered: {
      label: 'تم التسليم',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    returned: {
      label: 'مرتجع',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <RotateCcw className="w-3 h-3" />,
    },
  };
  const { label, className, icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

// ========================
// Order card component
// ========================
function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-right hover:bg-slate-50 transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-900 font-mono text-sm">{order.order_number}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              {new Date(order.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <div className="text-left">
            <div className="font-extrabold text-[#0099DD] text-sm font-mono">
              {Number(order.total_amount).toFixed(2)} ج.م
            </div>
            <div className="text-[10px] text-slate-400">{order.items.length} أصناف</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {order.tracking_notes && (
            <div className="px-4 py-2.5 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{order.tracking_notes}</span>
            </div>
          )}
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-xs">
              <div>
                <div className="font-bold text-slate-800">{item.product_title}</div>
                <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono bg-slate-100 px-1 rounded">{item.product_sku}</span>
                  {item.model_name && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-600">{item.model_name}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-bold text-slate-900">{item.quantity} قطعة</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {item.unit_price.toFixed(2)} ج.م / قطعة
                </div>
              </div>
            </div>
          ))}
          {order.shipping_address && (
            <div className="px-4 py-2.5 flex items-center gap-2 text-[11px] text-slate-500">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{order.shipping_address}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========================
// Main Account Page
// ========================
export default function AccountPage() {
  const {
    currentUser,
    orders,
    storeSettings,
    logout,
    openAccountModalWithTab,
    fetchCustomerOrders,
    staffMembers,
    customRoles,
    customerChangeSalesRep,
  } = useStore();

  // Filter available sales reps for customer selection
  const availableReps = useMemo(() => {
    const list = staffMembers.filter((s) => {
      if (s.is_active === false) return false;
      if (s.role === 'sales_agent') return true;
      if (s.custom_role?.can_receive_customers) return true;
      const cRole = customRoles.find((r) => r.id === s.custom_role_id);
      if (cRole?.can_receive_customers) return true;
      return s.role === 'admin';
    });
    if (list.length > 0) return list;
    return [DEFAULT_STICKY_SALES_REP];
  }, [staffMembers, customRoles]);

  const [isChangingRep, setIsChangingRep] = useState(false);
  const [changeRepMode, setChangeRepMode] = useState<'auto' | 'custom'>('custom');
  const [changeRepSelectedId, setChangeRepSelectedId] = useState<string>('');
  const [changeRepLoading, setChangeRepLoading] = useState(false);
  const [changeRepMessage, setChangeRepMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch orders on mount if user is logged in
  useEffect(() => {
    if (currentUser) {
      fetchCustomerOrders(currentUser.id);
    }
  }, [currentUser, fetchCustomerOrders]);

  // Filter orders for this customer only
  const myOrders = useMemo(
    () =>
      orders
        .filter((o) => o.customer_id === currentUser?.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders, currentUser]
  );

  const totalSpent = useMemo(
    () =>
      myOrders
        .filter((o) => o.status !== 'returned')
        .reduce((sum, o) => sum + Number(o.total_amount), 0),
    [myOrders]
  );

  // Rep contact info
  const hasRep = !!currentUser?.assigned_sales_rep_id;
  const repPhone = currentUser?.assigned_sales_rep_phone;
  const repName = currentUser?.assigned_sales_rep_name;
  const waPhone = hasRep && repPhone
    ? repPhone.replace(/\D/g, '')
    : storeSettings.whatsapp_number?.replace(/\D/g, '') || '';
  const waMessage = hasRep
    ? `مرحباً ${repName}، أنا ${currentUser?.full_name} عميلك المسجل. أريد الاستفسار.`
    : storeSettings.whatsapp_message || 'مرحباً، أريد الاستفسار';

  // ---- Not logged in ----
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#0099DD]/10 text-[#0099DD] flex items-center justify-center mx-auto">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">حسابي</h1>
            <p className="text-sm text-slate-500 mt-1">
              سجّل دخولك لمتابعة طلباتك وبيانات مندوبك المعتمد.
            </p>
          </div>
          <button
            onClick={() => openAccountModalWithTab('login')}
            className="w-full bg-[#0099DD] hover:bg-[#007BB3] text-white py-3 rounded-xl font-bold text-sm transition shadow-sm"
          >
            تسجيل الدخول برقم الهاتف
          </button>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1">
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            العودة للمتجر
          </Link>
        </div>
      </main>
    );
  }

  // ---- Logged in ----
  return (
    <main className="min-h-screen bg-slate-50 pb-12" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-sky-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] text-sky-300 font-bold mb-1 tracking-wide uppercase">
              MH EL MAHDY — حسابي
            </div>
            <h1 className="text-2xl font-black">{currentUser.full_name}</h1>
            {currentUser.company_name && (
              <div className="flex items-center gap-1.5 text-slate-300 text-sm mt-1">
                <Building className="w-3.5 h-3.5" />
                {currentUser.company_name}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1">
              <Phone className="w-3 h-3" />
              <span dir="ltr">{currentUser.phone}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-bold transition mt-1"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-6 -mt-4">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <div className="text-2xl font-black text-slate-900">{myOrders.length}</div>
            <div className="text-[11px] text-slate-500 font-bold mt-0.5">إجمالي الطلبات</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <div className="text-2xl font-black text-emerald-600">
              {myOrders.filter((o) => o.status === 'delivered').length}
            </div>
            <div className="text-[11px] text-slate-500 font-bold mt-0.5">طلبات مسلّمة</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <div className="text-lg font-black text-[#0099DD] font-mono leading-tight">
              {totalSpent.toLocaleString('ar-EG', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-slate-500 font-bold mt-0.5">إجمالي المشتريات (ج.م)</div>
          </div>
        </div>

        {/* Sales rep card */}
        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${
          hasRep ? 'bg-sky-50/70 border-sky-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              hasRep ? 'bg-[#0099DD] text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              <Phone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-bold">مندوب المبيعات المعتمد</span>
                {currentUser?.assignment_type === 'customer_choice' ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    باختيارك
                  </span>
                ) : (
                  <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full">
                    توزيع عادل
                  </span>
                )}
              </div>
              <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                {hasRep ? repName : 'لم يتم تعيين مندوب بعد'}
              </div>
              {hasRep && repPhone && (
                <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">{repPhone}</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsChangingRep(!isChangingRep);
                  setChangeRepMessage(null);
                  if (currentUser?.assigned_sales_rep_id) {
                    setChangeRepSelectedId(currentUser.assigned_sales_rep_id);
                    setChangeRepMode('custom');
                  }
                }}
                className="px-3 py-2 text-xs font-bold text-[#0099DD] bg-white hover:bg-sky-100/50 border border-sky-300 rounded-xl transition cursor-pointer shadow-xs"
              >
                {isChangingRep ? 'إغلاق الاختيار' : 'تغيير المندوب'}
              </button>
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  واتساب
                </a>
              )}
            </div>
          </div>

          {/* Collapsible Rep Selector */}
          {isChangingRep && (
            <div className="bg-white border border-sky-200 rounded-xl p-4 space-y-3 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#0099DD]" />
                <span>اختر كيفية تعيين مندوب المبيعات المعتمد لك:</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChangeRepMode('auto')}
                  className={`p-3 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                    changeRepMode === 'auto'
                      ? 'border-[#0099DD] bg-sky-50 text-[#0099DD] font-bold ring-1 ring-[#0099DD]'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold">توزيع عادل تلقائي</span>
                  <span className="text-[10px] text-slate-500 mt-1">إسناد للمندوب الأقل تشغيلاً بالتكافؤ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setChangeRepMode('custom');
                    if (!changeRepSelectedId && availableReps.length > 0) {
                      setChangeRepSelectedId(availableReps[0].id);
                    }
                  }}
                  className={`p-3 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                    changeRepMode === 'custom'
                      ? 'border-[#0099DD] bg-sky-50 text-[#0099DD] font-bold ring-1 ring-[#0099DD]'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold">اختيار مندوب محدد</span>
                  <span className="text-[10px] text-slate-500 mt-1">تحديد المندوب بالاسم من قائمة المناديب</span>
                </button>
              </div>

              {changeRepMode === 'custom' && (
                <div className="space-y-1 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    قائمة المناديب المعتمدين:
                  </label>
                  <select
                    value={changeRepSelectedId}
                    onChange={(e) => setChangeRepSelectedId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium focus:outline-none focus:border-[#0099DD] cursor-pointer"
                  >
                    {availableReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.full_name} {rep.phone ? `(${rep.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {changeRepMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  changeRepMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{changeRepMessage.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={changeRepLoading}
                  onClick={async () => {
                    setChangeRepLoading(true);
                    setChangeRepMessage(null);
                    const targetId = changeRepMode === 'custom' ? changeRepSelectedId : undefined;
                    const res = await customerChangeSalesRep(targetId);
                    setChangeRepLoading(false);
                    if (res.success) {
                      setChangeRepMessage({ type: 'success', text: res.message || 'تم تحديث مندوبك بنجاح' });
                      setTimeout(() => {
                        setIsChangingRep(false);
                        setChangeRepMessage(null);
                      }, 1500);
                    } else {
                      setChangeRepMessage({ type: 'error', text: res.message || 'حدث خطأ أثناء حفظ الاختيار' });
                    }
                  }}
                  className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {changeRepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>حفظ وتأكيد الاختيار</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangingRep(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Orders list */}
        <div>
          <h2 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0099DD]" />
            طلباتي
          </h2>

          {myOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
              <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-bold">لا توجد طلبات بعد</p>
              <p className="text-slate-400 text-xs mt-1">ابدأ تصفح الكتالوج وأضف منتجاتك للسلة.</p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
              >
                تصفح الكتالوج
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        {/* Address if available */}
        {(currentUser.city || currentUser.address) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              عنوان الشحن المعتمد
            </div>
            <div className="text-sm text-slate-700 font-semibold">
              {[currentUser.address, currentUser.city].filter(Boolean).join(' — ')}
            </div>
          </div>
        )}

        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          العودة للمتجر
        </Link>
      </div>
    </main>
  );
}
