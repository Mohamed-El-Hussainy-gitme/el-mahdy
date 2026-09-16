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
  Plus,
  SlidersHorizontal,
  Sparkles,
  Check,
  Briefcase,
  Boxes,
  Package,
  FolderTree,
  Truck,
  Users,
  Settings,
} from 'lucide-react';
import { UserProfile, UserRole, CustomRole } from '@/types';
import { useStore } from '@/context/StoreContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getRoleTitleAr } from '@/services/authService';

interface StaffManagerProps {
  currentRole: UserRole;
}

export const PERMISSIONS_CONFIG = [
  {
    key: 'can_manage_products' as const,
    label: 'إدخال وتعديل المنتجات',
    desc: 'إضافة وتعديل وحذف المنتجات، تحديث الأسعار، وتغيير الصور وحالة التوفر',
    icon: Package,
    badge: 'المنتجات',
  },
  {
    key: 'can_receive_customers' as const,
    label: 'استقبال عملاء كمندوب (توزيع تلقائي)',
    desc: 'إدراج الموظف في التوزيع التلقائي للعملاء الجدد بنظام الأقل تشغيلاً بالتساوي',
    icon: UserCheck,
    badge: 'توزيع المناديب',
  },
  {
    key: 'can_manage_orders' as const,
    label: 'إدارة وتجهيز الطلبات',
    desc: 'عرض الطلبات ومتابعة دورة حياتها وتغيير حالات التجهيز والشحن والتسليم',
    icon: Truck,
    badge: 'الطلبات',
  },
  {
    key: 'can_manage_categories' as const,
    label: 'إدارة الأقسام والكتالوج',
    desc: 'إضافة وتعديل شجرة التصنيفات ورفع صور الأقسام والتحكم في ترتيبها',
    icon: FolderTree,
    badge: 'التصنيفات',
  },
  {
    key: 'can_manage_matrix' as const,
    label: 'إدارة مصفوفة الموديلات والمخزون',
    desc: 'إدارة موديلات السيارات وسنوات التوافق ومطابقة المخزون الفعلي',
    icon: Boxes,
    badge: 'مصفوفة التوافق',
  },
  {
    key: 'can_manage_customers' as const,
    label: 'إدارة وعرض العملاء',
    desc: 'عرض حسابات العملاء، سجلات الطلبات، وإعادة تعيين المندوب المسؤول يدوياً',
    icon: Users,
    badge: 'العملاء',
  },
  {
    key: 'can_manage_shortages' as const,
    label: 'مراجعة طلبات النواقص',
    desc: 'مراجعة إشعارات وبلاغات النواقص المرسلة من العملاء وتحديث حالتها',
    icon: AlertTriangle,
    badge: 'النواقص',
  },
  {
    key: 'can_manage_settings' as const,
    label: 'إعدادات المتجر العامة',
    desc: 'تعديل سياسات الشحن والحد الأدنى للطلب وبيانات التواصل الرئيسية',
    icon: Settings,
    badge: 'الإعدادات',
  },
];

