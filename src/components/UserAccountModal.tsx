'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  User,
  UserCheck,
  UserPlus,
  Package,
  HelpCircle,
  Download,
  Phone,
  Building,
  LogIn,
  LogOut,
  AlertCircle,
  Loader2,
  RefreshCw,
  Heart,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function UserAccountModal() {
  const {
    isAccountModalOpen,
    setIsAccountModalOpen,
    currentUser,
    loginCustomer,
    registerCustomer,
    fetchCustomerOrders,
    cancelCustomerOrder,
    logout,
    orders,
    storeSettings,
    setIsShortageModalOpen,
    accountModalTab,
    setAccountModalTab,
    wishlist,
    setIsWishlistOpen,
    staffMembers,
    customRoles,
  } = useStore();

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [preferredRepMode, setPreferredRepMode] = useState<'auto' | 'custom'>('auto');
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Filter available sales reps for direct customer choice
  const availableReps = React.useMemo(() => {
    return staffMembers.filter((s) => {
      if (s.is_active === false) return false;
      if (s.role === 'sales_agent') return true;
      if (s.custom_role?.can_receive_customers) return true;
      const cRole = customRoles.find((r) => r.id === s.custom_role_id);
      if (cRole?.can_receive_customers) return true;
      return s.role === 'admin';
    });
  }, [staffMembers, customRoles]);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Auto-fetch customer orders when opening the orders tab
  React.useEffect(() => {
    if (accountModalTab === 'orders' && currentUser?.id && currentUser?.phone) {
      setIsRefreshingOrders(true);
      fetchCustomerOrders(currentUser.id, currentUser.phone).finally(() => {
        setIsRefreshingOrders(false);
      });
    }
  }, [accountModalTab, currentUser?.id, currentUser?.phone, fetchCustomerOrders]);

  // PWA install
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  React.useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstalled(true);
      }
    } else if (isInstalled) {
      alert('تطبيق MH EL MAHDY مثبت بالفعل على هذا الجهاز.');
    } else {
      const isIOS =
        typeof navigator !== 'undefined' &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;
      if (isIOS) {
        alert(
          'لتثبيت التطبيق على iPhone / iPad:\nاضغط على أيقونة المشاركة (Share) أسفل الشاشة، ثم اختر "إضافة إلى الصفحة الرئيسية" (Add to Home Screen).'
        );
      } else {
        alert(
          'لتثبيت التطبيق على جهازك:\nيمكنك التثبيت مباشرة من شريط عنوان المتصفح أو بالضغط على خيارات المتصفح (⋮) واختيار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
        );
      }
    }
  };

  if (!isAccountModalOpen) return null;

  // Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const result = await loginCustomer(loginPhone);
    setLoginLoading(false);
    if (result.success) {
      setLoginPhone('');
      setAccountModalTab('menu');
    } else {
      setLoginError(result.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    const targetRepId = preferredRepMode === 'custom' && selectedSalesRepId ? selectedSalesRepId : undefined;
    const result = await registerCustomer(regName, regPhone, regCompany, undefined, targetRepId);
    setRegLoading(false);
    if (result.success) {
      setRegName('');
      setRegPhone('');
      setRegCompany('');
      setPreferredRepMode('auto');
      setSelectedSalesRepId('');
      setAccountModalTab('menu');
    } else {
      setRegError(result.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    }
  };

  const userOrders = currentUser ? orders.filter((o) => o.customer_id === currentUser.id) : [];

  const inputCls =
    'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#0099DD] focus:ring-1 focus:ring-[#0099DD]/30 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#38bdf8]" />
            <div>
              <h3 className="font-bold text-sm">حسابي</h3>
              <p className="text-[11px] text-slate-300">
                {currentUser
                  ? `أهلاً بك، ${currentUser.full_name}`
                  : 'سجل الدخول للوصول إلى طلباتك'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAccountModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">

          {/* ═══ MENU TAB ═══ */}
          {accountModalTab === 'menu' && (
            <div className="space-y-4 text-sm">
              {currentUser ? (
                <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#0099DD]" />
                      {currentUser.full_name}
                    </span>
                    <button
                      onClick={logout}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      خروج
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {currentUser.phone}
                    </p>
                    {currentUser.company_name && (
                      <p className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        {currentUser.company_name}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-sky-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600">المندوب المعتمد الدائم:</span>
                    <span className="font-bold text-[#0099DD]">
                      {currentUser.assigned_sales_rep_name || 'سيتم تعيينه مع أول طلب'}
                    </span>
                  </div>
                </div>
              ) : (
                /* Two separate CTAs for guest */
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setLoginError(''); setAccountModalTab('login'); }}
                    className="flex flex-col items-center justify-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white py-3.5 px-3 rounded-xl font-bold shadow-sm transition"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="text-xs">تسجيل الدخول</span>
                  </button>
                  <button
                    onClick={() => { setRegError(''); setAccountModalTab('register'); }}
                    className="flex flex-col items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white py-3.5 px-3 rounded-xl font-bold shadow-sm transition"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="text-xs">إنشاء حساب جديد</span>
                  </button>
                </div>
              )}

              {/* Menu items */}
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!currentUser) {
                      setLoginError('');
                      setAccountModalTab('login');
                    } else {
                      setAccountModalTab('orders');
                    }
                  }}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-[#0099DD]" />
                    <span className="font-medium">تتبع طلباتي</span>
                  </div>
                  <span className="text-xs text-slate-400">›</span>
                </button>

                <button
                  onClick={() => {
                    setIsAccountModalOpen(false);
                    setIsWishlistOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span className="font-medium">قائمة مفضلاتي</span>
                  </div>
                  {wishlist.length > 0 ? (
                    <span className="text-xs bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full">
                      {wishlist.length}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">›</span>
                  )}
                </button>

                <button
                  onClick={() => setIsShortageModalOpen(true)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-[#0099DD]" />
                    <span className="font-medium">تسجيل نواقص الكتالوج</span>
                  </div>
                  <span className="text-xs text-slate-400">›</span>
                </button>

                <a
                  href={
                    currentUser?.assigned_sales_rep_id && currentUser.assigned_sales_rep_phone
                      ? `https://wa.me/${currentUser.assigned_sales_rep_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `السلام عليكم، أتواصل معك بصفتك مندوبي المعتمد (${currentUser.assigned_sales_rep_name || 'مندوبي'}) في متجر MH EL MAHDY.`
                        )}`
                      : `https://wa.me/${(storeSettings.whatsapp_number || '201012345678').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          storeSettings.whatsapp_message || 'السلام عليكم، أحتاج مساعدة أو استفسار بخصوص منتجات متجر المهدي'
                        )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium">
                      {currentUser?.assigned_sales_rep_id
                        ? `تواصل مع مندوبك (${currentUser.assigned_sales_rep_name})`
                        : 'خدمة العملاء والتواصل (واتساب)'}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold">متاح</span>
                </a>
              </div>

              {/* Quick links */}
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-400 mb-2">روابط سريعة</div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 text-xs text-slate-700 font-semibold cursor-pointer transition text-right"
                  >
                    <Download className="w-4 h-4 text-[#0099DD]" />
                    <span>تثبيت التطبيق على الهاتف (PWA)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LOGIN TAB ═══ */}
          {accountModalTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="text-center pb-1">
                <div className="w-12 h-12 bg-[#0099DD]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <LogIn className="w-6 h-6 text-[#0099DD]" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">تسجيل الدخول</h4>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل رقم هاتفك للوصول إلى حسابك وطلباتك
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف / الواتساب *
                </label>
                <input
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => { setLoginPhone(e.target.value); setLoginError(''); }}
                  placeholder="مثال: 01012345678"
                  className={inputCls}
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{loginError}</p>
                    {loginError.includes('إنشاء حساب') && (
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError('');
                          setRegPhone(loginPhone);
                          setRegError('');
                          setAccountModalTab('register');
                        }}
                        className="mt-1 font-bold underline text-red-700 hover:text-red-900"
                      >
                        إنشاء حساب جديد ←
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold shadow transition flex items-center justify-center gap-2"
                >
                  {loginLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <LogIn className="w-4 h-4" />}
                  دخول
                </button>
                <button
                  type="button"
                  onClick={() => setAccountModalTab('menu')}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold transition"
                >
                  رجوع
                </button>
              </div>

              <p className="text-center text-xs text-slate-500">
                ليس لديك حساب؟{' '}
                <button
                  type="button"
                  onClick={() => { setLoginError(''); setRegError(''); setAccountModalTab('register'); }}
                  className="text-[#0099DD] font-bold hover:underline"
                >
                  إنشاء حساب جديد
                </button>
              </p>
            </form>
          )}

          {/* ═══ REGISTER TAB ═══ */}
          {accountModalTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-12 h-12 bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="w-6 h-6 text-slate-800" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">إنشاء حساب جديد</h4>
                <p className="text-xs text-slate-500 mt-1">
                  الموقع مخصص للأنشطة التجارية. التسجيل إلزامي لتأكيد الطلبات.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                  placeholder="مثال: محمد السيد"
                  className={inputCls}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف / الواتساب *
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => { setRegPhone(e.target.value); setRegError(''); }}
                  placeholder="مثال: 01012345678"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المحل أو الشركة
                </label>
                <input
                  type="text"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  placeholder="مثال: محل المهدي للاتصالات"
                  className={inputCls}
                />
              </div>

              {/* Sales Representative Preference */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    مندوب المبيعات المسؤول
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredRepMode('auto');
                      setSelectedSalesRepId('');
                    }}
                    className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                      preferredRepMode === 'auto'
                        ? 'border-[#0099DD] bg-sky-50/70 text-[#0099DD] ring-1 ring-[#0099DD]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${preferredRepMode === 'auto' ? 'bg-[#0099DD]' : 'bg-slate-300'}`} />
                      بدون مندوب محدد
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">توزيع عادل وتعيين فوري</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreferredRepMode('custom');
                      if (!selectedSalesRepId && availableReps.length > 0) {
                        setSelectedSalesRepId(availableReps[0].id);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                      preferredRepMode === 'custom'
                        ? 'border-[#0099DD] bg-sky-50/70 text-[#0099DD] ring-1 ring-[#0099DD]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${preferredRepMode === 'custom' ? 'bg-[#0099DD]' : 'bg-slate-300'}`} />
                      طلب مندوب معين
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">اختيار المندوب بالاسم</span>
                  </button>
                </div>

                {preferredRepMode === 'custom' && (
                  <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      قائمة المناديب المعتمدين:
                    </label>
                    <select
                      value={selectedSalesRepId}
                      onChange={(e) => setSelectedSalesRepId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:border-[#0099DD] focus:ring-1 focus:ring-[#0099DD]/30 cursor-pointer"
                    >
                      {availableReps.length === 0 ? (
                        <option value="">لا يوجد مناديب متاحين حالياً (سيتم التوزيع تلقائياً)</option>
                      ) : (
                        availableReps.map((rep) => (
                          <option key={rep.id} value={rep.id}>
                            {rep.full_name} {rep.phone ? `(${rep.phone})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>

              {regError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{regError}</p>
                    {regError.includes('مسجل مسبقاً') && (
                      <button
                        type="button"
                        onClick={() => {
                          setRegError('');
                          setLoginPhone(regPhone);
                          setLoginError('');
                          setAccountModalTab('login');
                        }}
                        className="mt-1 font-bold underline text-red-700 hover:text-red-900"
                      >
                        تسجيل الدخول ←
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={regLoading}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold shadow transition flex items-center justify-center gap-2"
                >
                  {regLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <UserPlus className="w-4 h-4" />}
                  إنشاء الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setAccountModalTab('menu')}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold transition"
                >
                  رجوع
                </button>
              </div>

              <p className="text-center text-xs text-slate-500">
                لديك حساب بالفعل؟{' '}
                <button
                  type="button"
                  onClick={() => { setRegError(''); setLoginError(''); setAccountModalTab('login'); }}
                  className="text-[#0099DD] font-bold hover:underline"
                >
                  تسجيل الدخول
                </button>
              </p>
            </form>
          )}

          {/* ═══ ORDERS TAB ═══ */}
          {accountModalTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">تتبع طلباتي السابقة</h4>
                  <button
                    type="button"
                    title="تحديث الطلبات"
                    onClick={() => {
                      if (currentUser?.id && currentUser?.phone) {
                        setIsRefreshingOrders(true);
                        fetchCustomerOrders(currentUser.id, currentUser.phone).finally(() => {
                          setIsRefreshingOrders(false);
                        });
                      }
                    }}
                    className="text-slate-400 hover:text-[#0099DD] transition p-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingOrders ? 'animate-spin text-[#0099DD]' : ''}`} />
                  </button>
                </div>
                <button
                  onClick={() => setAccountModalTab('menu')}
                  className="text-xs text-[#0099DD] font-semibold hover:underline"
                >
                  رجوع للقائمة
                </button>
              </div>

              {userOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>لا توجد طلبات مسجلة حتى الآن</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userOrders.map((ord) => (
                    <div key={ord.id} className="border border-slate-200 rounded-xl p-3 text-xs space-y-2 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{ord.order_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : ord.status === 'preparation'
                              ? 'bg-blue-100 text-blue-700'
                              : ord.status === 'shipping'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {ord.status === 'pending' && 'قيد المراجعة'}
                          {ord.status === 'preparation' && 'قيد التجهيز'}
                          {ord.status === 'shipping' && 'تم الشحن'}
                          {ord.status === 'delivered' && 'تم التسليم'}
                          {ord.status === 'returned' && 'مرتجع'}
                        </span>
                      </div>

                      <div className="text-slate-500 text-[11px] flex items-center justify-between">
                        <span>{ord.created_at}</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {ord.total_amount.toFixed(2)} ج.م
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100 space-y-1">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="truncate max-w-[200px]">
                              {it.product_title} {it.model_name ? `(${it.model_name})` : ''}
                            </span>
                            <span>{it.quantity} × {it.unit_price} ج.م</span>
                          </div>
                        ))}
                      </div>

                      {ord.tracking_notes && (
                        <div className="text-[11px] text-purple-700 font-medium">
                          تتبع الشحن: {ord.tracking_notes}
                        </div>
                      )}

                      {ord.status === 'pending' && (
                        <div className="pt-2 mt-1 border-t border-slate-200/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">الطلب قيد المراجعة ويمكنك إلغاؤه الآن</span>
                          <button
                            type="button"
                            disabled={cancellingOrderId === ord.id}
                            onClick={async () => {
                              if (confirm(`هل ترغب بالتأكيد في إلغاء طلبك رقم (${ord.order_number})؟`)) {
                                setCancellingOrderId(ord.id);
                                const res = await cancelCustomerOrder(ord.id);
                                setCancellingOrderId(null);
                                alert(res.message);
                              }
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50 transition"
                          >
                            {cancellingOrderId === ord.id ? 'جاري الإلغاء...' : 'إلغاء الطلب'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
