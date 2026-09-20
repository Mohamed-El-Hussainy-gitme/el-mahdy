'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserCheck,
  Phone,
  Building,
  ShoppingBag,
  Save,
  CheckCircle2,
  MessageCircle,
  ArrowRightLeft,
  BarChart3,
  History,
  AlertCircle,
  TrendingUp,
  Award,
  Clock,
  X,
  Loader2,
  Filter,
  Check,
} from 'lucide-react';
import { useStore, DEFAULT_STICKY_SALES_REP } from '@/context/StoreContext';
import { UserProfile, UserRole, AssignmentType } from '@/types';

interface CustomerManagerProps {
  currentRole: UserRole;
  staffProfile?: UserProfile | null;
}

export function CustomerManager({ currentRole, staffProfile }: CustomerManagerProps) {
  const {
    customers,
    orders,
    assignCustomerSalesRep,
    staffSession,
    staffMembers,
    salesRepAssignments,
    getSalesRepPerformanceReports,
  } = useStore();

  const effectiveProfile = staffProfile || staffSession;
  const isAdmin = currentRole === 'admin' || !!effectiveProfile?.custom_role?.can_manage_customers;
  const isSalesAgent = !isAdmin && (currentRole === 'sales_agent' || !!effectiveProfile?.custom_role?.can_receive_customers);

  // Tabs
  const [activeTab, setActiveTab] = useState<'customers' | 'reports' | 'logs'>('customers');

  // Customer List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');

  // Transfer Modal State
  const [transferCustomer, setTransferCustomer] = useState<UserProfile | null>(null);
  const [selectedTargetRepId, setSelectedTargetRepId] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [reassignPendingOrders, setReassignPendingOrders] = useState<boolean>(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data Log Filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logRepFilter, setLogRepFilter] = useState<string>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');

  // Eligible sales agents
  const salesAgents: UserProfile[] = useMemo(() => {
    const fromStaff = staffMembers.filter(
      (s) => (s.role === 'sales_agent' || s.role === 'admin' || s.custom_role?.can_receive_customers) && s.is_active !== false
    );
    if (fromStaff.length > 0) return fromStaff;
    return [DEFAULT_STICKY_SALES_REP];
  }, [staffMembers]);

  // Map of customer counts per sales rep
  const repCustomerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    salesAgents.forEach((sa) => { map[sa.id] = 0; });
    customers.forEach((c) => {
      if (c.assigned_sales_rep_id && map[c.assigned_sales_rep_id] !== undefined) {
        map[c.assigned_sales_rep_id]++;
      }
    });
    return map;
  }, [salesAgents, customers]);

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

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (isSalesAgent && staffSession) {
        if (c.assigned_sales_rep_id !== staffSession.id) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.company_name && c.company_name.toLowerCase().includes(q));

      const matchRep =
        isSalesAgent ||
        selectedRepFilter === 'all' ||
        (selectedRepFilter === 'unassigned' && !c.assigned_sales_rep_id) ||
        c.assigned_sales_rep_id === selectedRepFilter;

      return matchSearch && matchRep;
    });
  }, [customers, searchQuery, selectedRepFilter, isSalesAgent, staffSession]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return salesRepAssignments.filter((log) => {
      if (isSalesAgent && staffSession) {
        if (log.sales_rep_id !== staffSession.id && log.previous_rep_id !== staffSession.id) {
          return false;
        }
      }

      const q = logSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.customer_name.toLowerCase().includes(q) ||
        log.customer_phone.includes(q) ||
        (log.customer_company && log.customer_company.toLowerCase().includes(q)) ||
        (log.sales_rep_name && log.sales_rep_name.toLowerCase().includes(q)) ||
        (log.notes && log.notes.toLowerCase().includes(q));

      const matchRep =
        isSalesAgent ||
        logRepFilter === 'all' ||
        log.sales_rep_id === logRepFilter ||
        log.previous_rep_id === logRepFilter;

      const matchType =
        logTypeFilter === 'all' || log.assignment_type === logTypeFilter;

      return matchSearch && matchRep && matchType;
    });
  }, [salesRepAssignments, logSearchQuery, logRepFilter, logTypeFilter, isSalesAgent, staffSession]);

  // Performance Reports
  const performanceReports = useMemo(() => {
    const all = getSalesRepPerformanceReports();
    if (isSalesAgent && staffSession) {
      return all.filter((r) => r.repId === staffSession.id);
    }
    return all;
  }, [getSalesRepPerformanceReports, isSalesAgent, staffSession]);

  // Total KPIs
  const totalAssignedCustomers = useMemo(() => {
    return customers.filter((c) => c.assigned_sales_rep_id).length;
  }, [customers]);

  const totalRevenueAllReps = useMemo(() => {
    return performanceReports.reduce((sum, r) => sum + r.totalRevenue, 0);
  }, [performanceReports]);

  // Handlers for Transfer Modal
  const openTransferModal = (cust: UserProfile) => {
    setTransferCustomer(cust);
    setSelectedTargetRepId(cust.assigned_sales_rep_id || salesAgents[0]?.id || '');
    setTransferNotes('');
    setReassignPendingOrders(true);
    setTransferFeedback(null);
  };

  const closeTransferModal = () => {
    setTransferCustomer(null);
    setTransferFeedback(null);
    setIsTransferring(false);
  };

  const handleConfirmTransfer = async () => {
    if (!transferCustomer || !selectedTargetRepId) return;
    if (selectedTargetRepId === transferCustomer.assigned_sales_rep_id) {
      setTransferFeedback({ type: 'error', message: 'يرجى اختيار مندوب مختلف عن المندوب الحالي' });
      return;
    }

    setIsTransferring(true);
    setTransferFeedback(null);

    const res = await assignCustomerSalesRep(
      transferCustomer.id,
      selectedTargetRepId,
      transferNotes.trim() || undefined,
      reassignPendingOrders
    );

    setIsTransferring(false);
    if (res.success) {
      setTransferFeedback({ type: 'success', message: res.message || 'تم تحويل العميل وتوثيق الحركة بنجاح' });
      setTimeout(() => {
        closeTransferModal();
      }, 1200);
    } else {
      setTransferFeedback({ type: 'error', message: res.message || 'حدث خطأ أثناء تحويل العميل' });
    }
  };

  // Helper badge for assignment types
  const renderAssignmentBadge = (type?: AssignmentType | string) => {
    switch (type) {
      case 'customer_choice':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            طلب العميل بالاسم
          </span>
        );
      case 'admin_transfer':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <ArrowRightLeft className="w-3 h-3 text-amber-600" />
            تحويل إداري
          </span>
        );
      case 'auto_fair_distribution':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0099DD] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0099DD]" />
            توزيع عادل تلقائي
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-[#0099DD]" />
              <span>
                {isSalesAgent
                  ? `قائمة عملائي المعتمدين (${filteredCustomers.length})`
                  : `إدارة العملاء وربط المناديب والتقارير`}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isSalesAgent
                ? 'إدارة العملاء المربوطين بحسابك وسجل الحركات وإحصائيات الأداء والمبيعات الخاصة بك.'
                : 'نظام إدارة وتوزيع العملاء، تقارير أداء المناديب والتوزيع المتكافئ، وسجل العمليات الكامل (Data Log).'}
            </p>
          </div>

          {/* Quick Summary Pill for Admin */}
          {isAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <div className="text-slate-600">
                إجمالي العملاء: <span className="font-bold text-slate-900">{customers.length}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="text-slate-600">
                مناديب نشطين: <span className="font-bold text-[#0099DD]">{salesAgents.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pt-2">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'customers'
                ? 'border-[#0099DD] text-[#0099DD]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isSalesAgent ? 'عملائي المعتمدين' : 'دليل العملاء والربط'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              activeTab === 'customers' ? 'bg-[#0099DD]/10 text-[#0099DD]' : 'bg-slate-100 text-slate-500'
            }`}>
              {filteredCustomers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'border-[#0099DD] text-[#0099DD]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isSalesAgent ? 'إحصائيات أدائي' : 'تقارير وأداء المناديب'}</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-[#0099DD] text-[#0099DD]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isSalesAgent ? 'سجل حركاتي (Data Log)' : 'سجل العمليات والإسناد (Data Log)'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              activeTab === 'logs' ? 'bg-[#0099DD]/10 text-[#0099DD]' : 'bg-slate-100 text-slate-500'
            }`}>
              {filteredLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: CUSTOMERS DIRECTORY                                             */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل أو الشركة أو الهاتف..."
                className="w-full pl-3 pr-9 py-2 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 shrink-0">تصفية حسب المندوب:</span>
                <select
                  value={selectedRepFilter}
                  onChange={(e) => setSelectedRepFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0099DD] cursor-pointer"
                >
                  <option value="all">كل المناديب ({customers.length})</option>
                  <option value="unassigned">بدون مندوب معين</option>
                  {salesAgents.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.full_name} ({repCustomerCounts[sa.id] || 0} عميل)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">العميل والنشاط</th>
                    <th className="p-3.5">بيانات الاتصال والتواصل</th>
                    <th className="p-3.5">المندوب المعتمد (Sticky Rep)</th>
                    <th className="p-3.5">طريقة الإسناد</th>
                    <th className="p-3.5">الطلبات والمشتريات</th>
                    <th className="p-3.5">تاريخ التسجيل</th>
                    {isAdmin && <th className="p-3.5 text-center">الإجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        لا يوجد عملاء مطابقون للبحث الحالي.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const stat = customerStats[c.id] || { orderCount: 0, totalSpent: 0 };
                      const rep = c.assigned_sales_rep_id
                        ? salesAgents.find((s) => s.id === c.assigned_sales_rep_id) || { full_name: c.assigned_sales_rep_name || 'مندوب مبيعات' }
                        : null;

                      // Find latest assignment log for this customer
                      const latestAssignment = salesRepAssignments.find((a) => a.customer_id === c.id);

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition">
                          {/* Customer & Company */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{c.full_name}</div>
                            {c.company_name && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{c.company_name}</span>
                              </div>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="p-3.5">
                            <div className="font-mono text-slate-700 flex items-center gap-1 font-semibold">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                            <div className="mt-1">
                              <a
                                href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `مرحباً ${c.full_name}، أتواصل معك من متجر MH EL MAHDY.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>واتساب العميل</span>
                              </a>
                            </div>
                          </td>

                          {/* Sticky Sales Rep */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-[#0099DD]" />
                              <span>{rep ? rep.full_name : 'غير محدد'}</span>
                            </div>
                          </td>

                          {/* Assignment Type */}
                          <td className="p-3.5">
                            {renderAssignmentBadge(c.assignment_type || latestAssignment?.assignment_type)}
                          </td>

                          {/* Orders & Total Spent */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{stat.orderCount} طلبات</div>
                            <div className="text-[11px] font-mono text-[#0099DD] font-bold mt-0.5">
                              {stat.totalSpent.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                            </div>
                          </td>

                          {/* Created At */}
                          <td className="p-3.5 text-slate-500 text-[11px] font-mono">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : 'مسجل'}
                          </td>

                          {/* Admin Actions */}
                          {isAdmin && (
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => openTransferModal(c)}
                                className="px-3 py-1.5 text-xs font-bold text-[#0099DD] hover:bg-sky-50 border border-sky-200 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-[#0099DD]" />
                                <span>تحويل المندوب</span>
                              </button>
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
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SALES REPS PERFORMANCE REPORTS                                  */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">المناديب النشطين</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{performanceReports.length}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">متاحين لاستقبال العملاء</div>
              </div>
              <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-[#0099DD]">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">إجمالي العملاء المربوطين</div>
                <div className="text-2xl font-black text-[#0099DD] mt-1">{totalAssignedCustomers}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">من أصل {customers.length} عميل مسجل</div>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">إجمالي مبيعات المناديب</div>
                <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                  {totalRevenueAllReps.toLocaleString('ar-EG', { minimumFractionDigits: 0 })} ج.م
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">للطلبات المؤكدة والمسلمة</div>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">توازن التوزيع العادل</div>
                <div className="text-xl font-black text-emerald-600 mt-1">متكافئ ومفعل</div>
                <div className="text-[11px] text-slate-400 mt-0.5">خوارزمية الأقل تشغيلاً</div>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Performance Comparative Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">جدول مقارنة أداء وتوزيع المناديب</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  إحصائيات تفصيلية تشمل مصدر العملاء (طلب عميل / توزيع تلقائي) وحجم المبيعات ونسبة الإنجاز.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">المندوب</th>
                    <th className="p-3.5">العملاء الحاليين</th>
                    <th className="p-3.5">حصة التوزيع (Load Share)</th>
                    <th className="p-3.5">طلب مباشر (بالاسم)</th>
                    <th className="p-3.5">توزيع عادل (تلقائي)</th>
                    <th className="p-3.5">التحويلات (وارد / صادر)</th>
                    <th className="p-3.5">إجمالي الطلبات</th>
                    <th className="p-3.5">نسبة الإنجاز</th>
                    <th className="p-3.5">إجمالي المبيعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {performanceReports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        لا يوجد مناديب مبيعات مسجلين في النظام.
                      </td>
                    </tr>
                  ) : (
                    performanceReports.map((rep) => (
                      <tr key={rep.repId} className="hover:bg-slate-50/60 transition">
                        {/* Rep Name & Phone */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{rep.repName}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rep.repPhone}</div>
                        </td>

                        {/* Customer Count */}
                        <td className="p-3.5 font-bold text-slate-900">
                          <span className="text-base font-black text-[#0099DD]">{rep.totalCustomers}</span> عميل
                        </td>

                        {/* Load Share with Bar */}
                        <td className="p-3.5 min-w-[130px]">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                            <span>{rep.loadSharePercentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0099DD] rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(5, rep.loadSharePercentage))}%` }}
                            />
                          </div>
                        </td>

                        {/* Customer Choice Count */}
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {rep.customerChoiceCount}
                          </span>
                        </td>

                        {/* Auto Distributed Count */}
                        <td className="p-3.5">
                          <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                            {rep.autoDistributedCount}
                          </span>
                        </td>

                        {/* Transfers In / Out */}
                        <td className="p-3.5 text-slate-600 font-mono">
                          <span className="text-emerald-600 font-bold">+{rep.transferredInCount}</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="text-rose-600 font-bold">-{rep.transferredOutCount}</span>
                        </td>

                        {/* Total Orders */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{rep.totalOrders} طلب</div>
                          <div className="text-[10px] text-slate-400">
                            ({rep.deliveredOrders} تم التسليم - {rep.pendingOrders} معلّق)
                          </div>
                        </td>

                        {/* Conversion Rate */}
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-600">
                            {rep.conversionRate.toFixed(0)}%
                          </span>
                        </td>

                        {/* Total Revenue */}
                        <td className="p-3.5 font-bold font-mono text-[#0099DD]">
                          {rep.totalRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 0 })} ج.م
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: DATA LOG (CHRONOLOGICAL ASSIGNMENT & TRANSFER HISTORY)           */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="بحث في سجل العمليات (العميل، المندوب، الملاحظة)..."
                className="w-full pl-3 pr-9 py-2 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0099DD] cursor-pointer"
              >
                <option value="all">كل أنواع العمليات</option>
                <option value="customer_choice">طلب العميل بالاسم</option>
                <option value="auto_fair_distribution">توزيع عادل تلقائي</option>
                <option value="admin_transfer">تحويل إداري</option>
              </select>

              {/* Rep Filter for Admin */}
              {isAdmin && (
                <select
                  value={logRepFilter}
                  onChange={(e) => setLogRepFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#0099DD] cursor-pointer"
                >
                  <option value="all">كل المناديب</option>
                  {salesAgents.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">الوقت والتاريخ</th>
                    <th className="p-3.5">العميل والمؤسسة</th>
                    <th className="p-3.5">نوع العملية</th>
                    <th className="p-3.5">المندوب المسند له</th>
                    <th className="p-3.5">المندوب السابق (إن وجد)</th>
                    <th className="p-3.5">السبب / الملاحظات</th>
                    <th className="p-3.5">المسؤول عن الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        لا توجد حركات مسجلة مطابقة لمعايير البحث في سجل الـ Data Log.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        {/* Timestamp */}
                        <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-1 font-bold text-slate-700">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(log.created_at).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{log.customer_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{log.customer_phone}</div>
                          {log.customer_company && (
                            <div className="text-[10px] text-slate-500">{log.customer_company}</div>
                          )}
                        </td>

                        {/* Type Badge */}
                        <td className="p-3.5">
                          {renderAssignmentBadge(log.assignment_type)}
                        </td>

                        {/* Target Rep */}
                        <td className="p-3.5 font-bold text-slate-900">
                          {log.sales_rep_name || 'غير محدد'}
                        </td>

                        {/* Previous Rep */}
                        <td className="p-3.5 text-slate-500">
                          {log.previous_rep_name ? (
                            <span className="line-through text-slate-400">{log.previous_rep_name}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="p-3.5 text-slate-600 max-w-xs">
                          {log.notes || 'لا توجد ملاحظات'}
                        </td>

                        {/* Assigned By */}
                        <td className="p-3.5 text-slate-500 text-[11px]">
                          {log.assigned_by_name ? (
                            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              الإدارة: {log.assigned_by_name}
                            </span>
                          ) : log.assignment_type === 'customer_choice' ? (
                            <span className="text-slate-600">العميل نفسه</span>
                          ) : (
                            <span className="text-slate-400">النظام التلقائي</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADMIN TRANSFER CUSTOMER REP                                     */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {transferCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0099DD]/20 text-[#0099DD] flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">تحويل العميل إلى مندوب آخر</h3>
                  <p className="text-[11px] text-slate-300">إعادة تعيين المندوب المسؤول وتوثيق الحركة في سجل العمليات</p>
                </div>
              </div>
              <button
                onClick={closeTransferModal}
                disabled={isTransferring}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Customer Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">{transferCustomer.full_name}</div>
                  <span className="text-xs font-mono font-bold text-slate-600">{transferCustomer.phone}</span>
                </div>
                {transferCustomer.company_name && (
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{transferCustomer.company_name}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">المندوب الحالي:</span>
                  <span className="font-bold text-slate-800">
                    {transferCustomer.assigned_sales_rep_name || 'غير محدد'}
                  </span>
                </div>
              </div>

              {/* Target Rep Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  اختر المندوب الجديد *
                </label>
                <select
                  value={selectedTargetRepId}
                  onChange={(e) => setSelectedTargetRepId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:border-[#0099DD] focus:ring-2 focus:ring-[#0099DD]/20 cursor-pointer"
                >
                  <option value="">-- اختر المندوب من القائمة --</option>
                  {salesAgents.map((sa) => {
                    const isCurrent = sa.id === transferCustomer.assigned_sales_rep_id;
                    return (
                      <option key={sa.id} value={sa.id} disabled={isCurrent}>
                        {sa.full_name} ({repCustomerCounts[sa.id] || 0} عميل) {isCurrent ? '(المندوب الحالي)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  ملاحظة: عدد العملاء موضح بجانب كل مندوب للمساعدة في تحقيق التوزيع العادل والمتوازن.
                </p>
              </div>

              {/* Reassign Pending Orders Checkbox */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reassignPendingOrders}
                    onChange={(e) => setReassignPendingOrders(e.target.checked)}
                    className="mt-0.5 rounded text-[#0099DD] focus:ring-[#0099DD] cursor-pointer"
                  />
                  <div className="text-xs text-sky-900 leading-relaxed">
                    <span className="font-bold">نقل الطلبات المعلقة (Pending): </span>
                    تحويل كافة الطلبات قيد المراجعة الخاصة بهذا العميل إلى المندوب الجديد لتأكيدها وتجهيزها مباشرة.
                  </div>
                </label>
              </div>

              {/* Reason / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  سبب التحويل / ملاحظات إدارية
                </label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="مثال: بناءً على طلب العميل، إعادة توزيع جغرافي، إجازة المندوب..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#0099DD] focus:ring-1 focus:ring-[#0099DD]/30"
                />
              </div>

              {/* Feedback Alert */}
              {transferFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    transferFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {transferFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{transferFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeTransferModal}
                disabled={isTransferring}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={isTransferring || !selectedTargetRepId || selectedTargetRepId === transferCustomer.assigned_sales_rep_id}
                className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري تحويل العميل...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>تأكيد التحويل وحفظ السجل</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