export function StaffManager({ currentRole }: StaffManagerProps) {
  const {
    staffSession,
    customRoles,
    addCustomRole,
    updateCustomRole,
    deleteCustomRole,
    refreshData,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Add Staff Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('sales_agent');
  const [addCustomRoleId, setAddCustomRoleId] = useState<string>('');

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('sales_agent');
  const [editCustomRoleId, setEditCustomRoleId] = useState<string>('');
  const [editPassword, setEditPassword] = useState('');

  // Delete Staff State
  const [deletingStaff, setDeletingStaff] = useState<UserProfile | null>(null);

  // Custom Roles Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormDescription, setRoleFormDescription] = useState('');
  const [roleFormPerms, setRoleFormPerms] = useState<Record<string, boolean>>({
    can_manage_products: false,
    can_receive_customers: false,
    can_manage_orders: false,
    can_manage_categories: false,
    can_manage_matrix: false,
    can_manage_customers: false,
    can_manage_shortages: false,
    can_manage_settings: false,
  });
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

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
        .select('*, custom_role:custom_roles(*)')
        .neq('role', 'customer')
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
          customRoleId: addCustomRoleId || undefined,
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
        setAddCustomRoleId('');
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
    setEditCustomRoleId(staff.custom_role_id || '');
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
        customRoleId: editCustomRoleId || null,
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

  // ── Custom Roles Handlers ───────────────────────────────────────────────────
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormName('');
    setRoleFormDescription('');
    setRoleFormPerms({
      can_manage_products: false,
      can_receive_customers: false,
      can_manage_orders: false,
      can_manage_categories: false,
      can_manage_matrix: false,
      can_manage_customers: false,
      can_manage_shortages: false,
      can_manage_settings: false,
    });
    setFeedback(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: CustomRole) => {
    setEditingRole(r);
    setRoleFormName(r.name_ar);
    setRoleFormDescription(r.description || '');
    setRoleFormPerms({
      can_manage_products: !!r.can_manage_products,
      can_receive_customers: !!r.can_receive_customers,
      can_manage_orders: !!r.can_manage_orders,
      can_manage_categories: !!r.can_manage_categories,
      can_manage_matrix: !!r.can_manage_matrix,
      can_manage_customers: !!r.can_manage_customers,
      can_manage_shortages: !!r.can_manage_shortages,
      can_manage_settings: !!r.can_manage_settings,
    });
    setFeedback(null);
    setIsRoleModalOpen(true);
  };

  const handleTogglePerm = (key: string) => {
    setRoleFormPerms((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      setFeedback({ type: 'error', message: 'يرجى إدخال المسمى الوظيفي' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingRole) {
        const ok = await updateCustomRole(editingRole.id, {
          name_ar: roleFormName.trim(),
          description: roleFormDescription.trim(),
          ...roleFormPerms,
        });
        if (ok) {
          setFeedback({ type: 'success', message: 'تم تحديث الدور الوظيفي وصلاحياته بنجاح' });
          await fetchStaffList();
          setTimeout(() => {
            setIsRoleModalOpen(false);
            setFeedback(null);
          }, 1200);
        } else {
          setFeedback({ type: 'error', message: 'فشل تحديث الدور، يرجى المحاولة لاحقاً' });
        }
      } else {
        const ok = await addCustomRole({
          name_ar: roleFormName.trim(),
          description: roleFormDescription.trim(),
          is_system: false,
          ...(roleFormPerms as any),
        } as any);
        if (ok) {
          setFeedback({ type: 'success', message: 'تم إنشاء الدور الوظيفي الجديد بنجاح' });
          await fetchStaffList();
          setTimeout(() => {
            setIsRoleModalOpen(false);
            setFeedback(null);
          }, 1200);
        } else {
          setFeedback({ type: 'error', message: 'فشل إضافة الدور، قد يكون الاسم مستخدماً مسبقاً' });
        }
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!deletingRole) return;
    setIsSubmitting(true);
    try {
      const ok = await deleteCustomRole(deletingRole.id);
      if (ok) {
        setDeletingRole(null);
        await fetchStaffList();
      } else {
        alert('لا يمكن حذف هذا الدور (إما أنه دور نظام قياسي أو مرتبط بموظفين حاليين)');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
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
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#0099DD]" />
            <span>إدارة الموظفين والأدوار والصلاحيات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">إضافة وتعديل الموظفين، إنشاء مسميات وظيفية مخصصة بصلاحيات دقيقة ON/OFF.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStaffList} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          {activeTab === 'staff' ? (
            <button onClick={() => { setFeedback(null); setIsAddModalOpen(true); }} className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
              <UserPlus className="w-4 h-4" /><span>إضافة موظف جديد</span>
            </button>
          ) : (
            <button onClick={handleOpenCreateRole} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
              <Plus className="w-4 h-4" /><span>إضافة مسمى وظيفي جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('staff')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Users className="w-3.5 h-3.5" /><span>فريق العمل والموظفين ({staffList.length})</span>
        </button>
        <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <SlidersHorizontal className="w-3.5 h-3.5" /><span>الأدوار والصلاحيات المخصصة ({customRoles.length})</span>
        </button>
      </div>

      {/* TAB 1: STAFF */}
      {activeTab === 'staff' && (<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'مدير النظام (Admin)', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: <Key className="w-4 h-4 text-rose-600" />, desc: 'صلاحيات كاملة: تعديل الكتالوج والأسعار، إضافة وحذف وتعديل الموظفين.' },
            { label: 'مندوب مبيعات (Sales Agent)', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: <UserCheck className="w-4 h-4 text-sky-600" />, desc: 'تأكيد طلبات العملاء ونقلها إلى التجهيز، مراجعة النواقص.' },
            { label: 'مسؤول المستودع (Warehouse)', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Shield className="w-4 h-4 text-amber-600" />, desc: 'تجهيز الشحنات، طباعة أذون الصرف وبوليصات الشحن.' },
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
            <span>قائمة الموظفين الحاليين ({staffList.length})</span>
            {isLoadingList && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </div>
          {staffList.length === 0 && !isLoadingList ? (
            <div className="p-8 text-center text-xs text-slate-400">لا يوجد موظفون مسجلون.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">اسم الموظف</th>
                    <th className="p-3.5">البريد / الهاتف</th>
                    <th className="p-3.5">الدور الوظيفي</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.map((s) => {
                    const isMe = s.id === staffSession?.id;
                    const dr = (s.role as string) === 'warehouse' ? 'warehouse_preparer' : (s.role as UserRole);
                    const isCustom = !!s.custom_role_id;
                    const roleLabel = s.custom_role_name || getRoleTitleAr(dr, s);
                    const roleBadge = s.role === 'admin' ? 'bg-rose-100 text-rose-800' : isCustom ? 'bg-violet-100 text-violet-800' : s.role === 'sales_agent' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800';
                    return (
                      <tr key={s.id} className={`hover:bg-slate-50/60 transition ${!s.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}>
                        <td className="p-3.5 font-bold text-slate-900">
                          {s.full_name}
                          {isMe && <span className="mr-2 text-[10px] bg-[#0099DD]/10 text-[#0099DD] px-1.5 py-0.5 rounded font-bold">أنت</span>}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">
                          <div>{s.email || '-'}</div>
                          <div className="text-slate-400 text-[11px]">{s.phone}</div>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] ${roleBadge}`}>
                            {isCustom && <Sparkles className="w-3 h-3" />}
                            {roleLabel}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {s.is_active !== false
                            ? <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]"><CheckCircle2 className="w-3.5 h-3.5" /><span>نشط</span></span>
                            : <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]"><AlertTriangle className="w-3.5 h-3.5" /><span>معطل</span></span>
                          }
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleOpenEdit(s)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#0099DD] hover:border-[#0099DD] hover:bg-sky-50 transition"><Edit3 className="w-4 h-4" /></button>
                            {isMe
                              ? <span className="text-slate-300 text-[10px] px-1">حسابك</span>
                              : <button onClick={() => handleToggleActive(s)} className="p-1 rounded-lg transition hover:bg-slate-100">{s.is_active !== false ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-rose-400" />}</button>
                            }
                            {!isMe && <button onClick={() => setDeletingStaff(s)} className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition"><Trash2 className="w-4 h-4" /></button>}
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
      </>)}

      {/* TAB 2: CUSTOM ROLES */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-xs text-violet-800 leading-relaxed">
            <strong className="block mb-1">ما هي الأدوار المخصصة؟</strong>
            يمكنك إنشاء مسميات وظيفية مخصصة وتخصيص صلاحيات دقيقة لكل دور بمفتاح ON/OFF. بعد الإنشاء عيّن الموظفين من تبويب &ldquo;الموظفين&rdquo;.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customRoles.map((r) => (
              <div key={r.id} className={`bg-white rounded-2xl border ${r.is_system ? 'border-slate-300' : 'border-violet-200'} shadow-sm overflow-hidden`}>
                <div className={`px-4 py-3 flex items-center justify-between ${r.is_system ? 'bg-slate-50' : 'bg-violet-50'}`}>
                  <div className="flex items-center gap-2">
                    {r.is_system ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Sparkles className="w-3.5 h-3.5 text-violet-500" />}
                    <span className="font-extrabold text-slate-900 text-xs">{r.name_ar}</span>
                    {r.is_system && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">نظام</span>}
                  </div>
                  {!r.is_system && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleOpenEditRole(r)} className="p-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-100 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeletingRole(r)} className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                {r.description && <p className="px-4 pt-2 text-[11px] text-slate-500">{r.description}</p>}
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
                  {PERMISSIONS_CONFIG.map((p) => {
                    const isOn = !!(r as any)[p.key];
                    return (
                      <span key={p.key} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200 line-through'}`}>
                        {isOn && <Check className="w-2.5 h-2.5" />}{p.badge}
                      </span>
                    );
                  })}
                </div>
                <div className="px-4 pb-3 text-[11px] text-slate-400">{staffList.filter((s) => s.custom_role_id === r.id).length} موظف معيّن</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD STAFF */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#0099DD]" /><span>إضافة موظف جديد</span></h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            {feedback && <div className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{feedback.message}</div>}
            <form onSubmit={handleCreateStaff} autoComplete="off" className="space-y-3.5 text-xs">
              <div><label className="block text-slate-700 font-bold mb-1">الاسم بالكامل *</label><input type="text" required value={addFullName} onChange={(e) => setAddFullName(e.target.value)} placeholder="مثال: حسام الدين كامل" className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div><label className="block text-slate-700 font-bold mb-1">رقم الهاتف *</label><input type="tel" required value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="010XXXXXXXX" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div><label className="block text-slate-700 font-bold mb-1">البريد الإلكتروني <span className="font-normal text-slate-400">(اختياري)</span></label><input type="email" autoComplete="new-password" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="اتركه فارغاً ليُنشأ تلقائياً" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">الدور الوظيفي *</label>
                <select value={addCustomRoleId ? `cr:${addCustomRoleId}` : addRole} onChange={(e) => { const v = e.target.value; if (v.startsWith('cr:')) { setAddCustomRoleId(v.replace('cr:', '')); setAddRole('custom' as UserRole); } else { setAddCustomRoleId(''); setAddRole(v as UserRole); } }} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-[#0099DD]">
                  <optgroup label="أدوار النظام القياسية">
                    <option value="sales_agent">مندوب مبيعات (Sales Agent)</option>
                    <option value="warehouse_preparer">مسؤول تجهيز ومستودع (Warehouse)</option>
                    <option value="admin">مدير نظام (Admin)</option>
                  </optgroup>
                  {customRoles.filter((r) => !r.is_system).length > 0 && (
                    <optgroup label="أدوار مخصصة">{customRoles.filter((r) => !r.is_system).map((r) => (<option key={r.id} value={`cr:${r.id}`}>{r.name_ar}</option>))}</optgroup>
                  )}
                </select>
              </div>
              <div><label className="block text-slate-700 font-bold mb-1">كلمة المرور *</label><input type="password" required minLength={6} value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="6 أحرف على الأقل" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm disabled:opacity-50">{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ الموظف'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STAFF */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><Edit3 className="w-4 h-4 text-[#0099DD]" /><span>تعديل بيانات وصلاحيات الموظف</span></h3>
              <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            {feedback && <div className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{feedback.message}</div>}
            <form onSubmit={handleUpdateStaff} className="space-y-3.5 text-xs">
              <div><label className="block text-slate-700 font-bold mb-1">البريد (للعرض فقط)</label><input type="text" disabled value={editingStaff.email || '-'} className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-xl font-mono cursor-not-allowed" /></div>
              <div><label className="block text-slate-700 font-bold mb-1">الاسم بالكامل *</label><input type="text" required value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div><label className="block text-slate-700 font-bold mb-1">رقم الهاتف *</label><input type="tel" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">الدور الوظيفي *</label>
                <select value={editCustomRoleId ? `cr:${editCustomRoleId}` : editRole} disabled={editingStaff.id === staffSession?.id} onChange={(e) => { const v = e.target.value; if (v.startsWith('cr:')) { setEditCustomRoleId(v.replace('cr:', '')); setEditRole('custom' as UserRole); } else { setEditCustomRoleId(''); setEditRole(v as UserRole); } }} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold focus:ring-2 focus:ring-[#0099DD] disabled:bg-slate-100 disabled:text-slate-500">
                  <optgroup label="أدوار النظام القياسية">
                    <option value="sales_agent">مندوب مبيعات (Sales Agent)</option>
                    <option value="warehouse_preparer">مسؤول تجهيز ومستودع (Warehouse)</option>
                    <option value="admin">مدير نظام (Admin)</option>
                  </optgroup>
                  {customRoles.filter((r) => !r.is_system).length > 0 && (
                    <optgroup label="أدوار مخصصة">{customRoles.filter((r) => !r.is_system).map((r) => (<option key={r.id} value={`cr:${r.id}`}>{r.name_ar}</option>))}</optgroup>
                  )}
                </select>
                {editingStaff.id === staffSession?.id && <p className="text-[10px] text-amber-600 mt-1">لا يمكنك تغيير دورك الخاص.</p>}
              </div>
              <div><label className="block text-slate-700 font-bold mb-1">كلمة مرور جديدة <span className="font-normal text-slate-400">(فارغة = لا تغيير)</span></label><input type="password" minLength={6} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="6 أحرف على الأقل" className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-[#0099DD]" /></div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingStaff(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm disabled:opacity-50">{isSubmitting ? 'جارٍ التحديث...' : 'حفظ التعديلات'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE STAFF */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><Trash2 className="w-6 h-6" /></div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">حذف حساب الموظف</h3>
              <p className="text-xs text-slate-500 mt-1">هل أنت متأكد من حذف <span className="font-bold text-slate-800">({deletingStaff.full_name})</span> نهائياً؟</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button type="button" disabled={isSubmitting} onClick={() => setDeletingStaff(null)} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50">إلغاء</button>
              <button type="button" disabled={isSubmitting} onClick={handleConfirmDelete} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50">{isSubmitting ? 'جارٍ الحذف...' : 'نعم، حذف الموظف'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE/EDIT CUSTOM ROLE */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-5 border-b bg-violet-50">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-violet-600" /><span>{editingRole ? 'تعديل الدور الوظيفي' : 'إنشاء مسمى وظيفي جديد'}</span></h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleSaveRole} className="p-5 space-y-5 text-xs">
                {feedback && <div className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{feedback.message}</div>}
                <div><label className="block text-slate-700 font-bold mb-1">المسمى الوظيفي (بالعربية) *</label><input type="text" required value={roleFormName} onChange={(e) => setRoleFormName(e.target.value)} placeholder="مثال: مدخل بيانات، مشرف تسويق" className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500" /></div>
                <div><label className="block text-slate-700 font-bold mb-1">وصف قصير <span className="font-normal text-slate-400">(اختياري)</span></label><input type="text" value={roleFormDescription} onChange={(e) => setRoleFormDescription(e.target.value)} placeholder="وصف مهام الدور..." className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500" /></div>
                <div>
                  <label className="block text-slate-700 font-bold mb-3">الصلاحيات — فعّل أو أوقف كل صلاحية بشكل مستقل</label>
                  <div className="space-y-2.5">
                    {PERMISSIONS_CONFIG.map((p) => {
                      const isOn = !!roleFormPerms[p.key];
                      const Icon = p.icon;
                      return (
                        <button key={p.key} type="button" onClick={() => handleTogglePerm(p.key)} className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition ${isOn ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                          <div className={`flex-shrink-0 w-9 h-5 rounded-full flex items-center mt-0.5 transition-colors ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5"><Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isOn ? 'text-emerald-600' : 'text-slate-400'}`} /><span className={`font-bold ${isOn ? 'text-emerald-800' : 'text-slate-600'}`}>{p.label}</span></div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{p.desc}</p>
                          </div>
                          <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded ${isOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{isOn ? 'مفعّل' : 'مغلق'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600">
                  <span className="font-bold">المفعّلة: </span>
                  {PERMISSIONS_CONFIG.filter((p) => roleFormPerms[p.key]).map((p) => p.badge).join(' · ') || 'لا توجد صلاحيات مفعّلة'}
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50">إلغاء</button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-sm disabled:opacity-50">{isSubmitting ? 'جارٍ الحفظ...' : editingRole ? 'حفظ التعديلات' : 'إنشاء الدور'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE ROLE */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><Trash2 className="w-6 h-6" /></div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">حذف الدور الوظيفي</h3>
              <p className="text-xs text-slate-500 mt-1">هل أنت متأكد من حذف دور <span className="font-bold text-slate-800">&laquo;{deletingRole.name_ar}&raquo;</span>؟ لا يمكن حذف دور مرتبط بموظفين.</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button type="button" disabled={isSubmitting} onClick={() => setDeletingRole(null)} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50">إلغاء</button>
              <button type="button" disabled={isSubmitting} onClick={handleConfirmDeleteRole} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50">{isSubmitting ? 'جارٍ الحذف...' : 'نعم، حذف الدور'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
