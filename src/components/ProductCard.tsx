'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  Share2,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  Scale,
  Check,
  Plus,
} from 'lucide-react';
import { Product } from '@/types';
import { useStore } from '@/context/StoreContext';

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  const {
    openCompatibilityModal,
    addToCart,
    wishlist,
    toggleWishlist,
    compareList,
    toggleCompare,
  } = useStore();

  const isWishlisted = wishlist.includes(product.id);
  const isCompared = compareList.some((p) => p.id === product.id);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: product.title_ar,
        text: `${product.title_ar} - متجر MH EL MAHDY`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ رابط المنتج إلى الحافظة');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-[#0099DD]/60 transition-all duration-200 flex flex-col justify-between group">
      
      {/* 1. Top Section: Image & Wishlist/Share buttons */}
      <div className="relative p-3">
        {/* Top Badges / Icons */}
        <div className="flex items-center justify-between z-10 relative">
          <button
            onClick={() => toggleWishlist(product.id)}
            className={`p-1.5 rounded-full backdrop-blur-md transition ${
              isWishlisted
                ? 'bg-red-50 text-red-500'
                : 'bg-white/80 text-slate-400 hover:text-red-500 hover:bg-white'
            }`}
            title="إضافة للمفضلة"
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 rounded-full bg-white/80 backdrop-blur-md text-slate-400 hover:text-[#0099DD] hover:bg-white transition"
            title="مشاركة"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Product Image */}
        <Link
          href={`/products/${product.id}`}
          className="relative w-full h-44 my-1 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center block"
        >
          <Image
            src={product.image_url || '/placeholder.svg'}
            alt={product.title_ar}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>

        {/* Product Code (SKU) */}
        <div className="text-[10px] text-slate-400 font-mono text-right mt-1 font-semibold">
          {product.sku}
        </div>

        {/* Title */}
        <Link href={`/products/${product.id}`} className="block">
          <h3 className="font-bold text-xs text-slate-800 line-clamp-2 mt-1 min-h-[32px] group-hover:text-[#0099DD] transition-colors leading-relaxed">
            {product.title_ar}
          </h3>
        </Link>

        {/* Price (Single Price - B2B Model) */}
        <div className="mt-2 flex items-baseline gap-1 text-slate-900">
          <span className="text-base font-black tracking-tight">{product.price.toFixed(2)}</span>
          <span className="text-[11px] font-bold text-slate-500">ج.م</span>
        </div>

        {/* Status Badges (Matching yasbas Image 1 & 2) */}
        <div className="mt-2.5 space-y-1">
          {/* Exchange-only badge */}
          {product.is_exchange_only && (
            <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              <span>قابل للاستبدال فقط</span>
            </div>
          )}

          {/* Compatibility count badge */}
          {product.has_compatibility_matrix && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                <Smartphone className="w-3 h-3" />
                <span>متوفر {product.available_models_count || 12} موديل</span>
              </div>
              {product.limited_models_count && (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{product.limited_models_count} موديل بكمية محدودة</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Bottom Action Buttons (Matching yasbas style) */}
      <div className="p-3 pt-0 border-t border-slate-100 flex items-center gap-2 mt-2">
        {product.has_compatibility_matrix ? (
          <button
            onClick={() => openCompatibilityModal(product)}
            className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>اختيار الموديل</span>
          </button>
        ) : (
          <button
            onClick={() => addToCart(product)}
            className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>شراء</span>
          </button>
        )}

        {/* Compare Button */}
        <button
          onClick={() => toggleCompare(product)}
          className={`p-2 rounded-xl border transition ${
            isCompared
              ? 'bg-sky-50 text-[#0099DD] border-[#0099DD]'
              : 'border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
          title="مقارنة المنتج"
        >
          <Scale className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}

export default React.memo(ProductCard);
