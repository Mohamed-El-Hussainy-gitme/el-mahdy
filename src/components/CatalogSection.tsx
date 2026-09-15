'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Flame,
  Shield,
  Smartphone,
  BatteryCharging,
  Headphones,
  Watch,
  Car,
  Usb,
  Package,
  LayoutGrid,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';

function CatalogSection() {
  const {
    categories,
    selectedCategorySlug,
    setSelectedCategorySlug,
    setSelectedBrand,
    setSearchQuery,
    products,
    openCompatibilityModal,
    addToCart,
  } = useStore();

  const handleSelectCatalog = (slug: string, brand?: string) => {
    setSelectedCategorySlug(slug);
    if (brand) {
      setSelectedBrand(brand);
    } else {
      setSelectedBrand(null);
    }
    setSearchQuery('');
    const el = document.getElementById('products-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper icons for categories
  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'screen-protectors':
        return <Shield className="w-6 h-6 text-[#0099DD]" />;
      case 'phone-cases':
        return <Smartphone className="w-6 h-6 text-indigo-500" />;
      case 'chargers-adapters':
      case 'charging-cables':
        return <BatteryCharging className="w-6 h-6 text-amber-500" />;
      case 'bluetooth-earbuds':
      case 'speakers':
        return <Headphones className="w-6 h-6 text-emerald-500" />;
      case 'smart-watches':
      case 'watches':
        return <Watch className="w-6 h-6 text-purple-500" />;
      case 'car-accessories':
        return <Car className="w-6 h-6 text-rose-500" />;
      case 'storage-memory':
        return <Usb className="w-6 h-6 text-cyan-500" />;
      default:
        return <Package className="w-6 h-6 text-[#0099DD]" />;
    }
  };

  const getCategoryImageUrl = (cat: { id: string; slug: string; image_url?: string }) => {
    if (cat.image_url && cat.image_url.trim()) return cat.image_url;
    const firstProd = products.find((p) => p.category_ids?.includes(cat.id) && p.image_url && p.image_url.trim());
    if (firstProd?.image_url) return firstProd.image_url;
    return null;
  };

  // Dynamic Showcase Banners based on top categories that have products
  const showcaseBanners = React.useMemo(() => {
    const validCats = categories.filter((c) => c.slug !== 'all-products');
    const sorted = [...validCats].sort((a, b) => {
      const countA = products.filter((p) => p.category_ids?.includes(a.id)).length;
      const countB = products.filter((p) => p.category_ids?.includes(b.id)).length;
      if (countB !== countA) return countB - countA;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const top4 = sorted.slice(0, 4);
    const badges = [
      { text: 'الأكثر طلباً', color: 'bg-[#0099DD]' },
      { text: 'جملة معتمدة', color: 'bg-amber-600' },
      { text: 'تشكيلة مميزة', color: 'bg-indigo-600' },
      { text: 'أحدث الأصناف', color: 'bg-emerald-600' },
    ];

    return top4.map((cat, idx) => {
      const count = products.filter((p) => p.category_ids?.includes(cat.id)).length;
      const img = getCategoryImageUrl(cat);
      return {
        title: cat.name_ar,
        subtitle: `تشكيلة وتوريدات مباشرة لقطاع الجملة (${count} صنف مسجل)`,
        slug: cat.slug,
        image: img || null,
        badge: badges[idx]?.text || 'تشكيلة مميزة',
        badgeColor: badges[idx]?.color || 'bg-[#0099DD]',
        count,
      };
    });
  }, [categories, products]);

  // Hot deals from products
  const hotDeals = products.filter((p) => p.is_featured);

  return (
    <div id="catalog-showcase-section" className="space-y-6 mb-8 scroll-mt-20">
      {/* 1. Circle Catalogs Carousel — Exact Yasbas Style with Real Photos */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-amber-500 rounded-full"></span>
            <h3 className="font-extrabold text-sm md:text-base text-slate-900">
              تسوق حسب الكتالوج
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/catalogs"
              className="text-xs text-amber-600 hover:text-amber-700 font-bold transition flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <span className="text-xs">‹</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar py-2 px-1">
          {/* 1. All Catalogs Circle (Matching Yasbas "كل الكتالوجات / 8+ كتالوج آخر") */}
          <Link
            href="/catalogs"
            className="flex flex-col items-center group shrink-0 transition-transform active:scale-95"
          >
            <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-amber-300 bg-amber-50/70 hover:border-[#0099DD] hover:bg-sky-50 transition shadow-sm flex items-center justify-center">
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow">
                +{categories.filter((c) => c.slug !== 'all-products').length}
              </span>
              <LayoutGrid className="w-8 h-8 text-amber-600 group-hover:text-[#0099DD] transition" />
            </div>
            <span className="text-xs font-black mt-2 text-center text-slate-800 group-hover:text-[#0099DD] transition">
              كل الكتالوجات
            </span>
            <span className="text-[10px] font-bold text-amber-600 -mt-0.5">
              +{categories.filter((c) => c.slug !== 'all-products').length} كتالوج آخر
            </span>
          </Link>

          {/* Dynamic Categories from DB with Real Product Images */}
          {categories
            .filter((c) => c.slug !== 'all-products')
            .map((cat) => {
              const count = products.filter((p) => p.category_ids?.includes(cat.id)).length;
              const isSelected = selectedCategorySlug === cat.slug;
              const catImage = getCategoryImageUrl(cat);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCatalog(cat.slug)}
                  className="flex flex-col items-center group shrink-0 transition-transform active:scale-95"
                >
                  <div
                    className={`relative w-20 h-20 rounded-full border-2 p-0.5 transition shadow-sm overflow-hidden flex items-center justify-center bg-slate-100 ${
                      isSelected
                        ? 'border-[#0099DD] ring-2 ring-[#0099DD]/30 shadow-sky-100'
                        : 'border-slate-200 group-hover:border-[#0099DD]'
                    }`}
                  >
                    {catImage ? (
                      <div className="relative w-full h-full rounded-full overflow-hidden">
                        <Image
                          src={catImage}
                          alt={cat.name_ar}
                          fill
                          className="object-cover group-hover:scale-110 transition duration-300"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-50 flex items-center justify-center">
                        {getCategoryIcon(cat.slug)}
                      </div>
                    )}

                    {count > 0 && (
                      <span className="absolute -bottom-0.5 right-1/2 translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.2 rounded-full shadow-md z-10 border border-white/20">
                        {count}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold mt-2 text-center max-w-[100px] line-clamp-1 ${
                      isSelected ? 'text-[#0099DD] font-black' : 'text-slate-700 group-hover:text-[#0099DD]'
                    }`}
                    title={cat.name_ar}
                  >
                    {cat.name_ar}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* 2. Banner Cards 4-Column Showcase (Dynamic from top categories) */}
      {showcaseBanners.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {showcaseBanners.map((banner, idx) => {
            const isSelected = selectedCategorySlug === banner.slug;

            return (
              <Link
                key={idx}
                href={`/catalogs/${banner.slug}`}
                className={`relative rounded-2xl border overflow-hidden shadow-sm hover:shadow-lg transition group flex flex-col min-h-[200px] ${
                  isSelected ? 'border-[#0099DD] ring-2 ring-[#0099DD]/20' : 'border-slate-200 hover:border-[#0099DD]'
                }`}
              >
                {/* Full-bleed background image or gradient fallback */}
                <div className="absolute inset-0">
                  {banner.image ? (
                    <Image
                      src={banner.image}
                      alt={banner.title}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      {getCategoryIcon(banner.slug)}
                    </div>
                  )}
                  {/* Dark gradient overlay — top-to-bottom for readability */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/70" />
                </div>

                {/* Card content overlay */}
                <div className="relative z-10 flex flex-col justify-between h-full p-4 min-h-[200px]">
                  {/* Top: Badge + Count */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`${banner.badgeColor} text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow`}>
                      {banner.badge}
                    </span>
                    {banner.count > 0 && (
                      <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/30">
                        {banner.count} منتج
                      </span>
                    )}
                  </div>

                  {/* Bottom: Title + subtitle + CTA */}
                  <div>
                    <h4 className="font-extrabold text-white text-sm leading-snug drop-shadow group-hover:text-[#7dd3fc] transition">
                      {banner.title}
                    </h4>
                    <p className="text-[10px] text-white/70 mt-0.5 line-clamp-1">{banner.subtitle}</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-white text-[11px] font-bold group-hover:translate-x-1 transition">
                      تصفح الكتالوج <ArrowLeft className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 3. "عروض اليوم DEAL" Carousel */}
      {hotDeals.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 fill-current" /> DEAL
              </span>
              <h3 className="font-bold text-sm text-slate-800">عروض اليوم والباندلات الأقوى</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">خصومات تجارية مستمرة</span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
            {hotDeals.map((item) => (
              <div
                key={item.id}
                className="w-44 shrink-0 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between hover:border-[#0099DD] hover:bg-white transition shadow-sm group"
              >
                <Link href={`/products/${item.id}`} className="block relative w-full h-24 rounded-lg overflow-hidden bg-white mb-2">
                  <Image
                    src={item.image_url || '/placeholder.svg'}
                    alt={item.title_ar}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-200"
                  />
                </Link>

                <div className="space-y-1">
                  <Link href={`/products/${item.id}`} className="block">
                    <h5 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-[#0099DD] transition">
                      {item.title_ar}
                    </h5>
                  </Link>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-black text-slate-900">
                      {item.price.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">ج.م</span>
                    </span>
                    {item.has_compatibility_matrix ? (
                      <button
                        type="button"
                        onClick={() => openCompatibilityModal(item)}
                        className="text-[10px] text-[#0099DD] font-bold hover:underline"
                      >
                        الموديلات
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="text-[10px] bg-[#0099DD] text-white px-2 py-0.5 rounded font-bold hover:bg-[#007BB3]"
                      >
                        شراء
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(CatalogSection);
