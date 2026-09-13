'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  UserPlus,
  Key,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { useStore } from '@/context/StoreContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getRoleTitleAr } from '@/services/authService';

interface StaffManagerProps {
  currentRole: UserRole;
}

export function StaffManager({ currentRole }: StaffManagerProps) {
  const { staffSession } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('sales_agent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = currentRole === 'admin';

  const fetchStaffList = useCallback(async () => {
    setIsLoadingList(true);
    if (!isSupabaseConfigured()) { setIsLoadingList(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('role', ['admin', 'sales_agent', 'warehouse_preparer'])
        .order('created_at', { ascending: true });
      if (!error && data) setStaffList(data as UserProfile[]);
    } catch (err) {
      console.warn('Failed to fetch staff list:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchStaffList(); }, [fetchStaffList]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !password) {
      setFeedback({ type: 'error', message: 'يرجى إكمال جميع الحقول المطلوبة' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    const cleanEmail = email.trim() || `${phone.trim().replace(/\s/g, '')}@elmahdy.com`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setFeedback({ type: 'error', message: 'جلسة تسجيل الدخول غير متاحة، يرجى إعادة تسجيل الدخول كمدير' });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          role,
          password,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        setFeedback({
          type: 'error',
          message: resData.error || 'فشل إضافة الموظف، يرجى المحاولة مرة أخرى',
        });
      } else {
        setFeedback({ type: 'success', message: 'تم إضافة الموظف وتفعيل حسابه بنجاح.' });
        setFullName('');
        setEmail('');
        setPhone('');
        setPassword('');
        await fetchStaffList();
        setTimeout(() => {
          setIsModalOpen(false);
          setFeedback(null);
        }, 1800);
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'خطأ غير معروف' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (staff: UserProfile) => {
    if (!isSupabaseConfigured()) return;
    const newStatus = !staff.is_active;
    await supabase.from('user_profiles').update({ is_active: newStatus }).eq('id', staff.id);
    setStaffList((prev) => prev.map((s) => s.id === staff.id ? { ...s, is_active: newStatus } : s));
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">صلاحية إدارية خاصة</h2>
        <p className="text-xs text-slate-500">إدارة الموظفين مقتصرة حصراً على مدير النظام (Admin).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#0099DD]" />
            <span>إدارة الموظفين والصلاحيات (Staff &amp; RBAC)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">إدارة حسابات مناديب المبيعات ومسؤولي المستودع والإدارة العليا.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStaffList} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
            <UserPlus className="w-4 h-4" /><span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'مدير النظام (Admin)', color: 'rose', icon: <Key className="w-4 h-4 text-rose-600" />, desc: 'صلاحيات كاملة: تعديل الكتالوج، إدارة الموظفين، التسعير، واعتماد جميع مراحل الطلب.' },
          { label: 'مندوب مبيعات (Sales Agent)', color: 'sky', icon: <UserCheck className="w-4 h-4 text-sky-600" />, desc: 'تأكيد الطلبات ونقلها إلى التجهيز، ومتابعة النواقص والعملاء المرتبطين به.' },
          { label: 'مسؤول مستودع (Warehouse)', color: 'amber', icon: <Shield className="w-4 h-4 text-amber-600" />, desc: 'طباعة أذون الصرف، وتحديث حالة الطلبات إلى الشحن، وتسجيل بيانات البوليصة.' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black text-${card.color}-700 bg-${card.color}-50 px-2 py-0.5 rounded border border-${card.color}-200`}>{card.label}</span>
              {card.icon}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
          <span>قائمة موظفي النظام الحاليين ({staffList.length})</span>
          {isLoadingList && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
        {staffList.length === 0 && !isLoadingList ? (
          <div className="p-8 text-center text-xs text-slate-400">لا يوجد موظفون مسجلون في النظام. أضف موظفاً جديداً من الزر أعلاه.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3.5">اسم الموظف</th>
                  <th className="p-3.5">البريد الإلكتروني</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">الدور</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">تفعيل/تعطيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50/60 transition ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td className="p-3.5 font-bold text-slate-900">
                      {s.full_name}
                      {s.id === staffSession?.id && <span className="mr-2 text-[10px] bg-[#0099DD]/10 text-[#0099DD] px-1.5 py-0.5 rounded font-bold">أنت</span>}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{s.email || '-'}</td>
                    <td className="p-3.5 font-mono text-slate-700">{s.phone}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${s.role === 'admin' ? 'bg-rose-100 text-rose-800' : s.role === 'sales_agent' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                        {getRoleTitleAr(s.role)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {s.is_active !== false
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]"><CheckCircle2 className="w-3.5 h-3.5" /><span>نشط</span></span>
                        : <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]"><AlertTriangle className="w-3.5 h-3.5" /><span>معطل</span></span>}
                    </td>
                    <td className="p-3.5 text-center">
                      {s.id !== staffSession?.id ? (
                        <button onClick={() => handleToggleActive(s)} title={s.is_active !== false ? 'تعطيل' : 'تفعيل'} className="transition">
                          {s.is_active !== false ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-rose-400" />}
                        </button>
                      ) : <span className="text-slate-300 text-[10px]">حسابك</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0099DD]" /><span>إضافة موظف جديد</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            {feedback && (
              <div className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {feedback.message}
              </div>
            )}
            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">الاسم بالكامل *</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: حسام الدين كامل" className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الهاتف *</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010XXXXXXXX" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني (اختياري)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@elmahdy.com" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" />
                <p className="text-slate-400 mt-0.5">إذا تُرك فارغاً: هاتف@elmahdy.com</p>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">الدور والصلاحية *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-[#0099DD]">
                  <option value="sales_agent">مندوب مبيعات (Sales Agent)</option>
                  <option value="warehouse_preparer">مسؤول تجهيز ومستودع (Warehouse)</option>
                  <option value="admin">مدير نظام (Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">كلمة المرور *</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm disabled:opacity-50">
                  {isSubmitting ? 'جارٍ الإنشاء...' : 'حفظ الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
