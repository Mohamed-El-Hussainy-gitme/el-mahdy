'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 shadow-xl space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-extrabold text-slate-900">حدث خطأ غير متوقع</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            واجه النظام خطأ مؤقتاً أثناء معالجة البيانات. يمكنك إعادة المحاولة أو العودة للصفحة الرئيسية.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5 text-xs">
          <button
            onClick={() => reset()}
            className="w-full bg-[#0099DD] hover:bg-[#007BB3] text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة تحميل الصفحة</span>
          </button>
          <Link
            href="/"
            className="w-full border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>العودة للمتجر الرئيسي</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
