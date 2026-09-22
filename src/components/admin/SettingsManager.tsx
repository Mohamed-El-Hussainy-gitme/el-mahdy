'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Store,
  Phone,
  MessageCircle,
  Share2,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Clock,
  Truck,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { UserRole, UserProfile, StoreSettings, CustomRole } from '@/types';
import { canManageSettings } from '@/services/authService';

interface SettingsManagerProps {
  currentRole: UserRole;
  staffProfile?: UserProfile | null;
  customRoles?: CustomRole[];
}

export function SettingsManager({ currentRole, staffProfile }: SettingsManagerProps) {
  const { storeSettings, updateStoreSettings, refreshData, customRoles, isLoading } = useStore();
  const [formState, setFormState] = useState<StoreSettings>(storeSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setFormState(storeSettings);
  }, [storeSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: name === 'default_moq' ? Number(value) : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await updateStoreSettings(formState);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  const handleSyncDatabase = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  if (!canManageSettings(currentRole, staffProfile, customRoles)) {

    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>عذراً، ليس لديك الصلاحية للوصول إلى إعدادات المتجر.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#0099DD]" />
          <span>إعدادات النظام العامة (Store Settings)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          إدارة إعدادات واجهة المتجر الأساسية، وسائل التواصل، الحد الأدنى للطلب، وإشعارات النظام.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>تم حفظ إعدادات المتجر بنجاح.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <form id="settings-form" onSubmit={handleSave} className="space-y-6 text-xs">
            
            {/* Section 1: بيانات المتجر الأساسية */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <Store className="w-4 h-4 text-[#0099DD]" />
                <span>بيانات المتجر الأساسية</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المتجر / العلامة التجارية</label>
                  <input
                    type="text"
                    name="store_name"
                    value={formState.store_name || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الشعار النصي (Tagline)</label>
                  <textarea
                    name="tagline"
                    value={formState.tagline || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: معلومات التواصل والعنوان */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <MapPin className="w-4 h-4 text-[#0099DD]" />
                <span>معلومات التواصل والعنوان</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">العنوان الرئيسي</label>
                  <input
                    type="text"
                    name="address"
                    value={formState.address || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم هاتف الدعم الفني</label>
                  <input
                    type="text"
                    name="phone"
                    value={formState.phone || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">مواعيد العمل</label>
                  <input
                    type="text"
                    name="working_hours"
                    value={formState.working_hours || ''}
                    onChange={handleChange}
                    placeholder="مثال: من 10 صباحاً إلى 10 مساءً"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: إعدادات الواتساب */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <MessageCircle className="w-4 h-4 text-[#0099DD]" />
                <span>إعدادات الواتساب</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم الواتساب (للتواصل السريع)</label>
                  <input
                    type="text"
                    name="whatsapp_number"
                    value={formState.whatsapp_number || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الرسالة الافتراضية</label>
                  <textarea
                    name="whatsapp_message"
                    value={formState.whatsapp_message || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: منصات التواصل الاجتماعي */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <Share2 className="w-4 h-4 text-[#0099DD]" />
                <span>منصات التواصل الاجتماعي</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رابط الفيسبوك</label>
                  <input type="url" name="facebook_url" value={formState.facebook_url || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رابط الانستجرام</label>
                  <input type="url" name="instagram_url" value={formState.instagram_url || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رابط التيك توك</label>
                  <input type="url" name="tiktok_url" value={formState.tiktok_url || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رابط التليجرام</label>
                  <input type="url" name="telegram_url" value={formState.telegram_url || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">رابط اليوتيوب</label>
                  <input type="url" name="youtube_url" value={formState.youtube_url || ''} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
                </div>
              </div>
            </div>

            {/* Section 5: إعلان عام وإعدادات تشغيلية */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <Bell className="w-4 h-4 text-[#0099DD]" />
                <span>إعلان عام وإعدادات تشغيلية</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">إعلان شريط الأخبار (يظهر أعلى المتجر)</label>
                  <textarea
                    name="announcement"
                    value={formState.announcement || ''}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الحد الأدنى لكمية الطلب (MOQ)</label>
                  <input
                    type="number"
                    name="default_moq"
                    min="1"
                    value={formState.default_moq || 5}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يستخدم كقيمة افتراضية عند إضافة منتجات جديدة أو عند عدم تحديد كمية مخصصة.
                  </span>
                </div>
              </div>
            </div>

            {/* B2B Delivery Promises Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
                <Truck className="w-4 h-4 text-[#0099DD]" />
                <span>وعود الشحن والتوصيل (B2B Delivery Promises في الهيدر)</span>
              </h3>
              <p className="text-xs text-slate-500">
                هذه النصوص تظهر للعملاء في نافذة الشحن والتسليم أعلى المتجر. يمكنك تخصيصها لتطابق واقع التشغيل الفعلي.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وعد التوصيل الأول (نطاق الخدمة)</label>
                  <input
                    type="text"
                    name="delivery_promise_1"
                    value={formState.delivery_promise_1 || ''}
                    onChange={handleChange}
                    placeholder="توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وعد التوصيل الثاني (آلية التجهيز والشحن)</label>
                  <input
                    type="text"
                    name="delivery_promise_2"
                    value={formState.delivery_promise_2 || ''}
                    onChange={handleChange}
                    placeholder="تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وعد التوصيل الثالث (البوليصة والمتابعة)</label>
                  <input
                    type="text"
                    name="delivery_promise_3"
                    value={formState.delivery_promise_3 || ''}
                    onChange={handleChange}
                    placeholder="إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-6 py-3 rounded-xl font-bold shadow-sm transition"
              >
                <Save className="w-5 h-5" />
                <span className="text-sm">حفظ التغييرات</span>
              </button>
            </div>
          </form>
        </div>

        {/* Database & Supabase Diagnostics Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b pb-3">
              <Database className="w-4 h-4 text-[#0099DD]" />
              <span>حالة الاتصال ومزامنة البيانات</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600 font-bold">اتصال Supabase:</span>
                {isSupabaseConfigured() ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>متصل ويعمل</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>غير متصل بالخادم</span>
                  </span>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSyncDatabase}
                  disabled={isRefreshing || isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'جاري المزامنة...' : 'مزامنة البيانات يدوياً'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
