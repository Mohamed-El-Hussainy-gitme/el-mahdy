'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  X,
  Heart,
  ShoppingCart,
  Trash2,
  ArrowLeft,
  Package,
  Boxes,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function WishlistDrawer() {
  const {
    isWishlistOpen,
    setIsWishlistOpen,
    wishlist,
    toggleWishlist,
    clearWishlist,
    products,
    addToCart,
    openCompatibilityModal,
  } = useStore();

  if (!isWishlistOpen) return null;

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  const handleAddAllToCart = () => {
    let addedCount = 0;
    wishlistedProducts.forEach((p) => {
      if (!p.has_compatibility_matrix) {
        addToCart(p);
        addedCount++;
      }
    });
    if (addedCount > 0) {
      alert(`تمت إضافة ${addedCount} منتج متوفر إلى سلة المشتريات بنجاح.`);
    }
  };

  const handleClose = () => {
    setIsWishlistOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-cairo" dir="rtl">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-r border-slate-200 animate-in slide-in-from-left duration-300">
          
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Heart className="w-5 h-5 fill-current text-rose-500" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-2">
                  <span>قائمة مفضلاتي</span>
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {wishlist.length}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">المنتجات المحفوظة للرجوع السريع والطلب</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {wishlistedProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 border border-rose-100">
                  <Heart className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">قائمة المفضلة فارغة حالياً</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    اضغط على أيقونة القلب على أي منتج أثناء التصفح لحفظه في هذه القائمة لسهولة الرجوع إليه ومقارنته.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    const el = document.getElementById('products-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-[#0099DD] hover:bg-[#007BB3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  <Package className="w-4 h-4" />
                  <span>تصفح كتالوج المنتجات</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {wishlistedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white hover:shadow-sm transition"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
                      <Image
                        src={product.image_url || '/placeholder.svg'}
                        alt={product.title_ar}
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <span>كود:</span>
                        <span>{product.sku}</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-800 truncate" title={product.title_ar}>
                        {product.title_ar}
                      </h5>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="font-black text-xs text-slate-900">
                          {product.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500">ج.م</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {product.has_compatibility_matrix ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            openCompatibilityModal(product);
                          }}
                          className="flex items-center gap-1 bg-sky-50 text-[#0099DD] hover:bg-[#0099DD] hover:text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-sky-200 transition active:scale-95"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>الموديل</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="flex items-center gap-1 bg-[#0099DD] hover:bg-[#007BB3] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition active:scale-95"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>شراء</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="إزالة من المفضلة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {wishlistedProducts.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={handleAddAllToCart}
                className="w-full bg-[#0099DD] hover:bg-[#007BB3] text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-95"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>إضافة كافة المنتجات المباشرة للسلة</span>
              </button>

              <Link
                href="/favorites"
                onClick={handleClose}
                className="w-full py-2 rounded-xl text-center text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#0099DD]" />
                <span>فتح صفحة المفضلة الكاملة</span>
              </Link>

              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <button
                  type="button"
                  onClick={clearWishlist}
                  className="text-red-500 hover:text-red-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ المفضلة</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-slate-500 hover:text-slate-700 font-semibold hover:underline"
                >
                  متابعة التسوق
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
