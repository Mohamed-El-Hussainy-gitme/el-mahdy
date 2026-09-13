'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import CompatibilityModal from '@/components/CompatibilityModal';
import CartDrawer from '@/components/CartDrawer';
import WishlistDrawer from '@/components/WishlistDrawer';
import UserAccountModal from '@/components/UserAccountModal';
import ShortageModal from '@/components/ShortageModal';
import FloatingWidgets from '@/components/FloatingWidgets';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import { useStore } from '@/context/StoreContext';
import {
  Heart,
  ShoppingCart,
  Trash2,
  ArrowRight,
  PackageSearch,
  Sparkles,
  ShieldCheck,
  Truck,
  Phone,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function FavoritesPage() {
  const {
    products,
    wishlist,
    clearWishlist,
    addToCart,
    cartItemsCount,
  } = useStore();

  const [notification, setNotification] = useState<string | null>(null);

  // Filter products that are in the user's wishlist
  const wishlistedProducts = useMemo(() => {
    return products.filter((p) => wishlist.includes(p.id));
  }, [products, wishlist]);

  // Calculate estimated total value
  const estimatedTotal = useMemo(() => {
    return wishlistedProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  }, [wishlistedProducts]);

  // Bulk add direct products to cart
  const handleAddAllToCart = () => {
    let addedCount = 0;
    wishlistedProducts.forEach((p) => {
      if (!p.has_compatibility_matrix) {
        addToCart(p);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setNotification(`تمت إضافة ${addedCount} منتج متوفر إلى سلة المشتريات بنجاح!`);
      setTimeout(() => setNotification(null), 4000);
    } else if (wishlistedProducts.length > 0) {
      alert('المنتجات الموجودة في مفضلتك تتطلب تحديد الموديل والكمية من زر "الموديل" في بطاقة كل منتج.');
    }
  };

  const handleClearConfirm = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تفريغ قائمة المفضلة بالكامل؟')) {
      clearWishlist();
      setNotification('تم تفريغ قائمة المفضلة بنجاح.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] pb-16 md:pb-0 font-cairo" dir="rtl">
      {/* 1. Navbar */}
      <Navbar />

      {/* 2. Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top duration-300 text-xs font-bold border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
          <span>{notification}</span>
        </div>
      )}

      {/* 3. Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        
        {/* Breadcrumb */}
        <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-medium">
          <Link href="/" className="hover:text-[#0099DD] transition">
            الرئيسية
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">قائمة مفضلاتي</span>
        </nav>

        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 shrink-0">
                <Heart className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg md:text-xl font-black text-slate-900">
                    قائمة مفضلاتي
                  </h1>
                  <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {wishlistedProducts.length} {wishlistedProducts.length === 1 ? 'منتج' : 'منتجات'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  المنتجات والأصناف التي قمت بحفظها لسهولة الرجوع إليها، مقارنتها، وإتمام طلبات التوريد بالجملة.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            {wishlistedProducts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
                <button
                  type="button"
                  onClick={handleAddAllToCart}
                  className="bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2 rounded-xl text-xs font-bold shadow transition flex items-center gap-2 active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>إضافة المتاح للسلة</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearConfirm}
                  className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ المفضلة</span>
                </button>

                <Link
                  href="/"
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>متابعة التسوق</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </Link>
              </div>
            )}

          </div>

          {/* Stats Summary Bar */}
          {wishlistedProducts.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">إجمالي الأصناف:</span>
                <span className="font-extrabold text-slate-800 text-sm">{wishlistedProducts.length} صنف</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">القيمة التقديرية:</span>
                <span className="font-extrabold text-[#0099DD] text-sm">{estimatedTotal.toLocaleString()} ج.م</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[11px]">متاحة للطلب الفوري:</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  {wishlistedProducts.filter((p) => !p.has_compatibility_matrix).length} منتج مباشر
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Products Grid or Empty State */}
        {wishlistedProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 md:p-16 text-center space-y-4 shadow-sm max-w-2xl mx-auto my-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-400 rounded-3xl flex items-center justify-center mx-auto border border-rose-100">
              <Heart className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base md:text-lg font-black text-slate-800">
                قائمة المفضلة فارغة حالياً
              </h2>
              <p className="text-xs md:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                لم تقم بحفظ أي منتجات في مفضلتك بعد. تصفح كتالوج المنتجات واضغط على أيقونة القلب على أي منتج لحفظه والرجوع إليه بسهولة لاحقاً.
              </p>
            </div>
            <div className="pt-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md transition active:scale-95"
              >
                <span>تصفح كتالوج المنتجات الآن</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {wishlistedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

      </main>

      {/* 4. Dynamic Footer */}
      <Footer />

      {/* 5. Modals, Drawers & Mobile Nav */}
      <CompatibilityModal />
      <CartDrawer />
      <WishlistDrawer />
      <UserAccountModal />
      <ShortageModal />
      <FloatingWidgets />
      <MobileBottomNav />
    </div>
  );
}
