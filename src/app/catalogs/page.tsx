'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { Layers, Flame, ArrowRight, ShieldCheck, Truck, Phone, ChevronRight, Package, Shield, Smartphone, BatteryCharging, Headphones, Watch, Car, Usb } from 'lucide-react';

export default function CatalogsPage() {
  const { products, categories, openCompatibilityModal, addToCart } = useStore();

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'screen-protectors': return <Shield className="w-8 h-8 text-[#0099DD]" />;
      case 'phone-cases': return <Smartphone className="w-8 h-8 text-indigo-500" />;
      case 'chargers-adapters':
      case 'charging-cables': return <BatteryCharging className="w-8 h-8 text-amber-500" />;
      case 'bluetooth-earbuds':
      case 'speakers': return <Headphones className="w-8 h-8 text-emerald-500" />;
      case 'smart-watches':
      case 'watches': return <Watch className="w-8 h-8 text-purple-500" />;
      case 'car-accessories': return <Car className="w-8 h-8 text-rose-500" />;
      case 'storage-memory': return <Usb className="w-8 h-8 text-cyan-500" />;
      default: return <Package className="w-8 h-8 text-[#0099DD]" />;
    }
  };

  const getCategoryImageUrl = (cat: { id: string; slug: string; image_url?: string }) => {
    if (cat.image_url && cat.image_url.trim()) return cat.image_url;
    const firstProd = products.find((p) => p.category_ids?.includes(cat.id) && p.image_url && p.image_url.trim());
    if (firstProd?.image_url) return firstProd.image_url;
    return null;
  };

  const validCategories = categories.filter(c => c.slug !== 'all-products');
  const featuredProducts = products.filter(p => p.is_featured && p.is_active !== false);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] pb-16 md:pb-0 font-cairo">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-8">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-[#0099DD]">الرئيسية</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800">الكتالوجات</span>
        </nav>

        {/* Page Header */}
        <div className="bg-[#0F172A] rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-md flex flex-col md:flex-row items-center justify-between">
          <div className="relative z-10 space-y-2 text-center md:text-right w-full">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <Layers className="w-8 h-8 text-[#0099DD]" />
              <h1 className="text-2xl md:text-3xl font-black">الكتالوجات</h1>
            </div>
            <p className="text-slate-400 text-sm">
              تصفح {validCategories.length} أقسام رئيسية و أكثر من {products.length} منتج متاح
            </p>
          </div>
          <div className="relative z-10 mt-6 md:mt-0">
            <Link href="/" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl font-bold transition text-sm">
              <ArrowRight className="w-4 h-4" />
              العودة للرئيسية
            </Link>
          </div>
          {/* Decorative background circle */}
          <div className="absolute -left-12 -bottom-24 w-64 h-64 bg-[#0099DD]/20 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Featured/Hot Products Strip */}
        {featuredProducts.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-red-500 fill-current" />
              <h2 className="font-extrabold text-slate-900 text-lg">أقوى الخصومات والباندلات</h2>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
              {featuredProducts.map(product => (
                <div key={product.id} className="min-w-[240px] flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:border-[#0099DD]/50 transition group">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white shrink-0">
                    <Image src={product.image_url || '/placeholder.svg'} alt={product.title_ar} fill className="object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-[#0099DD] transition">
                      {product.title_ar}
                    </h3>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">{product.price} <span className="text-[10px] text-slate-500">ج.م</span></span>
                      {product.has_compatibility_matrix ? (
                         <button onClick={() => openCompatibilityModal(product)} className="text-[10px] text-white bg-slate-800 px-2 py-1 rounded font-bold hover:bg-[#0099DD] transition">اختيار</button>
                      ) : (
                         <button onClick={() => addToCart(product)} className="text-[10px] text-white bg-[#0099DD] px-2 py-1 rounded font-bold hover:bg-[#007BB3] transition">شراء</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catalogs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {validCategories.map(cat => {
            const catProducts = products.filter(p => p.category_ids?.includes(cat.id) && p.is_active !== false);
            const prices = catProducts.map(p => p.price).filter(Boolean);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            const maxPrice = prices.length ? Math.max(...prices) : 0;
            
            const catImage = getCategoryImageUrl(cat);

            return (
              <Link href={`/catalogs/${cat.slug}`} key={cat.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-[#0099DD]/50 transition group relative flex flex-col h-full">
                <div className="absolute top-4 left-4 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md">
                  {catProducts.length} منتج
                </div>
                
                <div className="relative w-20 h-20 rounded-full border-2 border-slate-200 overflow-hidden mb-4 group-hover:border-[#0099DD] group-hover:scale-105 transition-all duration-300 bg-slate-50 flex items-center justify-center shrink-0">
                  {catImage ? (
                    <Image
                      src={catImage}
                      alt={cat.name_ar}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    getCategoryIcon(cat.slug)
                  )}
                </div>
                
                <h3 className="text-lg font-black text-slate-900 mb-1 group-hover:text-[#0099DD] transition">
                  {cat.name_ar}
                </h3>
                
                {prices.length > 0 && (
                  <p className="text-xs font-bold text-slate-500 mb-6">
                    الأسعار تبدأ من <span className="text-slate-800">{minPrice} ج.م</span>
                  </p>
                )}
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-[#0099DD] font-bold text-xs">
                  <span>تصفح الكتالوج</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>

      </main>

      {/* Dynamic Footer */}
      <Footer />

      {/* Modals & Navs */}
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
