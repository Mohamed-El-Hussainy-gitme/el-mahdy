'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  Share2,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  Scale,
  Minus,
  Plus,
  ShoppingCart,
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
    currentUser,
    openAccountModalWithTab,
  } = useStore();

  const isWishlisted = wishlist.includes(product.id);
  const isCompared = compareList.some((p) => p.id === product.id);

  // ── Quantity stepper for simple (non-matrix) products ───────────────────────
  const [qty, setQty] = useState(1);
  const changeQty = (delta: number) => setQty((prev) => Math.max(1, prev + delta));

  // ── Approval-aware check ────────────────────────────────────────────────────
  // isApproved = true for approved customers OR if no approval system is applied yet
  const isApproved =
    !currentUser ||
    (currentUser as any).approval_status === 'approved' ||
    (currentUser as any).approval_status === undefined ||
    (currentUser as any).approval_status === null;

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

  // ── What happens when the user clicks "buy" / "select model" ────────────────
  const handleBuyClick = () => {
    if (!currentUser) {
      // Not logged in → open register modal
      openAccountModalWithTab('register');
      return;
    }
    if (!isApproved) {
      // Logged in but pending approval → do nothing (UI shows "قيد المراجعة")
      return;
    }
    if (product.has_compatibility_matrix) {
      openCompatibilityModal(product);
    } else {
      addToCart(product, undefined, qty);
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

        {/* Price — hidden from non-approved users */}
        {isApproved && currentUser ? (
          <div className="mt-2 flex items-baseline gap-1 text-slate-900">
            <span className="text-base font-black tracking-tight">{product.price.toFixed(2)}</span>
            <span className="text-[11px] font-bold text-slate-500">ج.م</span>
          </div>
        ) : currentUser && !isApproved ? (
          // Logged in but pending
          <div className="mt-2 text-[11px] text-amber-600 font-bold bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">
            قيد المراجعة الإدارية
          </div>
        ) : (
          // Not logged in
          <button
            onClick={() => openAccountModalWithTab('register')}
            className="mt-2 text-[11px] text-[#0099DD] font-bold hover:underline"
          >
            سجّل لعرض السعر
          </button>
        )}

        {/* Status Badges */}
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

      {/* 2. Bottom Action Buttons */}
      <div className="p-3 pt-0 border-t border-slate-100 mt-2">
        {/* Quantity stepper — only for simple (non-matrix) products for approved users */}
        {!product.has_compatibility_matrix && currentUser && isApproved && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => changeQty(-1)}
              disabled={qty <= 1}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 transition"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center font-extrabold text-sm text-slate-800 tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => changeQty(1)}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Main action button */}
          {product.has_compatibility_matrix ? (
            /* Matrix product */
            currentUser && isApproved ? (
              <button
                onClick={handleBuyClick}
                className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>اختيار الموديل</span>
              </button>
            ) : currentUser && !isApproved ? (
              <div className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed">
                <span>قيد المراجعة</span>
              </div>
            ) : (
              <button
                onClick={handleBuyClick}
                className="flex-1 bg-slate-800 hover:bg-[#0099DD] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>سجّل للطلب</span>
              </button>
            )
          ) : (
            /* Simple product */
            currentUser && isApproved ? (
              <button
                onClick={handleBuyClick}
                className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>إضافة للسلة</span>
              </button>
            ) : currentUser && !isApproved ? (
              <div className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed">
                <span>قيد المراجعة</span>
              </div>
            ) : (
              <button
                onClick={handleBuyClick}
                className="flex-1 bg-slate-800 hover:bg-[#0099DD] text-white py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>سجّل للطلب</span>
              </button>
            )
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

    </div>
  );
}

export default React.memo(ProductCard);
