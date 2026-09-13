'use client';

import React, { useState } from 'react';
import { X, HelpCircle, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function ShortageModal() {
  const { isShortageModalOpen, setIsShortageModalOpen, submitShortage, currentUser } = useStore();
  const [brand, setBrand] = useState('Apple');
  const [modelName, setModelName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isShortageModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !modelName.trim()) return;

    try {
      setIsSubmitting(true);
      await submitShortage(brand, modelName.trim(), notes.trim());
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setIsShortageModalOpen(false);
        setModelName('');
        setNotes('');
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#38bdf8]" />
            <div>
              <h3 className="font-bold text-sm">تسجيل نواقص الكتالوج</h3>
              <p className="text-[11px] text-slate-300">
                طلب إضافة منتج أو موديل غير متوفر حالياً
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsShortageModalOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-900 text-sm">تم تسجيل طلب النواقص بنجاح</h4>
              <p className="text-xs text-slate-500">
                تم إرسال تنبيه داخلي للإدارة لدراسة توفير هذا الصنف في أقرب وقت.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-slate-700 space-y-1">
                <p className="font-bold text-[#0099DD] flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> نظام المتابعة الإدارية
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  إذا كنت تبحث عن سكرين أو جراب أو ملحق لموديل معين غير موجود بالقائمة، سجله هنا وسيصل مباشرة إلى إدارة التوريد.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الماركة / البراند *</label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#0099DD] bg-white text-xs font-semibold"
                >
                  <option value="Apple">Apple / iPhone</option>
                  <option value="Samsung">Samsung</option>
                  <option value="Xiaomi">Xiaomi / Redmi</option>
                  <option value="Oppo">Oppo</option>
                  <option value="Realme">Realme</option>
                  <option value="Infinix">Infinix</option>
                  <option value="Huawei">Huawei</option>
                  <option value="Honor">Honor</option>
                  <option value="Other">ماركة أخرى</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الموديل المطلوب بالتحديد *</label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="مثال: iPhone 16 Pro Max سكرين خصوصية"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#0099DD] text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية التقريبية المتوقعة أو ملاحظاتك</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: أحتاج 100 حبة أسبوعياً لمحل..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#0099DD] text-xs"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'جاري الإرسال...' : 'إرسال للإدارة'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsShortageModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-semibold transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
