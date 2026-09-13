'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { staffSession, staffLogin } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect directly to /admin
  useEffect(() => {
    if (staffSession) {
      router.push('/admin');
    }
  }, [staffSession, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const res = await staffLogin(email, password);
    if (res.success) {
      router.push('/admin');
    } else {
      setErrorMsg(res.message || 'فشل تسجيل الدخول');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 font-cairo selection:bg-[#0099DD] selection:text-white">
      {/* Container */}
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-[#0099DD] items-center justify-center">
            <Image
              src="/logo.png"
              alt="MH EL MAHDY Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">
              بوابة الدخول الإدارية | MH EL MAHDY
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              نظام التشغيل وإدارة المستودع والطلبات B2B
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1.5">
              البريد الإلكتروني أو رقم الهاتف
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@elmahdy.com"
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-[#0099DD] rounded-xl px-3.5 py-2.5 pl-9 text-slate-100 placeholder-slate-500 focus:outline-none transition"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1.5">
              كلمة المرور الإدارية
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-[#0099DD] rounded-xl px-3.5 py-2.5 pl-9 text-slate-100 placeholder-slate-500 focus:outline-none transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0099DD] hover:bg-[#007BB3] text-white py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 mt-2"
          >
            <Shield className="w-4 h-4" />
            <span>{isLoading ? 'جاري التحقق...' : 'دخول لوحة التحكم'}</span>
          </button>
        </form>

        {/* Back to store */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>الرجوع إلى المتجر</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
