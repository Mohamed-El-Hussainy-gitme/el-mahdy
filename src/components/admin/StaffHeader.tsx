'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Smartphone, Phone, LogOut, ArrowRight, Database } from 'lucide-react';
import { UserProfile } from '@/types';
import { getRoleTitleAr } from '@/services/authService';

interface StaffHeaderProps {
  staffSession: UserProfile;
  isSupabaseConfigured: boolean;
  onLogout: () => void;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staffSession,
  isSupabaseConfigured,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center bg-[#0099DD]">
              <Image
                src="/logo.png"
                alt="MH EL MAHDY Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-lg">MH EL MAHDY</span>
                <span className="bg-[#0099DD]/10 text-[#0099DD] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#0099DD]/20">
                  لوحة التحكم الإدارية
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">نظام إدارة العمليات والطلبات والمخزون B2B</p>
            </div>
          </Link>
        </div>

        {/* Staff Identity & Role Indicator */}
        <div className="flex items-center gap-3">
          {/* Database indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isSupabaseConfigured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseConfigured ? 'قاعدة البيانات متصلة' : 'غير متصل بقاعدة البيانات'}</span>
          </div>

          {/* User profile capsule */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0099DD] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 leading-tight">{staffSession.full_name}</p>
              <p className="text-[11px] font-semibold text-[#0099DD] leading-tight">
                {getRoleTitleAr(staffSession.role)}
              </p>
            </div>
          </div>

          {/* Return to Store */}
          <Link
            href="/"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-500" />
            <span>معاينة المتجر</span>
          </Link>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold border border-rose-200 transition"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
};
