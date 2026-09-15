'use client';

import React, { useMemo } from 'react';
import Navbar from '@/components/Navbar';
import CatalogSection from '@/components/CatalogSection';
import SidebarFilters from '@/components/SidebarFilters';
import ProductCard from '@/components/ProductCard';
import CompatibilityModal from '@/components/CompatibilityModal';
import CartDrawer from '@/components/CartDrawer';
import WishlistDrawer from '@/components/WishlistDrawer';
import UserAccountModal from '@/components/UserAccountModal';
import ShortageModal from '@/components/ShortageModal';
import FloatingWidgets from '@/components/FloatingWidgets';
import MobileBottomNav from '@/components/MobileBottomNav';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import Footer from '@/components/Footer';
import { useStore } from '@/context/StoreContext';
import { Sparkles, ArrowUpDown, PackageSearch, ShieldCheck, Truck, Phone } from 'lucide-react';

export default function StorefrontPage() {
  const {
    products,
    selectedCategorySlug,
    categories,
    searchQuery,
    selectedBrand,
    priceRange,
    onlyFeatured,
  } = useStore();

  const [sortBy, setSortBy] = React.useState<'featured' | 'price-asc' | 'price-desc' | 'newest'>('featured');

  // Active Category Object
  const currentCategory = useMemo(() => {
    return categories.find((c) => c.slug === selectedCategorySlug);
  }, [categories, selectedCategorySlug]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      // 1. Category filter
      if (selectedCategorySlug !== 'all-products') {
        const cat = categories.find((c) => c.slug === selectedCategorySlug);
        if (cat && !p.category_ids?.includes(cat.id)) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title_ar.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchMatrix = p.matrix_items?.some((m) =>
          m.model?.model_name.toLowerCase().includes(q) ||
          m.model?.brand.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchSku && !matchMatrix) return false;
      }

      // 3. Brand filter
      if (selectedBrand) {
        const hasBrandInMatrix = p.matrix_items?.some(
          (m) => m.model?.brand.toUpperCase() === selectedBrand.toUpperCase()
        );
        const hasBrandInTitle = p.title_ar.toUpperCase().includes(selectedBrand.toUpperCase());
        if (!hasBrandInMatrix && !hasBrandInTitle) return false;
      }

      // 4. Price filter
      if (p.price < priceRange[0] || p.price > priceRange[1]) {
        return false;
      }

      // 5. Only featured filter
      if (onlyFeatured && !p.is_featured) {
        return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'featured') {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
      }
      return 0;
    });
  }, [
    products,
    selectedCategorySlug,
    categories,
    searchQuery,
    selectedBrand,
    priceRange,
    onlyFeatured,
    sortBy,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] pb-16 md:pb-0">
      {/* 1. Navbar */}
      <Navbar />

      {/* PWA Install Banner (Mobile Only) */}
      <PwaInstallPrompt />

      {/* 2. Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        
        {/* Catalog Showcases (Matching yasbas carousel and tiles) */}
        <CatalogSection />

        {/* 3. Products Area Header */}
        <div id="products-section" className="flex items-center justify-between mb-5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm scroll-mt-24">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900">
              النتائج ({filteredProducts.length})
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              | {selectedCategorySlug === 'all-products' ? 'كافة الكتالوجات المتاحة' : currentCategory?.name_ar}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold hidden sm:inline">الترتيب حسب:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 pl-8 pr-3 py-1.5 rounded-xl font-bold text-slate-700 text-xs focus:outline-none focus:border-[#0099DD] cursor-pointer"
              >
                <option value="featured">الأحدث والمميز</option>
                <option value="price-asc">السعر: من الأقل للأعلى</option>
                <option value="price-desc">السعر: من الأعلى للأقل</option>
                <option value="newest">كافة المنتجات</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 4. Two-Column Layout (Filters on Right, Products on Left in RTL) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Right Column: Sidebar Filters */}
          <SidebarFilters />

          {/* Left Column: Product Grid */}
          <div className="flex-1 w-full">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <PackageSearch className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-700 text-sm">لم يتم العثور على منتجات مطابقة</h3>
                <p className="text-xs text-slate-400">
                  جرّب تغيير خيارات البحث أو تصفية الأسعار والماركات
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* 5. Dynamic Footer (Connected to live StoreSettings) */}
      <Footer />

      {/* 6. Modals, Drawers & Mobile Nav */}
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
