'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  User,
  AlertCircle,
  CheckCircle,
  Truck,
  ShieldAlert,
  Send,
  ArrowLeft,
  Building,
  Loader2,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    cartTotal,
    cartItemsCount,
    currentUser,
    setIsAccountModalOpen,
    openAccountModalWithTab,
    placePendingOrder,
    storeSettings,
  } = useStore();

  const [shippingAddress, setShippingAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingOrder) return;

    if (!currentUser) {
      setIsAccountModalOpen(true);
      return;
    }
    if (!shippingAddress.trim()) {
      alert('يرجى كتابة عنوان الشحن أو تفاصيل مقر التسليم');
      return;
    }

    try {
      setIsSubmittingOrder(true);
      const order = await placePendingOrder(shippingAddress.trim(), orderNotes.trim());
      if (order) {
        setSubmittedOrderNumber(order.order_number);
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          
          {/* Drawer Header */}
          <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#38bdf8]" />
              <div>
                <h3 className="font-bold text-sm">سلة الطلبات التجارية</h3>
                <p className="text-[11px] text-slate-300">
                  {cartItemsCount} قطعة في السلة
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsCartOpen(false);
                setSubmittedOrderNumber(null);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Success View when Order Placed */}
            {submittedOrderNumber ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg">تم تسجيل طلبك بنجاح!</h4>
                  <p className="text-xs text-slate-500 font-mono mt-1">رقم الطلب: {submittedOrderNumber}</p>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-slate-700 text-right space-y-2">
                  <p className="font-bold text-[#0099DD] flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> طلبك الآن في مرحلة: قيد المراجعة والتحقق
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {currentUser?.assigned_sales_rep_id ? (
                      <>
                        سيقوم مندوب مبيعاتك المعتمد (<span className="font-bold">{currentUser.assigned_sales_rep_name}</span>) بمراجعة الطلب وتأكيد الكميات والموديلات، وحجز المخزون رسميًا.
                      </>
                    ) : (
                      <>
                        سيقوم فريق المبيعات بمراجعة الطلب وتأكيد الكميات والموديلات، وسيتم تعيين مندوب مبيعات دائم لمتابعة حسابك فور بدء تجهيز أول طلب.
                      </>
                    )}
                  </p>
                </div>
                <div className="pt-4 flex flex-col gap-2">
                  <a
                    href={
                      currentUser?.assigned_sales_rep_id && currentUser.assigned_sales_rep_phone
                        ? `https://wa.me/${currentUser.assigned_sales_rep_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً، قمت بتسجيل طلب تجاري رقم ${submittedOrderNumber} بقيمة ${cartTotal.toFixed(2)} ج.م، برجاء المراجعة والتأكيد.`)}`
                        : `https://wa.me/${(storeSettings.whatsapp_number || '201012345678').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً، قمت بتسجيل طلب تجاري رقم ${submittedOrderNumber} بقيمة ${cartTotal.toFixed(2)} ج.م، برجاء المراجعة والتأكيد.`)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow"
                  >
                    <span>
                      {currentUser?.assigned_sales_rep_id
                        ? 'إرسال تفاصيل الطلب للمندوب عبر واتساب'
                        : 'إرسال تفاصيل الطلب لإدارة المبيعات عبر واتساب'}
                    </span>
                  </a>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setSubmittedOrderNumber(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    متابعة التسوق
                  </button>
                </div>
              </div>
            ) : cart.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-3">
                <ShoppingCart className="w-12 h-12 mx-auto opacity-30" />
                <p className="text-sm font-semibold text-slate-600">سلة الطلبات فارغة</p>
                <p className="text-xs text-slate-400">تصفح المنتجات وأضف الموديلات المطلوبة</p>
              </div>
            ) : (
              <>
                {/* Notice: Inventory Hold Policy */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">سياسة حجز المخزون B2B:</span> الكميات تُحجز وتُخصم من المستودع فقط لحظة تأكيد المندوب الرسمي للطلب، وإضافة المنتجات للسلة لا تحجز أي كمية مسبقاً.
                  </div>
                </div>

                {/* Items List */}
                <div className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          <Image
                            src={item.product.image_url || '/placeholder.svg'}
                            alt={item.product.title_ar}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-1 max-w-[180px]">
                            {item.product.title_ar}
                          </h4>
                          {item.model && (
                            <span className="inline-block text-[10px] font-bold text-[#0099DD] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                              موديل: {item.model.model_name}
                            </span>
                          )}
                          <div className="text-[11px] font-bold text-slate-800">
                            {item.unit_price.toFixed(2)} ج.م
                          </div>
                          {item.moq > 1 && (
                            <div className="text-[10px] text-slate-400">
                              الحد الأدنى: {item.moq} قطع
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Delete */}
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => removeFromCart(item.product.id, item.model?.id)}
                          className="text-slate-400 hover:text-red-500 transition"
                          title="حذف البند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                          <button
                            onClick={() =>
                              updateCartQuantity(
                                item.product.id,
                                Math.max(item.moq, item.quantity - 1),
                                item.model?.id
                              )
                            }
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={item.moq}
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                updateCartQuantity(item.product.id, val, item.model?.id);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (isNaN(val) || val < item.moq) {
                                updateCartQuantity(item.product.id, item.moq, item.model?.id);
                              }
                            }}
                            className="w-12 text-center text-xs font-bold text-slate-800 focus:outline-none focus:bg-sky-50 py-0.5 border-x border-slate-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="اضغط لكتابة الكمية مباشرة"
                          />
                          <button
                            onClick={() =>
                              updateCartQuantity(
                                item.product.id,
                                item.quantity + 1,
                                item.model?.id
                              )
                            }
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sticky Sales Rep Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="text-[11px] text-slate-500">مندوب المبيعات المسؤول عن هذا الطلب:</div>
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>{currentUser?.assigned_sales_rep_name || 'سيتم ربطه بالمندوب المعتمد عند التأكيد'}</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      {currentUser?.assigned_sales_rep_name ? 'تعيين دائم (Sticky)' : 'طلب جديد'}
                    </span>
                  </div>
                </div>

                {/* Checkout Form */}
                <form onSubmit={handleCheckout} className="space-y-3 pt-2">
                  {!currentUser ? (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-2">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-[#0099DD]" />
                        لا يوجد طلب كزائر (Guest Checkout)
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        يجب تسجيل الدخول أو إنشاء حساب شركة/تاجر لتتمكن من إرسال هذا الطلب للمندوب.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openAccountModalWithTab('login')}
                          className="bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-lg font-bold transition text-center"
                        >
                          تسجيل الدخول
                        </button>
                        <button
                          type="button"
                          onClick={() => openAccountModalWithTab('register')}
                          className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg font-bold transition text-center"
                        >
                          إنشاء حساب جديد
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          عنوان التسليم أو اسم الفرع / المحافظة *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="مثال: القاهرة - الموسكي - سنتر المهدي الدور 1"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#0099DD]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          ملاحظات إضافية للمندوب والمستودع
                        </label>
                        <textarea
                          rows={2}
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="أي تعليمات تخص مواعيد الاستلام أو التغليف..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#0099DD]"
                        />
                      </div>
                    </>
                  )}

                  {/* Pricing Total & Submit */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>إجمالي القطع:</span>
                      <span className="font-bold text-slate-900">{cartItemsCount} قطعة</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-800">إجمالي الطلب:</span>
                      <span className="font-black text-[#0099DD] text-base">
                        {cartTotal.toFixed(2)} ج.م
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={!currentUser || isSubmittingOrder}
                      className="w-full bg-[#0099DD] hover:bg-[#007BB3] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-2"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري إرسال الطلب للمراجعة...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>تأكيد وإرسال الطلب للمراجعة (طلب معلّق)</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center">
                      * لا يوجد دفع إلكتروني على الموقع. يتم التحصيل يدويًا بعد مراجعة المندوب.
                    </p>
                  </div>
                </form>
              </>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
