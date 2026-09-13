'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserCheck,
  Phone,
  Building,
  MapPin,
  ShoppingBag,
  Calendar,
  Shield,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useStore, DEFAULT_STICKY_SALES_REP } from '@/context/StoreContext';
import { UserProfile, UserRole } from '@/types';

interface CustomerManagerProps {
  currentRole: UserRole;
}

export function CustomerManager({ currentRole }: CustomerManagerProps) {
  const { customers, orders, assignCustomerSalesRep, staffSession, staffMembers } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [selectedRepForCustomer, setSelectedRepForCustomer] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Available sales agents for sticky assignment (from live DB staff)
  const salesAgents: UserProfile[] = useMemo(() => {
    const fromStaff = staffMembers.filter((s) => s.role === 'sales_agent' || s.role === 'admin');
    if (fromStaff.length > 0) return fromStaff;
    return [DEFAULT_STICKY_SALES_REP];
  }, [staffMembers]);

  // Compute spend and order count per customer
  const customerStats = useMemo(() => {
    const map: Record<string, { orderCount: number; totalSpent: number; lastOrderDate?: string }> = {};
    orders.forEach((o) => {
      if (!map[o.customer_id]) {
        map[o.customer_id] = { orderCount: 0, totalSpent: 0 };
      }
      map[o.customer_id].orderCount += 1;
      if (o.status !== 'returned') {
        map[o.customer_id].totalSpent += Number(o.total_amount) || 0;
      }
      if (!map[o.customer_id].lastOrderDate || o.created_at > map[o.customer_id].lastOrderDate!) {
        map[o.customer_id].lastOrderDate = o.created_at;
      }
    });
    return map;
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.company_name && c.company_name.toLowerCase().includes(q));

      const matchRep =
        selectedRepFilter === 'all' ||
        (selectedRepFilter === 'unassigned' && !c.assigned_sales_rep_id) ||
        c.assigned_sales_rep_id === selectedRepFilter;

      return matchSearch && matchRep;
    });
  }, [customers, searchQuery, selectedRepFilter]);

  const handleStartReassign = (cust: UserProfile) => {
    setEditingCustomer(cust.id);
    setSelectedRepForCustomer(cust.assigned_sales_rep_id || DEFAULT_STICKY_SALES_REP.id);
  };

  const handleSaveReassign = async (customerId: string) => {
    if (!selectedRepForCustomer) return;
    setIsSaving(true);
    await assignCustomerSalesRep(customerId, selectedRepForCustomer);
    setIsSaving(false);
    setEditingCustomer(null);
  };

  const isAdmin = currentRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Header & Sticky Rep Rule Explanation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-[#0099DD]" />
              <span>إدارة العملاء وربط المناديب (Sticky Sales Rep)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              إجمالي العملاء المسجلين: <span className="font-bold text-slate-900">{customers.length} عميل B2B</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو الشركة أو الهاتف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
              />
            </div>

            {/* Rep Filter */}
            <select
              value={selectedRepFilter}
              onChange={(e) => setSelectedRepFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
            >
              <option value="all">كل المناديب</option>
              <option value="unassigned">بدون مندوب معين</option>
              {salesAgents.map((sa) => (
                <option key={sa.id} value={sa.id}>{sa.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Business Logic Note */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-start gap-2.5">
          <UserCheck className="w-4 h-4 text-[#0099DD] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">قاعدة المندوب الدائم (Sticky Sales Rep): </span>
            يرتبط العميل بمندوب مبيعات معتمد فور تأكيد أول طلب أو تعيينه من قِبل الإدارة. جميع طلبات العميل الحالية
            والمستقبلية تُحال تلقائياً إلى هذا المندوب لضمان استمرارية خدمة حسابات الجملة.
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">العميل والمؤسسة</th>
                <th className="p-3.5">بيانات الاتصال</th>
                <th className="p-3.5">المندوب المعتمد (Sticky Rep)</th>
                <th className="p-3.5">الطلبات وإجمالي المشتريات</th>
                <th className="p-3.5">تاريخ التسجيل</th>
                {isAdmin && <th className="p-3.5 text-center">تعديل المندوب</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    لا يوجد عملاء مطابقون للبحث الحالي.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const stat = customerStats[c.id] || { orderCount: 0, totalSpent: 0 };
                  const isEditingThis = editingCustomer === c.id;
                  const rep = c.assigned_sales_rep_id
                    ? salesAgents.find((s) => s.id === c.assigned_sales_rep_id) || { full_name: 'مندوب مبيعات' }
                    : null;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition">
                      {/* Customer & Company */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{c.full_name}</div>
                        {c.company_name && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-400" />
                            <span>{c.company_name}</span>
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="p-3.5">
                        <div className="font-mono text-slate-700 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                        {c.email && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{c.email}</div>
                        )}
                      </td>

                      {/* Sticky Sales Rep */}
                      <td className="p-3.5">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedRepForCustomer}
                              onChange={(e) => setSelectedRepForCustomer(e.target.value)}
                              className="p-1.5 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                            >
                              {salesAgents.map((sa) => (
                                <option key={sa.id} value={sa.id}>
                                  {sa.full_name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveReassign(c.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-[#0099DD] text-white rounded-lg hover:bg-[#007BB3] disabled:opacity-50"
                              title="حفظ"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCustomer(null)}
                              className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                              title="إلغاء"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#0099DD]" />
                            <span className={`font-bold ${c.assigned_sales_rep_id ? 'text-slate-800' : 'text-amber-600'}`}>
                              {c.assigned_sales_rep_id ? (rep?.full_name || 'مندوب مبيعات') : 'غير محدد (بانتظار أول طلب)'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Orders & Total Spent */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">
                          {stat.orderCount} طلبات
                        </div>
                        <div className="text-[11px] font-mono text-[#0099DD] font-bold mt-0.5">
                          {stat.totalSpent.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="p-3.5 text-slate-500 text-[11px] font-mono">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : 'عميل مسجل'}
                      </td>

                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="p-3.5 text-center">
                          {!isEditingThis && (
                            <button
                              onClick={() => handleStartReassign(c)}
                              className="px-2.5 py-1 text-xs font-bold text-[#0099DD] hover:bg-sky-50 border border-sky-200 rounded-lg transition"
                            >
                              تغيير المندوب
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
