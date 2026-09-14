'use client';

import React, { useState, useMemo } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Boxes,
  Phone,
  Building,
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Shield,
  AlertTriangle,
  Printer,
  FileText,
  X,
} from 'lucide-react';
import { Order, OrderStatus, UserProfile, UserRole, ReturnReason } from '@/types';
import { canTransitionOrder, getOrderStatusBadge, filterOrdersForRole } from '@/services/orderService';
import { printPickingSlip, printDeliveryInvoice } from '@/lib/print';

interface OrdersManagerProps {
  orders: Order[];
  staffSession: UserProfile;
  onUpdateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    trackingNotes?: string,
    carrierName?: string,
    waybillNumber?: string,
    returnReason?: ReturnReason,
    returnNotes?: string
  ) => void | Promise<any>;
  onAssignSalesRep?: (customerId: string, salesRepId: string) => void | Promise<any>;
}

export const OrdersManager: React.FC<OrdersManagerProps> = ({
  orders,
  staffSession,
  onUpdateOrderStatus,
  onAssignSalesRep,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [trackingNotesInput, setTrackingNotesInput] = useState<Record<string, string>>({});

  // Shipping Modal State
  const [shippingModalOrder, setShippingModalOrder] = useState<Order | null>(null);
  const [carrierNameInput, setCarrierNameInput] = useState('');
  const [waybillInput, setWaybillInput] = useState('');

  // Return Modal State
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReasonInput, setReturnReasonInput] = useState<ReturnReason>('customer_refused');
  const [returnNotesInput, setReturnNotesInput] = useState('');

  // Filter orders according to RBAC role
  const roleAccessibleOrders = useMemo(() => {
    return filterOrdersForRole(orders, staffSession);
  }, [orders, staffSession]);

  const filteredOrders = useMemo(() => {
    return roleAccessibleOrders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = order.order_number.toLowerCase().includes(q);
        const matchCust = order.customer_name.toLowerCase().includes(q);
        const matchPhone = order.customer_phone.toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchPhone) {
          return false;
        }
      }
      return true;
    });
  }, [roleAccessibleOrders, statusFilter, searchQuery]);

  const handleTransition = (order: Order, targetStatus: OrderStatus) => {
    const transitionCheck = canTransitionOrder(order.status, targetStatus, staffSession.role);
    if (!transitionCheck.allowed) {
      alert(transitionCheck.reason || 'لا يمكنك تغيير حالة هذا الطلب.');
      return;
    }

    if (targetStatus === 'shipping') {
      setShippingModalOrder(order);
      setCarrierNameInput(order.carrier_name || '');
      setWaybillInput(order.waybill_number || '');
      return;
    }

    if (targetStatus === 'returned') {
      setReturnModalOrder(order);
      setReturnReasonInput(order.return_reason || 'customer_refused');
      setReturnNotesInput(order.return_notes || '');
      return;
    }

    const tracking = trackingNotesInput[order.id];
    onUpdateOrderStatus(order.id, targetStatus, tracking);
  };

  const confirmShipping = () => {
    if (!shippingModalOrder) return;
    const tracking = trackingNotesInput[shippingModalOrder.id];
    onUpdateOrderStatus(
      shippingModalOrder.id,
      'shipping',
      tracking,
      carrierNameInput.trim() || undefined,
      waybillInput.trim() || undefined
    );
    setShippingModalOrder(null);
  };

  const confirmReturn = () => {
    if (!returnModalOrder) return;
    const tracking = trackingNotesInput[returnModalOrder.id];
    onUpdateOrderStatus(
      returnModalOrder.id,
      'returned',
      tracking,
      undefined,
      undefined,
      returnReasonInput,
      returnNotesInput.trim() || undefined
    );
    setReturnModalOrder(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Business Logic Alert */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-[#0099DD]" />
              <span>
                {staffSession.role === 'sales_agent'
                  ? `طلبات عملائي ومتابعة المبيعات (${filteredOrders.length})`
                  : (staffSession.role as string) === 'warehouse_preparer' || (staffSession.role as string) === 'warehouse'
                  ? `أوامر التجهيز والشحن بالمستودع (${filteredOrders.length})`
                  : `إدارة الطلبات ودورة الحياة (${filteredOrders.length})`}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {staffSession.role === 'sales_agent'
                ? 'مراجعة طلبات عملائك، تأكيدها ونقلها إلى التجهيز، أو المطالبة بالطلبات المعلقة.'
                : (staffSession.role as string) === 'warehouse_preparer' || (staffSession.role as string) === 'warehouse'
                ? 'تجهيز بضائع الطلبات، طباعة إذن الصرف وفاتورة التسليم، وتسجيل شركة الشحن والبوليصة.'
                : 'دورة حياة رباعية: قيد المراجعة (تأكيد المندوب) ← التجهيز (المستودع) ← الشحن ← التسليم / المرتجع.'}
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطلب أو العميل أو الهاتف..."
              className="w-full pl-3 pr-9 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-[#0099DD]"
            />
          </div>
        </div>

        {/* Operational Logic Banner */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <Boxes className="w-4 h-4 text-[#0099DD] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">قاعدة حجز المخزون (Inventory Hold): </span>
            إضافة المنتجات للسلة أو إنشاء الطلب لا يخصم المخزون. المخزون يُخصم رسمياً فقط عندما يقوم المندوب المعتمد بنقل
            الطلب من <span className="font-bold text-amber-700 bg-amber-100/70 px-1 rounded">قيد المراجعة</span> إلى{' '}
            <span className="font-bold text-blue-700 bg-blue-100/70 px-1 rounded">التجهيز</span>.
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {((staffSession.role as string) === 'warehouse_preparer' || (staffSession.role as string) === 'warehouse'
            ? [
                { id: 'all', label: 'كل أوامر المستودع' },
                { id: 'preparation', label: '1. أوامر جاري التجهيز' },
                { id: 'shipping', label: '2. شحنات قيد التوصيل' },
              ]
            : [
                { id: 'all', label: staffSession.role === 'sales_agent' ? 'كل طلباتي' : 'كل الطلبات' },
                { id: 'pending', label: '1. قيد المراجعة' },
                { id: 'preparation', label: '2. جاري التجهيز' },
                { id: 'shipping', label: '3. تم الشحن' },
                { id: 'delivered', label: '4. تم التسليم' },
                { id: 'returned', label: 'مرتجع' },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === tab.id
                  ? 'bg-[#0099DD] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400">
            لا توجد طلبات في هذا القسم حالياً.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const badge = getOrderStatusBadge(order.status);
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-slate-300 transition"
              >
                {/* Order Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left info: order num, customer, date */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-extrabold text-slate-900 text-sm">{order.order_number}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bgClass} ${badge.colorClass} ${badge.borderClass}`}
                      >
                        {badge.labelAr}
                      </span>
                      {!order.sales_agent_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          بانتظار تخصيص مندوب
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="font-bold text-slate-900">{order.customer_name}</span>
                      <span className="flex items-center gap-1 text-slate-500 font-mono">
                        <Phone className="w-3 h-3" />
                        {order.customer_phone}
                      </span>
                      {order.customer_company && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Building className="w-3 h-3" />
                          {order.customer_company}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(order.created_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  {/* Right: Total, Items count, Expansion trigger */}
                  <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[11px] text-slate-400 block">إجمالي الطلب:</span>
                      <span className="text-base font-extrabold text-[#0099DD]">
                        {order.total_amount.toFixed(2)} ج.م
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
                    >
                      <span>{order.items.length} أصناف</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="bg-slate-50/70 p-4 sm:p-5 border-t border-slate-200 space-y-4 text-xs">
                    {/* Order metadata & Sticky Sales Rep */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-500 block mb-0.5">المندوب المعين (Sticky Rep):</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${order.sales_agent_name ? 'text-slate-800' : 'text-amber-600 font-bold'}`}>
                            {order.sales_agent_name || 'غير مخصص بعد'}
                          </span>
                          {!order.sales_agent_id && (staffSession.role === 'sales_agent' || staffSession.role === 'admin') && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (onAssignSalesRep && order.customer_id) {
                                  await onAssignSalesRep(order.customer_id, staffSession.id);
                                }
                              }}
                              className="text-[10px] bg-[#0099DD] hover:bg-[#007BB3] text-white px-2 py-0.5 rounded font-bold transition shadow-xs whitespace-nowrap"
                            >
                              المطالبة بالعميل
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block mb-0.5">عنوان الشحن:</span>
                        <span className="text-slate-700">{order.shipping_address || 'استلام من المستودع'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block mb-0.5">شركة الشحن / البوليصة:</span>
                        <span className="text-slate-700 font-mono">
                          {order.carrier_name ? `${order.carrier_name} ` : ''}
                          {order.waybill_number ? `(${order.waybill_number})` : 'لم تحدد بعد'}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block mb-0.5">ملاحظات التتبع / الشحن:</span>
                        <span className="text-slate-700">{order.tracking_notes || 'لا توجد ملاحظات'}</span>
                      </div>
                    </div>

                    {/* Return Info Box if Order is Returned */}
                    {order.status === 'returned' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                        <div className="flex items-center gap-2 font-bold">
                          <RotateCcw className="w-4 h-4" />
                          <span>بيانات المرتجع:</span>
                          <span className="bg-rose-200/80 px-2 py-0.5 rounded text-[11px]">
                            {order.return_reason === 'customer_refused' && 'رفض العميل الاستلام'}
                            {order.return_reason === 'damaged_in_transit' && 'تلف أثناء الشحن'}
                            {order.return_reason === 'wrong_order' && 'خطأ في تجهيز الطلب'}
                            {order.return_reason === 'wrong_model' && 'موديل غير متطابق'}
                            {(!order.return_reason || order.return_reason === 'other') && 'سبب آخر'}
                          </span>
                        </div>
                        {order.return_notes && (
                          <p className="text-[11px] text-rose-700">{order.return_notes}</p>
                        )}
                      </div>
                    )}

                    {/* Order Lifecycle Visual Timeline */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#0099DD]" />
                        <span>مخطط دورة حياة الطلب والتوقيتات:</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Step 1: Created */}
                        <div className={`p-2.5 rounded-lg border text-[11px] ${order.created_at ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          <div className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>1. إنشاء الطلب</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-'}
                          </div>
                        </div>

                        {/* Step 2: Confirmed / Preparation */}
                        <div className={`p-2.5 rounded-lg border text-[11px] ${order.confirmed_at || ['preparation', 'shipping', 'delivered', 'returned'].includes(order.status) ? 'bg-blue-50/70 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          <div className="font-bold flex items-center gap-1">
                            {order.confirmed_at || ['preparation', 'shipping', 'delivered', 'returned'].includes(order.status) ? (
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-400" />
                            )}
                            <span>2. تأكيد وحجز المخزون</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {order.confirmed_at ? new Date(order.confirmed_at).toLocaleString('ar-EG') : 'بانتظار التأكيد'}
                          </div>
                        </div>

                        {/* Step 3: Shipped */}
                        <div className={`p-2.5 rounded-lg border text-[11px] ${order.shipped_at || ['shipping', 'delivered', 'returned'].includes(order.status) ? 'bg-purple-50/70 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          <div className="font-bold flex items-center gap-1">
                            {order.shipped_at || ['shipping', 'delivered', 'returned'].includes(order.status) ? (
                              <Truck className="w-3 h-3 text-purple-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-slate-400" />
                            )}
                            <span>3. خروج للشحن</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {order.shipped_at ? new Date(order.shipped_at).toLocaleString('ar-EG') : 'بانتظار الشحن'}
                          </div>
                        </div>

                        {/* Step 4: Final (Delivered or Returned) */}
                        <div className={`p-2.5 rounded-lg border text-[11px] ${order.status === 'returned' ? 'bg-rose-50/70 border-rose-200 text-rose-900' : order.status === 'delivered' ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          <div className="font-bold flex items-center gap-1">
                            {order.status === 'returned' ? (
                              <>
                                <RotateCcw className="w-3 h-3 text-rose-600" />
                                <span>4. مرتجع</span>
                              </>
                            ) : order.status === 'delivered' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>4. تم التسليم</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>4. التسليم النهائي</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {order.status === 'returned' && order.returned_at ? new Date(order.returned_at).toLocaleString('ar-EG') : order.status === 'delivered' && order.delivered_at ? new Date(order.delivered_at).toLocaleString('ar-EG') : 'قيد المتابعة'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order Items Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">المنتج</th>
                            <th className="p-3">كود SKU</th>
                            <th className="p-3">الموديل المتوافق</th>
                            <th className="p-3">الكمية</th>
                            <th className="p-3">سعر الوحدة</th>
                            <th className="p-3">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {order.items.map((item) => (
                            <tr key={item.id}>
                              <td className="p-3 font-bold text-slate-900">{item.product_title}</td>
                              <td className="p-3 font-mono text-slate-500">{item.product_sku}</td>
                              <td className="p-3">
                                {item.model_name ? (
                                  <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {item.model_name}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 font-bold text-slate-900">{item.quantity} قطعة</td>
                              <td className="p-3 text-slate-600">{item.unit_price.toFixed(2)} ج.م</td>
                              <td className="p-3 font-bold text-[#0099DD]">{item.subtotal.toFixed(2)} ج.م</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Print & Lifecycle Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                      {/* Printable Invoices / Slips */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => printPickingSlip(order)}
                          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                          title="طباعة إذن صرف مخزني لمسؤول المستودع"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>إذن صرف مخزني</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => printDeliveryInvoice(order)}
                          className="flex items-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                          title="طباعة فاتورة تسليم بضاعة للعميل"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>فاتورة التسليم</span>
                        </button>

                        <input
                          type="text"
                          placeholder="ملاحظات تتبع الشحنة..."
                          value={trackingNotesInput[order.id] || ''}
                          onChange={(e) =>
                            setTrackingNotesInput({
                              ...trackingNotesInput,
                              [order.id]: e.target.value,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-52 focus:ring-2 focus:ring-[#0099DD]"
                        />
                      </div>

                      {/* State Transition Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Pending -> Preparation (Sales Rep / Admin) */}
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleTransition(order, 'preparation')}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تأكيد الطلب وخصم المخزون (تحويل للتجهيز)</span>
                          </button>
                        )}

                        {/* 2. Preparation -> Shipping (Warehouse / Admin) */}
                        {order.status === 'preparation' && (
                          <button
                            onClick={() => handleTransition(order, 'shipping')}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>اكتمال التجهيز ← بيانات الشحن</span>
                          </button>
                        )}

                        {/* 3. Shipping -> Delivered (Warehouse / Sales Rep / Admin) */}
                        {order.status === 'shipping' && (
                          <>
                            <button
                              onClick={() => handleTransition(order, 'delivered')}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>إثبات التسليم بنجاح</span>
                            </button>

                            <button
                              onClick={() => handleTransition(order, 'returned')}
                              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>تسجيل كمرتجع</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Shipping Details Modal */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span>بيانات شركة الشحن والبوليصة — {shippingModalOrder.order_number}</span>
              </h3>
              <button onClick={() => setShippingModalOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">شركة الشحن أو الناقل</label>
                <input
                  type="text"
                  placeholder="مثال: DHL، J&T Express، سيارة مستودع المهدي..."
                  value={carrierNameInput}
                  onChange={(e) => setCarrierNameInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم بوليصة الشحن (Waybill Number)</label>
                <input
                  type="text"
                  placeholder="مثال: WB-98721034"
                  value={waybillInput}
                  onChange={(e) => setWaybillInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShippingModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmShipping}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md"
              >
                تأكيد وتحويل للشحن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Reason Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 text-rose-600">
                <RotateCcw className="w-4 h-4" />
                <span>تسجيل مرتجع الطلب — {returnModalOrder.order_number}</span>
              </h3>
              <button onClick={() => setReturnModalOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الإرجاع</label>
                <select
                  value={returnReasonInput}
                  onChange={(e) => setReturnReasonInput(e.target.value as ReturnReason)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="customer_refused">رفض العميل الاستلام</option>
                  <option value="damaged_in_transit">تلف أثناء الشحن أو النقل</option>
                  <option value="wrong_order">خطأ في تجهيز الطلب من المستودع</option>
                  <option value="wrong_model">موديل الهاتف غير متطابق</option>
                  <option value="other">سبب آخر</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تفاصيل وملاحظات إضافية عن المرتجع</label>
                <textarea
                  rows={3}
                  placeholder="اكتب ملاحظات تفصيلية عن حالة الشحنة المرتجعة..."
                  value={returnNotesInput}
                  onChange={(e) => setReturnNotesInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmReturn}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md"
              >
                تأكيد تسجيل المرتجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
