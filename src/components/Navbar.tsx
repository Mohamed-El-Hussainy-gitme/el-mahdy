'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  ShoppingCart,
  MapPin,
  MoreVertical,
  SlidersHorizontal,
  ArrowUpDown,
  ShieldCheck,
  User,
  LayoutDashboard,
  Tag,
  PhoneCall,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function Navbar() {
  const {
    categories,
    selectedCategorySlug,
    setSelectedCategorySlug,
    selectedBrand,
    setSelectedBrand,
    searchQuery,
    setSearchQuery,
    cartItemsCount,
    cartTotal,
    setIsCartOpen,
    setIsAccountModalOpen,
    setIsShortageModalOpen,
    currentUser,
    staffSession,
    onlyFeatured,
    setOnlyFeatured,
    wishlist,
    setIsWishlistOpen,
    storeSettings,
  } = useStore();

  const [isCatalogDropdownOpen, setIsCatalogDropdownOpen] = useState(false);
  const [isShippingInfoOpen, setIsShippingInfoOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── Sales Rep / Store WhatsApp Badge Logic ──────────────────────────────────
  // Only show "مندوبك: X" if there is an actual logged-in customer with a real assigned rep.
  // For guests or customers without an assigned rep yet, show the store's general WhatsApp.
  const hasAssignedRep = isMounted && !!currentUser && !!currentUser.assigned_sales_rep_id;

  const repFirstName = hasAssignedRep
    ? (currentUser!.assigned_sales_rep_name || '').split(' ')[0] || 'مندوبك'
    : null;

  const repWhatsappUrl = hasAssignedRep
    ? `https://wa.me/${(currentUser!.assigned_sales_rep_phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        'السلام عليكم، أتواصل معك بصفتك مندوبي المعتمد في متجر MH EL MAHDY.'
      )}`
    : `https://wa.me/${(storeSettings.whatsapp_number || '201012345678').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        storeSettings.whatsapp_message || 'السلام عليكم، أرغب في الاستفسار عن طلب توريد بالجملة من متجر MH EL MAHDY'
      )}`;


  const router = useRouter();
  const pathname = usePathname();

  const topCategories = React.useMemo(() => {
    return categories
      .filter((c) => c.slug !== 'all-products' && c.is_active !== false)
      .slice(0, 8);
  }, [categories]);

  const handleCategoryNav = (slug: string) => {
    setSelectedCategorySlug(slug);
    setSelectedBrand(null);
    if (pathname === '/') {
      const el = document.getElementById('products-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(`/catalogs/${slug}`);
    }
  };

  const handleHomeNav = () => {
    setSelectedCategorySlug('all-products');
    setSelectedBrand(null);
    setSearchQuery('');
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathname !== '/') {
      router.push(`/?search=${encodeURIComponent(searchQuery)}`);
    } else {
      const el = document.getElementById('products-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="w-full sticky top-0 z-40 shadow-sm bg-white">
      {/* 1. Dark Top Bar (Matching yasbas style) */}
      <div className="bg-[#0F172A] text-slate-100 px-4 py-2 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Right: Logo & Quick links */}
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-0.5">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/20 shadow-sm bg-[#0099DD]">
                <Image
                  src="/logo.png"
                  alt="MH EL MAHDY Logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm font-black tracking-wide text-white uppercase">MH EL MAHDY</span>
                <span className="text-[9px] text-[#38bdf8] font-semibold -mt-1">منظومة التوزيع المعتمدة</span>
              </div>
            </Link>

            {/* Sales Rep / Store WhatsApp Pill Badge */}
            <a
              href={repWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-[#25D366] text-white px-3 py-1 rounded-full text-xs font-bold transition shadow-sm shrink-0 group active:scale-95"
              title={hasAssignedRep ? `محادثة واتساب مع مندوبك: ${currentUser?.assigned_sales_rep_name}` : 'تواصل معنا على واتساب'}
            >
              {hasAssignedRep ? (
                <>
                  <span className="text-slate-300 text-[11px] font-medium">مندوبك:</span>
                  <span className="text-white text-[11px] font-extrabold">{repFirstName}</span>
                </>
              ) : (
                <span className="text-white text-[11px] font-bold">تواصل معنا</span>
              )}
              <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition">
                <MessageCircle className="w-3 h-3 fill-current text-white" />
              </span>
            </a>

            {/* Horizontal Categories Scroll */}
            <nav className="hidden lg:flex items-center gap-3 text-slate-300 whitespace-nowrap text-xs">
              <button
                type="button"
                onClick={handleHomeNav}
                className={`hover:text-white transition-colors duration-150 ${
                  pathname === '/' && selectedCategorySlug === 'all-products'
                    ? 'text-[#38bdf8] font-black border-b border-[#38bdf8] pb-0.5'
                    : ''
                }`}
              >
                الرئيسية
              </button>
              <Link
                href="/catalogs"
                className="text-[#38bdf8] hover:text-white font-bold transition flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 hover:border-[#0099DD]"
              >
                <span>الكتالوجات</span>
              </Link>
              {topCategories.map((cat) => {
                const isActive = pathname === '/' && selectedCategorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryNav(cat.slug)}
                    className={`hover:text-white transition-colors duration-150 ${
                      isActive ? 'text-[#38bdf8] font-bold border-b border-[#38bdf8] pb-0.5' : ''
                    }`}
                  >
                    {cat.name_ar}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Left: Actions (User, Cart, Location, Admin link) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Location & Shipping Info Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShippingInfoOpen(!isShippingInfoOpen)}
                className="hidden sm:flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-800"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0099DD]" />
                <span>التوصيل إلى مصر</span>
              </button>

              {isShippingInfoOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white text-slate-800 rounded-2xl shadow-2xl p-4 border border-slate-200 z-50 animate-in fade-in duration-150 text-right">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                    <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#0099DD]" />
                      <span>الشحن والتسليم B2B</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsShippingInfoOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <ul className="text-[11px] space-y-2 text-slate-600 leading-relaxed">
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-black">✓</span>
                      <span>{storeSettings.delivery_promise_1 || 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.'}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-black">✓</span>
                      <span>{storeSettings.delivery_promise_2 || 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.'}</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-black">✓</span>
                      <span>{storeSettings.delivery_promise_3 || 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.'}</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>

            {/* Shortage request button */}
            <button
              onClick={() => setIsShortageModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[#38bdf8] border border-slate-700 text-xs font-medium transition"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>تسجيل نواقص</span>
            </button>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition relative"
              title="قائمة مفضلاتي"
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span className="hidden sm:inline">مفضلتي</span>
              {isMounted && wishlist.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-3 py-1.5 rounded-lg font-bold shadow transition relative"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs">السلة</span>
              {cartItemsCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartItemsCount}
                </span>
              )}
            </button>

            {/* User Account / 3-dots Menu */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition relative"
              title="حسابي والخيارات"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Search Bar & Catalogs (Matching yasbas style) */}
      <div className="bg-white border-b border-slate-200 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search container */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full max-w-4xl mx-auto flex items-center border-2 border-slate-200 hover:border-[#0099DD] focus-within:border-[#0099DD] rounded-full overflow-hidden transition-all shadow-sm bg-white"
          >
            {/* Search Button on the left side (RTL) */}
            <button
              type="submit"
              aria-label="بحث"
              className="bg-[#0099DD] hover:bg-[#007BB3] text-white px-5 py-2.5 flex items-center justify-center transition"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في متجر المهدي (موديل، اسم المنتج، كود المنتج...)"
              className="w-full px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
            />

            {/* Category Dropdown on the right side */}
            <div className="relative border-r border-slate-200">
              <button
                type="button"
                onClick={() => setIsCatalogDropdownOpen(!isCatalogDropdownOpen)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-[#0099DD] flex items-center gap-2 whitespace-nowrap bg-slate-50 h-full"
              >
                <span>
                  {selectedCategorySlug === 'all-products'
                    ? 'كل الكتالوجات'
                    : categories.find((c) => c.slug === selectedCategorySlug)?.name_ar || 'كل الكتالوجات'}
                </span>
                <span className="text-slate-400">▾</span>
              </button>

              {isCatalogDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto py-2">
                  <Link
                    href="/catalogs"
                    onClick={() => setIsCatalogDropdownOpen(false)}
                    className="w-full text-right px-4 py-2.5 text-xs bg-sky-50 hover:bg-sky-100 text-[#0099DD] font-black flex items-center justify-between border-b border-sky-100 transition"
                  >
                    <span>تصفح صفحة كل الكتالوجات</span>
                    <span className="text-xs">‹</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategorySlug('all-products');
                      setIsCatalogDropdownOpen(false);
                    }}
                    className="w-full text-right px-4 py-2 text-xs hover:bg-sky-50 hover:text-[#0099DD] font-semibold flex items-center justify-between"
                  >
                    <span>كل المنتجات (الرئيسية)</span>
                  </button>
                  <hr className="my-1 border-slate-100" />
                  {categories
                    .filter((c) => c.slug !== 'all-products')
                    .map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategorySlug(cat.slug);
                          setIsCatalogDropdownOpen(false);
                        }}
                        className={`w-full text-right px-4 py-2 text-xs hover:bg-sky-50 hover:text-[#0099DD] flex items-center justify-between transition ${
                          selectedCategorySlug === cat.slug ? 'text-[#0099DD] font-bold bg-sky-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{cat.name_ar}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </form>

        </div>
      </div>

      {/* 3. Sub-Navigation / Breadcrumb Bar (Matching yasbas style) */}
      <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Breadcrumbs on Right */}
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-[#0099DD] font-semibold text-slate-700">
              الرئيسية
            </Link>
            <span className="text-slate-400">‹</span>
            <span className="text-[#0099DD] font-bold">
              {selectedCategorySlug === 'all-products'
                ? 'كل المنتجات'
                : categories.find((c) => c.slug === selectedCategorySlug)?.name_ar || 'المنتجات'}
            </span>
          </div>

          {/* Quick Filters on Left */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyFeatured(!onlyFeatured)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                onlyFeatured
                  ? 'bg-[#0099DD] text-white border-[#0099DD] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#0099DD]'
              }`}
            >
              <span>المنتجات المميزة فقط</span>
              <Tag className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
