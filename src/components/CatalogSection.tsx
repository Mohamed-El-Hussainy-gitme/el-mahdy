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

  // Curated representative images for categories matching wholesale catalog appearance
  const categoryImageMap: Record<string, string> = {
    'screen-protectors': 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&auto=format&fit=crop&q=80',
    'phone-cases': 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=300&auto=format&fit=crop&q=80',
    'chargers-adapters': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=80',
    'charging-cables': 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=300&auto=format&fit=crop&q=80',
    'bluetooth-earbuds': 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&auto=format&fit=crop&q=80',
    'speakers': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=300&auto=format&fit=crop&q=80',
    'smart-watches': 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=300&auto=format&fit=crop&q=80',
    'watches': 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=300&auto=format&fit=crop&q=80',
    'car-accessories': 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=300&auto=format&fit=crop&q=80',
    'power-banks': 'https://images.unsplash.com/photo-1609592426867-0c7f1a3068f6?w=300&auto=format&fit=crop&q=80',
    'storage-memory': 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?w=300&auto=format&fit=crop&q=80',
    'phone-batteries': 'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?w=300&auto=format&fit=crop&q=80',
    'mobile-phones': 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?w=300&auto=format&fit=crop&q=80',
    'originals': 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=300&auto=format&fit=crop&q=80',
    'computer-accessories': 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&auto=format&fit=crop&q=80',
    'lighting-tripods': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&auto=format&fit=crop&q=80',
    'general-accessories': 'https://images.unsplash.com/photo-1572721546713-ff00e57588e7?w=300&auto=format&fit=crop&q=80',
  };

  const getCategoryImageUrl = (cat: { id: string; slug: string; image_url?: string }) => {
    if (cat.image_url) return cat.image_url;
    const firstProd = products.find((p) => p.category_ids?.includes(cat.id) && p.image_url);
    if (firstProd?.image_url) return firstProd.image_url;
    if (categoryImageMap[cat.slug]) return categoryImageMap[cat.slug];
    return null;
  };

  // Curated showcase banners with DISTINCT slugs and descriptions
  const showcaseBanners = [
    {
      title: 'حماية الشاشات والزجاج المقوى',
      subtitle: 'حماية شاملة ضد الصدمات لجميع الموديلات',
      slug: 'screen-protectors',
      image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80',
      badge: 'الأكثر طلباً',
      badgeColor: 'bg-[#0099DD]',
    },
    {
      title: 'الشواحن الأصلية والكابلات السريعة',
      subtitle: 'محولات PD وكابلات معتمدة للشحن فائق السرعة',
      slug: 'chargers-adapters',
      image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
      badge: 'جملة معتمدة',
      badgeColor: 'bg-amber-600',
    },
    {
      title: 'جرابات وكفرات الحماية الفاخرة',
      subtitle: 'خامات مقاومة للصدمات بحواف مرتفعة وحماية للكاميرا',
      slug: 'phone-cases',
      image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=80',
      badge: 'تشكيلة متنوعة',
      badgeColor: 'bg-indigo-600',
    },
    {
      title: 'سماعات البلوتوث والإيربودز',
      subtitle: 'صوت محيطي نقي وعزل ضوضاء بجودة استيراد أصلية',
      slug: 'bluetooth-earbuds',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
      badge: 'أحدث الموديلات',
      badgeColor: 'bg-emerald-600',
    },
  ];

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

      {/* 2. Banner Cards 4-Column Showcase (Each with distinct category slug) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {showcaseBanners.map((banner, idx) => {
          const cat = categories.find((c) => c.slug === banner.slug);
          const count = cat ? products.filter((p) => p.category_ids?.includes(cat.id)).length : 0;
          const isSelected = selectedCategorySlug === banner.slug;

          return (
            <div
              key={idx}
              onClick={() => handleSelectCatalog(banner.slug)}
              className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between ${
                isSelected ? 'border-[#0099DD] ring-2 ring-[#0099DD]/20' : 'border-slate-200 hover:border-[#0099DD]'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`${banner.badgeColor} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm`}>
                    {banner.badge}
                  </span>
                  {count > 0 && (
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {count} منتج متاح
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-[#0099DD] transition">
                  {banner.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{banner.subtitle}</p>
              </div>

              <div className="relative h-28 w-full bg-slate-50 overflow-hidden border-t border-slate-100">
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-2.5">
                  <span className="text-white text-[11px] font-bold flex items-center gap-1 group-hover:translate-x-1 transition">
                    تصفح الكتالوج <ArrowLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
