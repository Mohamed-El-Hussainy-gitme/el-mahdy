import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, ArrowRight, Phone } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 shadow-xl space-y-5">
        <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-[#0099DD] flex items-center justify-center">
          <Image src="/logo.png" alt="MH EL MAHDY" fill className="object-cover" priority />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-black text-[#0099DD] block">404</span>
          <h1 className="text-lg font-extrabold text-slate-900">الصفحة المطلوبة غير موجودة</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            عذراً، الرابط الذي تحاول الوصول إليه غير متاح أو تم نقله. يمكنك العودة إلى كتالوج المنتجات الرئيسي.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5 text-xs">
          <Link
            href="/"
            className="w-full bg-[#0099DD] hover:bg-[#007BB3] text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>العودة للمتجر والكتالوج</span>
          </Link>
          <a
            href="https://wa.me/201012345678"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>التواصل مع الدعم الفني والمبيعات</span>
          </a>
        </div>
      </div>
    </div>
  );
}
