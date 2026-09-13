'use client';

import React, { use, useState, useMemo } from 'react';
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
import { ChevronRight, ShieldCheck, Truck, Phone, PackageSearch, Heart, Share2, Plus, Minus, Search, AlertTriangle } from 'lucide-react';
import { ProductModelMatrixItem } from '@/types';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { products, categories, addToCart, wishlist, toggleWishlist, isLoading } = useStore();
  
  const product = products.find(p => p.id === id);
  const isWishlisted = product ? wishlist.includes(product.id) : false;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const mainImage = selectedImage || product?.image_url || '/placeholder.svg';
  const [activeBrandTab, setActiveBrandTab] = useState<string>('all');
  const [modelSearch, setModelSearch] = useState<string>('');
  
  // State for matrix quantities: Record<matrixItemId, quantity>
  const [matrixSelections, setMatrixSelections] = useState<Record<string, number>>({});
  
  // State for single product quantity
  const [singleQty, setSingleQty] = useState<number>(1); // Single MOQ not strongly typed on product, defaulting to 1

  const category = useMemo(() => {
    if (!product || !product.category_ids?.length) return null;
    return categories.find(c => c.id === product.category_ids[0]);
  }, [product, categories]);

  const alternativeProducts = useMemo(() => {
    if (!product || !product.category_ids?.length) return [];
    return products
      .filter(p => p.id !== product.id && p.category_ids?.includes(product.category_ids[0]) && p.is_active !== false)
      .slice(0, 8);
  }, [product, products]);

  const uniqueMatrixBrands = useMemo(() => {
    if (!product?.matrix_items) return [];
    const brands = new Set<string>();
    product.matrix_items.forEach(item => {
      if (item.model?.brand) brands.add(item.model.brand.toUpperCase());
    });
    return Array.from(brands).sort();
  }, [product]);

  const filteredMatrixItems = useMemo(() => {
    if (!product?.matrix_items) return [];
    return product.matrix_items.filter(item => {
      const matchBrand = activeBrandTab === 'all' || item.model?.brand.toUpperCase() === activeBrandTab;
      const matchSearch = item.model?.model_name.toLowerCase().includes(modelSearch.toLowerCase());
      return matchBrand && matchSearch;
    });
  }, [product, activeBrandTab, modelSearch]);

  const totalSelectedMatrixCount = Object.keys(matrixSelections).length;
  const totalSelectedMatrixQty = Object.values(matrixSelections).reduce((a, b) => a + b, 0);
  const totalSelectedMatrixPrice = totalSelectedMatrixQty * (product?.price ?? 0);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.title_ar,
        text: `شاهد ${product?.title_ar} على MH EL MAHDY`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ الرابط');
    }
  };

  const updateMatrixQty = (item: ProductModelMatrixItem, change: number) => {
    setMatrixSelections(prev => {
      const current = prev[item.id] || 0;
      let next = current + change;
      
      if (next < 0) next = 0;
      if (next > 0 && next < item.moq) {
        // If they click + from 0, snap to MOQ
        // If they click - from MOQ, snap to 0
        if (change > 0) next = item.moq;
        else next = 0;
      }
      
      if (next > item.stock_quantity && item.stock_status !== 'in_stock') {
        next = item.stock_quantity;
      }

      const updated = { ...prev };
      if (next === 0) {
        delete updated[item.id];
      } else {
        updated[item.id] = next;
      }
      return updated;
    });
  };

  const handleAddMatrixToCart = () => {
    if (!product) return;
    Object.entries(matrixSelections).forEach(([itemId, qty]) => {
      const matrixItem = product.matrix_items?.find(m => m.id === itemId);
      if (matrixItem && matrixItem.model) {
        addToCart(product, matrixItem.model, qty);
      }
    });
    setMatrixSelections({});
  };

  if (isLoading && !product) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] font-cairo items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#0099DD] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500">جاري تحميل بيانات المنتج...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] font-cairo items-center justify-center space-y-4">
        <PackageSearch className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">المنتج غير موجود</h2>
        <Link href="/" className="bg-[#0099DD] text-white px-6 py-2 rounded-xl font-bold">العودة للرئيسية</Link>
      </div>
    );
  }

  const allImages = [product.image_url, ...(product.gallery_urls || [])].filter(
    (img): img is string => typeof img === 'string' && img.trim().length > 0
  );

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] pb-24 md:pb-0 font-cairo relative">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-8">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-[#0099DD]">الرئيسية</Link>
          <ChevronRight className="w-3 h-3" />
          {category && (
            <>
              <Link href={`/catalogs/${category.slug}`} className="hover:text-[#0099DD]">{category.name_ar}</Link>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-slate-800 line-clamp-1">{product.title_ar}</span>
        </nav>

        {/* Top Product Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm flex flex-col md:flex-row gap-8">
          
          {/* Image Gallery */}
          <div className="w-full md:w-5/12 space-y-3">
            <div className="relative w-full aspect-square bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden flex items-center justify-center">
              <Image src={mainImage} alt={product.title_ar} fill priority className="object-contain p-4" sizes="(max-width: 768px) 100vw, 40vw" />
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <button onClick={() => toggleWishlist(product.id)} className={`p-2 rounded-full backdrop-blur-md shadow-sm ${isWishlisted ? 'bg-red-50 text-red-500' : 'bg-white/80 text-slate-500 hover:text-red-500 hover:bg-white'}`}>
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
                <button onClick={handleShare} className="p-2 rounded-full bg-white/80 backdrop-blur-md shadow-sm text-slate-500 hover:text-[#0099DD] hover:bg-white">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {allImages.map((img, idx) => (
                  <button key={idx} onClick={() => setSelectedImage(img)} className={`relative w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition ${mainImage === img ? 'border-[#0099DD] shadow-sm' : 'border-slate-200 hover:border-[#0099DD]/50'}`}>
                    <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-400 mr-2">{allImages.length} صور</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="w-full md:w-7/12 flex flex-col">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-2">
              {product.title_ar}
            </h1>
            <div className="text-sm font-mono text-slate-400 font-bold mb-4 bg-slate-50 px-3 py-1 rounded-lg self-start">
              SKU: {product.sku}
            </div>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-black text-slate-900">{product.price.toFixed(2)}</span>
              <span className="text-lg font-bold text-slate-500">ج.م</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-100">
                <Truck className="w-4 h-4" /> شحن سريع
              </div>
              <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-sky-100">
                <ShieldCheck className="w-4 h-4" /> دفع آمن B2B
              </div>
              <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100">
                <Phone className="w-4 h-4" /> ضمان التوريد
              </div>
            </div>

            {product.description_ar && (
              <div className="text-sm text-slate-600 leading-relaxed mb-8 border-t border-slate-100 pt-4">
                {product.description_ar}
              </div>
            )}

            {/* Non-matrix direct add to cart */}
            {!product.has_compatibility_matrix && (
              <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg h-12">
                    <button onClick={() => setSingleQty(Math.max(1, singleQty - 1))} className="px-4 h-full text-slate-500 hover:text-[#0099DD] transition"><Minus className="w-4 h-4" /></button>
                    <span className="w-12 text-center font-black text-lg">{singleQty}</span>
                    <button onClick={() => setSingleQty(singleQty + 1)} className="px-4 h-full text-slate-500 hover:text-[#0099DD] transition"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => addToCart(product, undefined, singleQty)} className="flex-1 bg-[#0099DD] hover:bg-[#007BB3] text-white h-12 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition shadow-md shadow-sky-500/20">
                    <Plus className="w-5 h-5" />
                    إضافة للسلة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Matrix Section */}
        {product.has_compatibility_matrix && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-black text-slate-900">اختيار الموديل والكمية</h2>
              
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ابحث عن موديل..." 
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full pl-4 pr-9 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0099DD] focus:ring-1 focus:ring-[#0099DD]"
                />
              </div>
            </div>

            {uniqueMatrixBrands.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-4 border-b border-slate-100">
                <button
                  onClick={() => setActiveBrandTab('all')}
                  className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeBrandTab === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >الكل</button>
                {uniqueMatrixBrands.map(brand => (
                  <button
                    key={brand}
                    onClick={() => setActiveBrandTab(brand)}
                    className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeBrandTab === brand ? 'bg-[#0099DD] text-white shadow-sm shadow-[#0099DD]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filteredMatrixItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm font-bold">لا توجد موديلات مطابقة للبحث</div>
              ) : (
                filteredMatrixItems.map(item => {
                  const isOutOfStock = item.stock_status === 'out_of_stock' || item.stock_quantity <= 0;
                  const qty = matrixSelections[item.id] || 0;
                  
                  return (
                    <div key={item.id} className={`p-4 flex items-center justify-between transition ${qty > 0 ? 'bg-sky-50/50' : 'hover:bg-slate-50'} ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-slate-800 mb-1">{item.model?.model_name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold">{item.model?.brand}</span>
                          {!isOutOfStock && <span className="text-slate-400">الحد الأدنى: {item.moq}</span>}
                          {isOutOfStock ? (
                            <span className="text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> غير متوفر</span>
                          ) : item.stock_status === 'limited' ? (
                            <span className="text-amber-600 font-bold">كمية محدودة ({item.stock_quantity})</span>
                          ) : (
                            <span className="text-emerald-600 font-bold">متوفر</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end w-32">
                        {isOutOfStock ? (
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">نفذت الكمية</span>
                        ) : (
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg h-9 shadow-sm">
                            <button onClick={() => updateMatrixQty(item, -1)} className="px-2 h-full text-slate-400 hover:text-red-500 transition"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="w-8 text-center font-black text-sm text-slate-800">{qty}</span>
                            <button onClick={() => updateMatrixQty(item, 1)} className="px-2 h-full text-slate-400 hover:text-[#0099DD] transition"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Matrix Action Bar */}
            {totalSelectedMatrixCount > 0 && (
              <div className="bg-[#0F172A] p-4 text-white flex items-center justify-between sticky bottom-0 z-20 md:static md:rounded-b-2xl">
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-0.5">الملخص</div>
                  <div className="text-sm font-black flex items-center gap-3">
                    <span>{totalSelectedMatrixCount} موديلات</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span>{totalSelectedMatrixQty} قطعة</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span className="text-[#0099DD]">{totalSelectedMatrixPrice.toFixed(2)} ج.م</span>
                  </div>
                </div>
                <button
                  onClick={handleAddMatrixToCart}
                  className="bg-[#0099DD] hover:bg-[#007BB3] text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition shadow-md shadow-sky-500/20"
                >
                  <Plus className="w-4 h-4" />
                  إضافة للسلة
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alternative Products */}
        {alternativeProducts.length > 0 && (
          <div className="pt-8">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#0099DD] rounded-full"></span>
              منتجات مشابهة قد تعجبك
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {alternativeProducts.map(alt => (
                <ProductCard key={alt.id} product={alt} />
              ))}
            </div>
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
