'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Loader2,
  Package,
  Calculator,
  Search,
  CheckCircle,
} from 'lucide-react';
import { Order, OrderItem, Product, MasterModel } from '@/types';

interface OrderEditModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  masterModels: MasterModel[];
  onSave: (orderId: string, updatedItems: OrderItem[], editReason?: string) => Promise<{ success: boolean; message?: string }>;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({
  order,
  isOpen,
  onClose,
  products,
  masterModels,
  onSave,
}) => {
  if (!isOpen || !order) return null;

  // Local state initialized with current order items
  const [items, setItems] = useState<OrderItem[]>(() =>
    (order.items || []).map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      subtotal: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    }))
  );

  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Add Item Sub-form State
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemPrice, setAddItemPrice] = useState(0);

  // Filter products for adding
  const filteredProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return products.slice(0, 20);
    const q = searchProductQuery.toLowerCase().trim();
    return products
      .filter((p) => p.is_active && (p.title_ar.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))
      .slice(0, 25);
  }, [products, searchProductQuery]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Available models if selected product has compatibility matrix
  const availableModelsForProduct = useMemo(() => {
    if (!selectedProduct || !selectedProduct.has_compatibility_matrix) return [];
    if (selectedProduct.matrix_items && selectedProduct.matrix_items.length > 0) {
      return selectedProduct.matrix_items
        .map((m) => m.model || masterModels.find((mm) => mm.id === m.model_id))
        .filter(Boolean) as MasterModel[];
    }
    return masterModels;
  }, [selectedProduct, masterModels]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setSelectedModelId('');
    setAddItemPrice(prod.price || 0);
    setAddItemQty(1);
  };

  const handleConfirmAddItem = () => {
    if (!selectedProduct) return;
    if (addItemQty <= 0) {
      alert('يرجى تحديد كمية صحيحة أكبر من صفر');
      return;
    }
    if (addItemPrice < 0) {
      alert('سعر الوحدة لا يمكن أن يكون سالباً');
      return;
    }

    const matchedModel = availableModelsForProduct.find((m) => m.id === selectedModelId);

    const newItem: OrderItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order_id: order.id,
      product_id: selectedProduct.id,
      product_title: selectedProduct.title_ar,
      product_sku: selectedProduct.sku,
      model_id: matchedModel?.id,
      model_name: matchedModel?.model_name,
      quantity: addItemQty,
      unit_price: addItemPrice,
      subtotal: addItemQty * addItemPrice,
    };

    setItems((prev) => [...prev, newItem]);
    // Reset add form
    setIsAddingItem(false);
    setSelectedProductId('');
    setSelectedModelId('');
    setSearchProductQuery('');
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const validQty = Math.max(1, Math.floor(newQty) || 1);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantity: validQty,
        subtotal: validQty * copy[index].unit_price,
      };
      return copy;
    });
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const validPrice = Math.max(0, Number(newPrice) || 0);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unit_price: validPrice,
        subtotal: copy[index].quantity * validPrice,
      };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      if (!confirm('هذا هو البند الوحيد في الطلب. هل تريد حذفه حقاً؟')) return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Recalculated Total
  const newTotal = useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  }, [items]);

  const totalPieces = useMemo(() => {
    return items.reduce((acc, it) => acc + it.quantity, 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMessage('لا يمكن حفظ طلبية فارغة بدون أي منتجات.');
      return;
    }

    const hasZeroPrice = items.some((it) => it.unit_price <= 0);
    if (hasZeroPrice) {
      if (!confirm('يوجد بند أو أكثر بسعر 0 ج.م في الفاتورة. هل أنت متأكد من حفظ الفاتورة بهذا السعر؟')) {
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const res = await onSave(order.id, items, editReason.trim() || undefined);
      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.message || 'فشل حفظ التعديلات.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ غير متوقع أثناء الحفظ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-[#38bdf8] flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">تعديل بنود الفاتورة والطلبية</h3>
              <p className="text-[11px] text-slate-300 font-mono">
                طلب: {order.order_number} | العميل: {order.customer_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Top Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">حالة الطلب:</span>
              <span className="font-bold text-slate-800">{order.status}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">المبلغ السابق:</span>
              <span className="font-bold text-slate-600 line-through">
                {Number(order.total_amount).toFixed(2)} ج.م
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">المبلغ الجديد بعد التعديل:</span>
              <span className="font-black text-emerald-700 text-sm">
                {newTotal.toFixed(2)} ج.م
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsAddingItem(!isAddingItem)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingItem ? 'إغلاق نافذة الإضافة' : 'إضافة منتج للطلبية'}</span>
              </button>
            </div>
          </div>

          {/* Sub-form: Add Product to Order */}
          {isAddingItem && (
            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#0099DD]" />
                  <span>إضافة منتج جديد للطلبية:</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Select Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ابحث بالاسم أو كود SKU:
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                      placeholder="ابحث لاختيار منتج..."
                      className="w-full pr-8 pl-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#0099DD]"
                    />
                  </div>
                  {filteredProducts.length > 0 && !selectedProductId && (
                    <div className="max-h-36 overflow-y-auto mt-1 border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-sm">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="p-2 text-xs hover:bg-sky-50 cursor-pointer flex items-center justify-between"
                        >
                          <span className="font-semibold text-slate-800">{p.title_ar}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{p.price} ج.م</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedProduct && (
                  <div className="space-y-2">
                    <div className="p-2 bg-white rounded-lg border border-sky-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-mono">{selectedProduct.sku}</span>
                        <span className="font-bold text-slate-900">{selectedProduct.title_ar}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProductId('')}
                        className="text-xs text-red-500 hover:underline"
                      >
                        تغيير
                      </button>
                    </div>

                    {/* Model selector if matrix product */}
                    {selectedProduct.has_compatibility_matrix && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          اختر الموديل المتوافق:
                        </label>
                        <select
                          value={selectedModelId}
                          onChange={(e) => setSelectedModelId(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#0099DD]"
                        >
                          <option value="">بدون موديل محدد (عام)</option>
                          {availableModelsForProduct.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.model_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الكمية:</label>
                        <input
                          type="number"
                          min={1}
                          value={addItemQty}
                          onChange={(e) => setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">سعر الوحدة (ج.م):</label>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={addItemPrice}
                          onChange={(e) => setAddItemPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold text-emerald-700"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmAddItem}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>تأكيد إضافة هذا البند للطلبية</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">بنود الطلبية ({items.length} بند):</span>
              <span className="text-[11px] text-slate-500 font-medium">إجمالي القطع: {totalPieces} قطعة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم المنتج</th>
                    <th className="p-3">الموديل</th>
                    <th className="p-3 w-28">الكمية</th>
                    <th className="p-3 w-32">سعر الوحدة (ج.م)</th>
                    <th className="p-3">الإجمالي (ج.م)</th>
                    <th className="p-3 text-center w-16">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{it.product_title || 'منتج غير مسمى'}</div>
                        {it.product_sku && (
                          <div className="text-[10px] text-slate-400 font-mono">{it.product_sku}</div>
                        )}
                      </td>
                      <td className="p-3">
                        {it.model_name ? (
                          <span className="bg-sky-50 text-[#0099DD] border border-sky-100 px-2 py-0.5 rounded text-[10px] font-bold">
                            {it.model_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value))}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-800 bg-white focus:outline-none focus:border-[#0099DD]"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={it.unit_price}
                          onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value))}
                          className={`w-24 px-2 py-1.5 border rounded-lg text-center font-bold bg-white focus:outline-none focus:border-[#0099DD] ${
                            it.unit_price <= 0
                              ? 'border-red-400 text-red-600 bg-red-50/30 ring-1 ring-red-400'
                              : 'border-slate-300 text-emerald-700'
                          }`}
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {(it.quantity * it.unit_price).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Reason Note */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              ملاحظة أو سبب التعديل (تُسجل في سجل العمليات):
            </label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="مثال: تصحيح سعر بند، إضافة منتج بناء على رغبة العميل..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:border-[#0099DD]"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">الإجمالي النهائي الجديد:</span>
            <span className="text-lg font-black text-emerald-700 font-mono">
              {newTotal.toFixed(2)} ج.م
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ وتحديث الفاتورة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
