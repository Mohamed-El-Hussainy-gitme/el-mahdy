'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Truck,
  FolderTree,
  Package,
  Boxes,
  AlertTriangle,
  Users,
  Shield,
  Settings,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { canViewDashboard, canAccessAdminRoute, getDefaultAdminRoute } from '@/services/authService';
import { filterOrdersForRole } from '@/services/orderService';
import { StaffHeader } from '@/components/admin/StaffHeader';
import { UserRole } from '@/types';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staffSession, staffLogout, orders, products, categories, shortages, isLoading } = useStore();

  const userRole = (staffSession?.role as string) === 'warehouse'
    ? 'warehouse_preparer'
    : (staffSession?.role as UserRole);

  // Dynamic route security guard: smoothly redirect users if they navigate to an unauthorized path
  React.useEffect(() => {
    if (staffSession && pathname && !pathname.startsWith('/admin/login')) {
      if (!canAccessAdminRoute(userRole, pathname)) {
        const fallback = getDefaultAdminRoute(userRole);
        router.replace(fallback);
      }
    }
  }, [staffSession, userRole, pathname, router]);

  // If login page, don't show admin chrome
  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  // Show loading indicator during initial hydration before asserting permissions
  if (isLoading && !staffSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="w-8 h-8 border-2 border-[#0099DD] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold">جاري تحميل لوحة التحكم...</span>
        </div>
      </div>
    );
  }

  // Guard: Not logged in or customer role
  if (!staffSession || !canViewDashboard(staffSession.role)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">منطقة إدارية محمية بالكامل</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            الوصول لهذه اللوحة مخصص حصراً لموظفي الشركة (الإدارة، مناديب المبيعات، ومسؤولي التجهيز والمستودع). حسابات
            العملاء لا تملك أي صلاحية دخول هنا.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/admin/login"
              className="bg-[#0099DD] hover:bg-[#007BB3] text-white py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
            >
              تسجيل دخول الموظفين (Staff Login)
            </Link>
            <Link
              href="/"
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للمتجر الرئيسي</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate orders accessible to this specific role
  const roleAccessibleOrders = filterOrdersForRole(orders, staffSession);

  // Tailor navigation items specifically for each role
  const navItems = (() => {
    if (userRole === 'admin') {
      return [
        { href: '/admin', label: 'نظرة عامة', icon: LayoutDashboard },
        { href: '/admin/orders', label: 'الطلبات ودورة الحياة', icon: Truck, count: orders.length },
        { href: '/admin/products', label: 'المنتجات والكتالوج', icon: Package, count: products.length },
        { href: '/admin/categories', label: 'شجرة التصنيفات', icon: FolderTree, count: categories.length },
        { href: '/admin/matrix', label: 'مصفوفة التوافق', icon: Boxes },
        { href: '/admin/shortages', label: 'تنبيهات النواقص', icon: AlertTriangle, count: shortages.length },
        { href: '/admin/customers', label: 'العملاء والمناديب', icon: Users },
        { href: '/admin/staff', label: 'الموظفون والصلاحيات', icon: Shield },
        { href: '/admin/settings', label: 'إعدادات المتجر', icon: Settings },
      ];
    }

    if (userRole === 'sales_agent') {
      return [
        { href: '/admin', label: 'نظرة عامة (المبيعات)', icon: LayoutDashboard },
        { href: '/admin/orders', label: 'طلبات عملائي', icon: Truck, count: roleAccessibleOrders.length },
        { href: '/admin/customers', label: 'عملائي المعتمدون', icon: Users },
        { href: '/admin/products', label: 'الكتالوج والأسعار', icon: Package, count: products.length },
        { href: '/admin/matrix', label: 'مصفوفة التوافق والموديلات', icon: Boxes },
        { href: '/admin/shortages', label: 'تنبيهات النواقص', icon: AlertTriangle, count: shortages.length },
      ];
    }

    if (userRole === 'warehouse_preparer') {
      return [
        { href: '/admin/orders', label: 'طلبات التجهيز والشحن', icon: Truck, count: roleAccessibleOrders.length },
        { href: '/admin/matrix', label: 'مصفوفة التوافق والمخزون', icon: Boxes },
        { href: '/admin/products', label: 'كتالوج الأصناف للتجهيز', icon: Package, count: products.length },
      ];
    }

    return [];
  })();

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900" dir="rtl">
      {/* Persistent Staff Header */}
      <StaffHeader
        staffSession={staffSession}
        isSupabaseConfigured={isSupabaseConfigured()}
        onLogout={() => {
          staffLogout();
          router.push('/admin/login');
        }}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[#0099DD] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
