'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Phone,
  User,
  Calendar,
  ShieldAlert,
  Layers,
  List,
  Smartphone,
  Search,
} from 'lucide-react';
import { ShortageRequest, UserRole } from '@/types';
import { canManageShortages } from '@/services/authService';

interface ShortagesManagerProps {
  shortages: ShortageRequest[];
  currentRole: UserRole;
  onUpdateShortageStatus: (id: string, status: 'pending' | 'reviewed') => void | Promise<any>;
}

export const ShortagesManager: React.FC<ShortagesManagerProps> = ({
  shortages,
  currentRole,
  onUpdateShortageStatus,
}) => {
  const isAllowed = canManageShortages(currentRole);
  const [viewMode, setViewMode] = useState<'aggregated' | 'individual'>('aggregated');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  // Filtered individual list
  const filteredShortages = useMemo(() => {
    return shortages.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.brand.toLowerCase().includes(q) ||
        s.model_name.toLowerCase().includes(q) ||
        s.customer_name.toLowerCase().includes(q) ||
        s.customer_phone.includes(q);

      const matchStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [shortages, searchQuery, statusFilter]);

  // Aggregated view grouped by brand + model
  const aggregatedModels = useMemo(() => {
    const groups: Record<
      string,
      {
        brand: string;
        modelName: string;
        totalCount: number;
        pendingCount: number;
        reviewedCount: number;
        requests: ShortageRequest[];
      }
    > = {};

    filteredShortages.forEach((s) => {
      const key = `${s.brand}__${s.model_name}`.toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          brand: s.brand,
          modelName: s.model_name,
          totalCount: 0,
          pendingCount: 0,
          reviewedCount: 0,
          requests: [],
        };
      }
      groups[key].totalCount += 1;
      if (s.status === 'pending') groups[key].pendingCount += 1;
      if (s.status === 'reviewed') groups[key].reviewedCount += 1;
      groups[key].requests.push(s);
    });

    return Object.values(groups).sort((a, b) => b.totalCount - a.totalCount);
  }, [filteredShortages]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>سجل تنبيهات النواقص وإحصائيات التكرار ({shortages.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              حصر حجم الطلب على الموديلات غير المتوفرة لمساعدة قسم المشتريات والتوريد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('aggregated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                  viewMode === 'aggregated'
                    ? 'bg-[#0099DD] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>عرض مجمع (الأكثر طلباً)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('individual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                  viewMode === 'individual'
                    ? 'bg-[#0099DD] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>طلبات فردية</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالماركة أو الموديل..."
                className="w-full pl-3 pr-8 py-1.5 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl text-xs border border-slate-300 bg-white font-bold"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="reviewed">تمت المراجعة</option>
            </select>
          </div>
        </div>
      </div>

      {!isAllowed ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
          <ShieldAlert className="w-8 h-8 mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-bold">هذا القسم متاح للمدير ومندوبي المبيعات فقط.</p>
        </div>
      ) : filteredShortages.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          لا توجد طلبات نواقص مطابقة للبحث أو الفلتر الحالي.
        </div>
      ) : viewMode === 'aggregated' ? (
        /* Aggregated View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aggregatedModels.map((group) => (
            <div
              key={`${group.brand}-${group.modelName}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {group.brand}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">{group.modelName}</h3>
                  </div>
                </div>

                <div className="text-left">
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-black px-2.5 py-1 rounded-xl text-xs">
                    {group.totalCount} طلبات
                  </span>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-amber-700 font-bold">
                  قيد الانتظار: {group.pendingCount}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-bold">
                  تمت المراجعة: {group.reviewedCount}
                </span>
              </div>

              {/* Requesting Customers List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-slate-400">العملاء الطالبون لهذا الموديل:</div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {group.requests.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{r.customer_name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{r.customer_phone}</span>
                      </div>
                      <button
                        onClick={() =>
                          onUpdateShortageStatus(r.id, r.status === 'reviewed' ? 'pending' : 'reviewed')
                        }
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
                          r.status === 'reviewed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                        title="تبديل حالة المراجعة"
                      >
                        {r.status === 'reviewed' ? 'تمت المراجعة' : 'تحديد كمراجع'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Individual Requests View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShortages.map((s) => {
            const isReviewed = s.status === 'reviewed';

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border p-5 space-y-3.5 transition shadow-sm ${
                  isReviewed ? 'border-slate-200 opacity-80' : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400">الموديل المطلوب:</span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {s.brand} - {s.model_name}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      isReviewed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isReviewed ? 'تمت المراجعة' : 'قيد الانتظار'}
                  </span>
                </div>

                {/* Customer Details */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{s.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-slate-700">{s.customer_phone}</span>
                  </div>
                  {s.notes && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 mt-1">
                      ملاحظة العميل: {s.notes}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(s.created_at).toLocaleString('ar-EG')}</span>
                  </div>
                </div>

                {/* Status Toggle Button */}
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => onUpdateShortageStatus(s.id, isReviewed ? 'pending' : 'reviewed')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      isReviewed
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isReviewed ? 'إعادة للانتظار' : 'تحديد كمراجع ومسجل'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
