'use client';

import React from 'react';
import { Home, Grid, Heart, ShoppingCart, User } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function MobileBottomNav() {
  const {
    selectedCategorySlug,
    setSelectedCategorySlug,
    setSelectedBrand,
    setSearchQuery,
    cartItemsCount,
    setIsCartOpen,
    setIsAccountModalOpen,
    currentUser,
    wishlist,
    setIsWishlistOpen,
  } = useStore();

  const handleHomeClick = () => {
    setSelectedCategorySlug('all-products');
    setSelectedBrand(null);
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCatalogsClick = () => {
    const el = document.getElementById('catalog-showcase-section') || document.getElementById('products-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label="شريط التنقل السفلي للهاتف"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center text-center">
        {/* 1. الرئيسية */}
        <button
          type="button"
          onClick={handleHomeClick}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            selectedCategorySlug === 'all-products'
              ? 'text-[#0099DD] font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Home className="w-5 h-5 transition-transform active:scale-90" />
            {selectedCategorySlug === 'all-products' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#0099DD] rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">الرئيسية</span>
        </button>

        {/* 2. الأقسام والكتالوج */}
        <button
          type="button"
          onClick={handleCatalogsClick}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            selectedCategorySlug !== 'all-products'
              ? 'text-[#0099DD] font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Grid className="w-5 h-5 transition-transform active:scale-90" />
            {selectedCategorySlug !== 'all-products' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#0099DD] rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">الأقسام</span>
        </button>

        {/* 3. قائمة المفضلة */}
        <button
          type="button"
          onClick={() => setIsWishlistOpen(true)}
          className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-rose-500 transition-all relative"
        >
          <div className="relative">
            <Heart className="w-5 h-5 transition-transform active:scale-90 text-rose-500" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {wishlist.length > 99 ? '99+' : wishlist.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">مفضلتي</span>
        </button>

        {/* 4. سلة المشتريات */}
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-[#0099DD] transition-all relative"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 transition-transform active:scale-90" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#0099DD] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-semibold">السلة</span>
        </button>

        {/* 5. الحساب والطلبات */}
        <button
          type="button"
          onClick={() => setIsAccountModalOpen(true)}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            currentUser ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <User className="w-5 h-5 transition-transform active:scale-90" />
            {currentUser && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-white rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight line-clamp-1 max-w-[50px]">
            {currentUser ? 'حسابي' : 'دخول'}
          </span>
        </button>
      </div>
    </nav>
  );
}
