'use client';

import React, { use, useState, useMemo } from 'react';
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
import { ChevronRight, ArrowRight, ShieldCheck, Truck, Phone, ArrowUpDown, PackageSearch, Filter } from 'lucide-react';

export default function CatalogSinglePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { categories, products } = useStore();
  const [activeBrand, setActiveBrand] = useState<string>('all');

  const category = categories.find(c => c.slug === slug);
  
  const categoryProducts = useMemo(() => {
    return products.filter(p => p.category_ids?.includes(category?.id ?? '') && p.is_active !== false);
  }, [products, category]);

  // Extract unique brands from all matrix items of products in this category
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    categoryProducts.forEach(product => {
      if (product.matrix_items) {
        product.matrix_items.forEach(item => {
          if (item.model?.brand) {
            brands.add(item.model.brand.toUpperCase());
          }
        });
      }
    });
    return Array.from(brands).sort();
  }, [categoryProducts]);

  const filteredProducts = useMemo(() => {
    if (activeBrand === 'all') return categoryProducts;
    return categoryProducts.filter(p => {
      // Filter if product's matrix has the brand or its title contains it
      const hasInMatrix = p.matrix_items?.some(m => m.model?.brand.toUpperCase() === activeBrand);
      const hasInTitle = p.title_ar.toUpperCase().includes(activeBrand);
      return hasInMatrix || hasInTitle;
    });
  }, [categoryProducts, activeBrand]);

  if (!category) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] font-cairo items-center justify-center space-y-4">
        <PackageSearch className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">الكتالوج غير موجود</h2>
        <Link href="/catalogs" className="bg-[#0099DD] text-white px-6 py-2 rounded-xl font-bold">
          العودة للكتالوجات
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] pb-16 md:pb-0 font-cairo">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-[#0099DD]">الرئيسية</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/catalogs" className="hover:text-[#0099DD]">الكتالوجات</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800">{category.name_ar}</span>
        </nav>

        {/* Category Header */}
        <div className="bg-[#0F172A] rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between shadow-md">
          <div className="space-y-1 text-center md:text-right w-full">
            <h1 className="text-2xl font-black">{category.name_ar}</h1>
            <p className="text-slate-400 text-sm">{categoryProducts.length} منتج متاح</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link href="/catalogs" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition text-sm">
              <ArrowRight className="w-4 h-4" />
              تصفح كتالوج آخر
            </Link>
          </div>
        </div>

        {/* Brand Filter Chips & Controls */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 mx-1" />
            <button
              onClick={() => setActiveBrand('all')}
              className={`shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold transition ${activeBrand === 'all' ? 'bg-[#0099DD] text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              الكل
            </button>
            {availableBrands.map(brand => (
              <button
                key={brand}
                onClick={() => setActiveBrand(brand)}
                className={`shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold transition ${activeBrand === brand ? 'bg-[#0099DD] text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                {brand}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs shrink-0 w-full sm:w-auto justify-between sm:justify-start border-t sm:border-0 pt-3 sm:pt-0 border-slate-100">
            <span className="text-slate-500 font-semibold">الترتيب:</span>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
              <span>الأحدث والمميز</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3">
            <PackageSearch className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm">لا توجد منتجات مطابقة</h3>
            <p className="text-xs text-slate-400">حاول اختيار علامة تجارية مختلفة أو تصفح كتالوج آخر.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

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
