'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Minus,
  ShoppingCart,
  Smartphone,
  Info,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { MasterModel } from '@/types';
import { enforceModelMOQ } from '@/services/matrixService';

export default function CompatibilityModal() {
  const { compatibilityProduct, closeCompatibilityModal, addToCart } = useStore();
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [searchModel, setSearchModel] = useState<string>('');
  
  // Model quantities mapped by modelId
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  const matrixItems = useMemo(() => compatibilityProduct?.matrix_items || [], [compatibilityProduct]);

  // Available brands in this matrix
  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    matrixItems.forEach((item) => {
      if (item.model?.brand) brandSet.add(item.model.brand);
    });
    return Array.from(brandSet);
  }, [matrixItems]);

  // Filtered matrix items
  const filteredItems = useMemo(() => {
    return matrixItems.filter((item) => {
      const matchBrand = selectedBrand === 'ALL' || item.model?.brand === selectedBrand;
      const matchSearch =
        !searchModel ||
        item.model?.model_name.toLowerCase().includes(searchModel.toLowerCase()) ||
        item.model?.brand.toLowerCase().includes(searchModel.toLowerCase());
      return matchBrand && matchSearch;
    });
  }, [matrixItems, selectedBrand, searchModel]);

  if (!compatibilityProduct) return null;

  const handleQtyChange = (modelId: string, qty: number, moq: number, maxStock: number) => {
    if (qty <= 0 || qty < moq) {
      const copy = { ...selectedQuantities };
      delete copy[modelId];
      setSelectedQuantities(copy);
      return;
    }
    const finalQty = Math.min(enforceModelMOQ(qty, moq), maxStock);
    setSelectedQuantities((prev) => ({
      ...prev,
      [modelId]: finalQty,
    }));
  };

  const totalSelectedModelsCount = Object.keys(selectedQuantities).length;
  const totalSelectedPiecesCount = Object.values(selectedQuantities).reduce((a, b) => a + b, 0);
  const totalSelectedPrice = totalSelectedPiecesCount * compatibilityProduct.price;

  const handleAddAllToCart = () => {
    Object.entries(selectedQuantities).forEach(([modelId, qty]) => {
      const mItem = matrixItems.find((m) => m.model_id === modelId);
      if (mItem && mItem.model) {
        addToCart(compatibilityProduct, mItem.model, qty);
      }
    });
    closeCompatibilityModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0">
              <Image
                src={compatibilityProduct.image_url || '/placeholder.svg'}
                alt={compatibilityProduct.title_ar}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#0099DD] text-white font-bold px-2 py-0.5 rounded">
                  مصفوفة التوافق والموديلات
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {compatibilityProduct.sku}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 line-clamp-1">
                {compatibilityProduct.title_ar}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
              <div className="text-[11px] text-slate-400">سعر القطعة الموحد</div>
              <div className="font-black text-sm text-sky-400">
                {compatibilityProduct.price.toFixed(2)} ج.م
              </div>
            </div>
            <button
              onClick={closeCompatibilityModal}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
          {/* Brand Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedBrand('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedBrand === 'ALL'
                  ? 'bg-[#0099DD] text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              كل الماركات ({matrixItems.length})
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedBrand === b
                    ? 'bg-[#0099DD] text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Search Model Input */}
          <div className="relative">
            <input
              type="text"
              value={searchModel}
              onChange={(e) => setSearchModel(e.target.value)}
              placeholder="ابحث عن موديل هاتف محدد (مثال: iPhone 15, S24, Note 13...)"
              className="w-full pl-4 pr-9 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#0099DD] bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Models List Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-2">
            <Info className="w-4 h-4 text-[#0099DD]" />
            <span>
              الحد الأدنى للطلب (MOQ) محدد على مستوى كل موديل بشكل مستقل. يمكنك تحديد كميات متعددة وإضافتها دفعة واحدة.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const currentQty = selectedQuantities[item.model_id] || 0;
              const isOutOfStock = item.stock_status === 'out_of_stock' || item.stock_quantity === 0;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    currentQty > 0
                      ? 'border-[#0099DD] bg-sky-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  } ${isOutOfStock ? 'opacity-60 bg-slate-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 font-bold text-xs">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          {item.model?.brand}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900">
                          {item.model?.model_name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        {/* Status Badge */}
                        {item.stock_status === 'in_stock' && (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> متوفر بالمخزن ({item.stock_quantity})
                          </span>
                        )}
                        {item.stock_status === 'limited' && (
                          <span className="text-amber-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> كمية محدودة ({item.stock_quantity})
                          </span>
                        )}
                        {item.stock_status === 'out_of_stock' && (
                          <span className="text-red-500 font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> غير متوفر حالياً
                          </span>
                        )}

                        <span className="text-slate-400">|</span>
                        <span className="text-slate-600 font-medium">
                          أقل طلب: <span className="font-bold text-slate-900">{item.moq} قطع</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="shrink-0">
                    {isOutOfStock ? (
                      <span className="text-xs text-slate-400 font-semibold px-2 py-1 bg-slate-100 rounded">
                        نفد
                      </span>
                    ) : (
                      <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
                        <button
                          onClick={() =>
                            handleQtyChange(
                              item.model_id,
                              currentQty - 1,
                              item.moq,
                              item.stock_quantity
                            )
                          }
                          disabled={currentQty === 0}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.stock_quantity}
                          value={currentQty}
                          onChange={(e) =>
                            handleQtyChange(
                              item.model_id,
                              Number(e.target.value) || 0,
                              item.moq,
                              item.stock_quantity
                            )
                          }
                          className="w-12 text-center text-xs font-bold text-slate-900 focus:outline-none border-x border-slate-200 py-1"
                        />
                        <button
                          onClick={() =>
                            handleQtyChange(
                              item.model_id,
                              currentQty === 0 ? item.moq : currentQty + 1,
                              item.moq,
                              item.stock_quantity
                            )
                          }
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Summary & Bulk Add Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">الموديلات المحددة: </span>
              <span className="font-bold text-slate-900">{totalSelectedModelsCount} موديل</span>
            </div>
            <div>
              <span className="text-slate-500">إجمالي القطع: </span>
              <span className="font-bold text-slate-900">{totalSelectedPiecesCount} قطعة</span>
            </div>
            <div>
              <span className="text-slate-500">المبلغ الإجمالي: </span>
              <span className="font-black text-[#0099DD] text-sm">
                {totalSelectedPrice.toFixed(2)} ج.م
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={closeCompatibilityModal}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              إلغاء
            </button>
            <button
              onClick={handleAddAllToCart}
              disabled={totalSelectedModelsCount === 0}
              className="flex-1 sm:flex-initial bg-[#0099DD] hover:bg-[#007BB3] disabled:bg-slate-300 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>إضافة جميع الموديلات المحددة للسلة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
