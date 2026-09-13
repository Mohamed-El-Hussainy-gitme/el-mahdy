'use client';

import React from 'react';
import { SlidersHorizontal, RotateCcw, Truck, Percent, Check } from 'lucide-react';
import { useStore } from '@/context/StoreContext';

export default function SidebarFilters() {
  const {
    products,
    categories,
    selectedCategorySlug,
    setSelectedCategorySlug,
    selectedBrand,
    setSelectedBrand,
    priceRange,
    setPriceRange,
    onlyDiscounts,
    setOnlyDiscounts,
    onlyFreeShipping,
    setOnlyFreeShipping,
    clearFilters,
  } = useStore();

  const categoryCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    categories.forEach((cat) => {
      if (cat.slug === 'all-products') {
        map[cat.id] = products.length;
      } else {
        map[cat.id] = products.filter((p) => p.category_ids?.includes(cat.id)).length;
      }
    });
    return map;
  }, [categories, products]);

  const brands = [
    'IPHONE',
    'SAMSUNG',
    'XIAOMI',
    'OPPO',
    'REALME',
    'INFINIX',
    'HUAWEI',
    'HONOR',
    'VIVO',
  ];

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-5">
      {/* 1. Categories Filter (الأقسام) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-2 h-4 bg-[#0099DD] rounded-full"></div>
          <h3 className="font-bold text-sm text-slate-900">الأقسام</h3>
        </div>

        <div className="mt-3 space-y-1 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategorySlug(cat.slug)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-right ${
                selectedCategorySlug === cat.slug
                  ? 'bg-sky-50 text-[#0099DD] font-bold border border-sky-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${selectedCategorySlug === cat.slug ? 'bg-[#0099DD]' : 'bg-slate-300'}`}></span>
                <span className="truncate">{cat.name_ar}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {categoryCounts[cat.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Price Range (السعر) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">السعر</h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            من {priceRange[0]} إلى {priceRange[1]} ج.م
          </span>
        </div>

        {/* Dual Input Boxes */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="number"
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 0])}
              className="w-full px-2.5 py-1.5 text-xs text-center border border-slate-300 rounded-lg focus:outline-none focus:border-[#0099DD] font-bold"
              placeholder="الحد الأقصى"
            />
          </div>
          <span className="text-slate-400 font-bold">-</span>
          <div className="flex-1">
            <input
              type="number"
              value={priceRange[0]}
              onChange={(e) => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
              className="w-full px-2.5 py-1.5 text-xs text-center border border-slate-300 rounded-lg focus:outline-none focus:border-[#0099DD] font-bold"
              placeholder="الحد الأدنى"
            />
          </div>
        </div>

        {/* Range Slider */}
        <div className="pt-2">
          <input
            type="range"
            min="0"
            max="7500"
            step="10"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full accent-[#0099DD] cursor-pointer"
          />
        </div>

        {/* Checkboxes matching Image 1 & 2 */}
        <div className="pt-2 space-y-2 text-xs border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={onlyDiscounts}
              onChange={(e) => setOnlyDiscounts(e.target.checked)}
              className="w-4 h-4 rounded text-[#0099DD] focus:ring-[#0099DD] border-slate-300"
            />
            <span>عرض المخفضات فقط</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={onlyFreeShipping}
              onChange={(e) => setOnlyFreeShipping(e.target.checked)}
              className="w-4 h-4 rounded text-[#0099DD] focus:ring-[#0099DD] border-slate-300"
            />
            <span className="flex items-center gap-1">
              شحن مجاني فقط <Truck className="w-3.5 h-3.5 text-[#0099DD]" />
            </span>
          </label>
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={clearFilters}
          className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>مسح جميع الفلاتر</span>
        </button>
      </div>

      {/* 3. Brands (البراند) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">البراند</h3>
          {selectedBrand && (
            <button
              onClick={() => setSelectedBrand(null)}
              className="text-[10px] text-red-500 hover:underline font-semibold"
            >
              إلغاء التحديد
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {brands.map((brand) => {
            const isSelected = selectedBrand === brand;
            return (
              <button
                key={brand}
                onClick={() => setSelectedBrand(isSelected ? null : brand)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  isSelected
                    ? 'bg-[#0099DD] text-white border-[#0099DD] shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#0099DD] hover:text-[#0099DD]'
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
