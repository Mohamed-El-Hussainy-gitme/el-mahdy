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
  Edit3,
  Trash2,
  Lock,
  Phone,
  Mail,
  User,
  X,
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
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('sales_agent');

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('sales_agent');
  const [editPassword, setEditPassword] = useState('');

  // Delete State
  const [deletingStaff, setDeletingStaff] = useState<UserProfile | null>(null);

  // Feedback & Loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = currentRole === 'admin';

  // ── Fetch Staff List ────────────────────────────────────────────────────────
  const fetchStaffList = useCallback(async () => {
    setIsLoadingList(true);
    if (!isSupabaseConfigured()) {
      setIsLoadingList(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('role', ['admin', 'sales_agent', 'warehouse_preparer', 'warehouse'])
        .order('created_at', { ascending: true });

      if (!error && data) {
        setStaffList(data as UserProfile[]);
      }
    } catch (err) {
      console.warn('Failed to fetch staff list:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffList();
  }, [fetchStaffList]);

  // ── Helper to get Session Token ─────────────────────────────────────────────
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // ── Create New Staff ────────────────────────────────────────────────────────
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim() || !addPhone.trim() || !addPassword) {
      setFeedback({ type: 'error', message: 'يرجى إكمال جميع الحقول الإلزامية' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);

    const cleanEmail = addEmail.trim().toLowerCase();
    if (cleanEmail === 'admin@elmahdy.com') {
      setFeedback({
        type: 'error',
        message: 'لا يمكن استخدام بريد مدير النظام الرئيسي (admin@elmahdy.com) لإنشاء موظف جديد.',
      });
      return;
    }
    const finalEmail = cleanEmail || `${addPhone.trim().replace(/\s/g, '')}@elmahdy.com`;

    try {
      const token = await getAuthToken();
      if (!token) {
        setFeedback({ type: 'error', message: 'جلسة تسجيل الدخول غير صالحة، يرجى إعادة تسجيل الدخول كمدير' });
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
          fullName: addFullName.trim(),
          email: finalEmail,
          phone: addPhone.trim(),
          role: addRole,
          password: addPassword,
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
        setAddFullName('');
        setAddEmail('');
        setAddPhone('');
        setAddPassword('');
        await fetchStaffList();
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFeedback(null);
        }, 1500);
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Open Edit Modal ─────────────────────────────────────────────────────────
  const handleOpenEdit = (staff: UserProfile) => {
    setEditingStaff(staff);
    setEditFullName(staff.full_name);
    setEditPhone(staff.phone);
    const normalizedRole = (staff.role as string) === 'warehouse' ? 'warehouse_preparer' : (staff.role as UserRole);
    setEditRole(normalizedRole);
    setEditPassword('');
    setFeedback(null);
  };

  // ── Update Staff Member ─────────────────────────────────────────────────────
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (!editFullName.trim() || !editPhone.trim()) {
      setFeedback({ type: 'error', message: 'الاسم ورقم الهاتف مطلوبان' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setFeedback({ type: 'error', message: 'جلسة تسجيل الدخول غير صالحة' });
        setIsSubmitting(false);
        return;
      }

      const payload: Record<string, any> = {
        id: editingStaff.id,
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        role: editRole,
      };

      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const response = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        setFeedback({
          type: 'error',
          message: resData.error || 'فشل تحديث بيانات الموظف',
        });
      } else {
        setFeedback({ type: 'success', message: 'تم تحديث بيانات وصلاحيات الموظف بنجاح.' });
        await fetchStaffList();
        setTimeout(() => {
          setEditingStaff(null);
          setFeedback(null);
        }, 1500);
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'حدث خطأ أثناء التحديث' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Staff Member ─────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setFeedback({ type: 'error', message: 'جلسة غير صالحة' });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/admin/staff?id=${deletingStaff.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        alert(resData.error || 'فشل حذف الموظف');
      } else {
        await fetchStaffList();
        setDeletingStaff(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Toggle Active Status ────────────────────────────────────────────────────
  const handleToggleActive = async (staff: UserProfile) => {
    if (!isSupabaseConfigured()) return;
    const newStatus = !staff.is_active;
    await supabase.from('user_profiles').update({ is_active: newStatus }).eq('id', staff.id);
    setStaffList((prev) => prev.map((s) => (s.id === staff.id ? { ...s, is_active: newStatus } : s)));
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">صلاحية إدارية خاصة</h2>
        <p className="text-xs text-slate-500">إدارة الموظفين والصلاحيات مقتصرة حصراً على مدير النظام (Admin).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#0099DD]" />
            <span>إدارة الموظفين والصلاحيات والأدوار</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إضافة، تعديل، مسح، وتغيير صلاحيات مناديب المبيعات ومسؤولي المستودع والمدراء.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStaffList}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            onClick={() => {
              setFeedback(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* 2. Roles Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'مدير النظام (Admin)',
            badge: 'bg-rose-50 text-rose-700 border-rose-200',
            icon: <Key className="w-4 h-4 text-rose-600" />,
            desc: 'صلاحيات كاملة: تعديل الكتالوج والأسعار، إضافة وحذف وتعديل الموظفين، إدارة إعدادات المتجر.',
          },
          {
            label: 'مندوب مبيعات (Sales Agent)',
            badge: 'bg-sky-50 text-sky-700 border-sky-200',
            icon: <UserCheck className="w-4 h-4 text-sky-600" />,
            desc: 'تأكيد طلبات العملاء ونقلها إلى التجهيز، مراجعة النواقص، والتواصل المباشر مع العملاء.',
          },
          {
            label: 'مسؤول المستودع (Warehouse)',
            badge: 'bg-amber-50 text-amber-700 border-amber-200',
            icon: <Shield className="w-4 h-4 text-amber-600" />,
            desc: 'تجهيز الشحنات، طباعة أذون الصرف وبوليصات الشحن، وتعديل جرد المخزون الفعلي.',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black px-2 py-0.5 rounded border ${card.badge}`}>{card.label}</span>
              {card.icon}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* 3. Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
          <span>قائمة الموظفين الحاليين ({staffList.length})</span>
          {isLoadingList && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
        {staffList.length === 0 && !isLoadingList ? (
          <div className="p-8 text-center text-xs text-slate-400">
            لا يوجد موظفون مسجلون في النظام. اضغط على زر &ldquo;إضافة موظف جديد&rdquo; بالأعلى.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3.5">اسم الموظف</th>
                  <th className="p-3.5">البريد الإلكتروني</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">الدور الوظيفي</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات والتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => {
                  const isCurrentLoggedUser = s.id === staffSession?.id;
                  const displayRole = (s.role as string) === 'warehouse' ? 'warehouse_preparer' : (s.role as UserRole);

                  return (
                    <tr key={s.id} className={`hover:bg-slate-50/60 transition ${!s.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}>
                      <td className="p-3.5 font-bold text-slate-900">
                        {s.full_name}
                        {isCurrentLoggedUser && (
                          <span className="mr-2 text-[10px] bg-[#0099DD]/10 text-[#0099DD] px-1.5 py-0.5 rounded font-bold">
                            أنت
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">{s.email || '-'}</td>
                      <td className="p-3.5 font-mono text-slate-700">{s.phone}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                            s.role === 'admin'
                              ? 'bg-rose-100 text-rose-800'
                              : s.role === 'sales_agent'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {getRoleTitleAr(displayRole)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {s.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>معطل</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#0099DD] hover:border-[#0099DD] hover:bg-sky-50 transition"
                            title="تعديل بيانات وصلاحيات الموظف"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Toggle Active Button */}
                          {isCurrentLoggedUser ? (
                            <span className="text-slate-300 text-[10px] px-1">حسابك</span>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(s)}
                              title={s.is_active !== false ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                              className="p-1 rounded-lg transition hover:bg-slate-100"
                            >
                              {s.is_active !== false ? (
                                <ToggleRight className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-rose-400" />
                              )}
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isCurrentLoggedUser && (
                            <button
                              onClick={() => setDeletingStaff(s)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition"
                              title="حذف الموظف نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ADD NEW STAFF ─────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0099DD]" />
                <span>إضافة موظف جديد</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>
            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedback.message}
              </div>
            )}
            <form onSubmit={handleCreateStaff} autoComplete="off" className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="مثال: حسام الدين كامل"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  البريد الإلكتروني <span className="font-normal text-slate-400">(اختياري)</span>
                </label>
                <input
                  type="email"
                  name="staff_new_email_no_autofill"
                  autoComplete="new-password"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="اتركه فارغاً ليُنشأ تلقائياً برقم الهاتف"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  إذا تُرك فارغاً: سيتم توليد البريد تلقائياً (رقم_الهاتف@elmahdy.com). لا تستخدم بريد المدير العام (admin@elmahdy.com).
                </p>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">الدور والصلاحية *</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-[#0099DD]"
                >
                  <option value="sales_agent">مندوب مبيعات (Sales Agent)</option>
                  <option value="warehouse_preparer">مسؤول تجهيز ومستودع (Warehouse)</option>
                  <option value="admin">مدير نظام (Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT STAFF & ROLES ─────────────────────────────────────── */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0099DD]" />
                <span>تعديل بيانات وصلاحيات الموظف</span>
              </h3>
              <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleUpdateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني (للعرض فقط)</label>
                <input
                  type="text"
                  disabled
                  value={editingStaff.email || '-'}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الدور الوظيفي والصلاحية *</label>
                <select
                  value={editRole}
                  disabled={editingStaff.id === staffSession?.id}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-[#0099DD] disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="sales_agent">مندوب مبيعات معتمد (Sales Agent)</option>
                  <option value="warehouse_preparer">مسؤول تجهيز ومستودع (Warehouse)</option>
                  <option value="admin">مدير نظام كامل (Admin)</option>
                </select>
                {editingStaff.id === staffSession?.id && (
                  <p className="text-[10px] text-amber-600 mt-1">لا يمكنك تغيير دورك الخاص لمنع إغلاق لوحة التحكم على نفسك.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  تعيين كلمة مرور جديدة <span className="font-normal text-slate-400">(اتركها فارغة إذا لم ترغب في التغيير)</span>
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة (6 أحرف على الأقل)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'جارٍ التحديث...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: DELETE CONFIRMATION ────────────────────────────────────── */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-extrabold text-slate-900 text-base">حذف حساب الموظف</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                هل أنت متأكد من حذف الموظف <span className="font-bold text-slate-800">({deletingStaff.full_name})</span> نهائياً؟
                سيتم مسح حسابه من النظام وإلغاء إمكانية دخوله للوحة التحكم فوراً.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'جارٍ الحذف...' : 'نعم، حذف الموظف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
