'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Boxes,
  Smartphone,
  Plus,
  Trash2,
  Save,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Edit2,
  X,
  Upload,
  Download,
  CheckSquare,
  Square,
  Layers,
  Loader2,
} from 'lucide-react';
import { Product, MasterModel, StockStatus, UserRole } from '@/types';
import { canManageMatrix } from '@/services/authService';
import { calculateStockStatus } from '@/services/matrixService';

interface CompatibilityMatrixManagerProps {
  products: Product[];
  masterModels: MasterModel[];
  currentRole: UserRole;
  onAddModelToMatrix: (productId: string, modelId: string, stock: number, moq: number) => void | Promise<any>;
  onBulkAddModelToMatrix?: (productId: string, items: Array<{ model_id: string; stock_quantity: number; moq: number }>) => void | Promise<any>;
  onUpdateMatrixItem: (
    productId: string,
    matrixItemId: string,
    stock: number,
    moq: number,
    status: StockStatus
  ) => void | Promise<any>;

  onDeleteMatrixItem: (productId: string, matrixItemId: string) => void | Promise<any>;
  onAddMasterModel: (model: Omit<MasterModel, 'id' | 'created_at'>) => void | Promise<any>;
  onDeleteMasterModel: (id: string) => void | Promise<any>;
}

export const CompatibilityMatrixManager: React.FC<CompatibilityMatrixManagerProps> = ({
  products,
  masterModels,
  currentRole,
  onAddModelToMatrix,
  onBulkAddModelToMatrix,
  onUpdateMatrixItem,
  onDeleteMatrixItem,
  onAddMasterModel,
  onDeleteMasterModel,
}) => {
  const matrixProducts = products.filter((p) => p.has_compatibility_matrix);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    matrixProducts[0]?.id || ''
  );

  // Sub-tabs: 'matrix' | 'master_models'
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'master_models'>('matrix');

  // Master Model modal state
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [brand, setBrand] = useState('Apple');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [series, setSeries] = useState('');
  const [modelName, setModelName] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());

  // Add Single Model to Matrix modal state
  const [isAddMatrixModalOpen, setIsAddMatrixModalOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [newStockQty, setNewStockQty] = useState<number>(50);
  const [newMoq, setNewMoq] = useState<number>(5);

  // Inline New Model creation in Add to Matrix Modal
  const [showInlineAddModel, setShowInlineAddModel] = useState(false);
  const [inlineBrand, setInlineBrand] = useState('Apple');
  const [inlineModelName, setInlineModelName] = useState('');
  const [inlineSeries, setInlineSeries] = useState('');
  const [inlineYear, setInlineYear] = useState<number>(new Date().getFullYear());
  const [isCreatingInlineModel, setIsCreatingInlineModel] = useState(false);

  // Bulk Add Models to Matrix modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSelectedModelIds, setBulkSelectedModelIds] = useState<string[]>([]);
  const [bulkStockQty, setBulkStockQty] = useState<number>(50);
  const [bulkMoq, setBulkMoq] = useState<number>(5);
  const [bulkBrandFilter, setBulkBrandFilter] = useState<string>('all');
  const [bulkSearch, setBulkSearch] = useState<string>('');

  // Ref for Phone models CSV input
  const modelsCsvInputRef = useRef<HTMLInputElement>(null);

  // Computed available brands dynamically
  const availableBrands = useMemo(() => {
    const defaults = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Realme', 'Infinix', 'Huawei', 'Honor', 'Vivo'];
    const fromModels = masterModels.map((m) => m.brand).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromModels]));
  }, [masterModels]);

  // Inline editing state for matrix items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMoq, setEditMoq] = useState<number>(1);

  const isAdmin = canManageMatrix(currentRole);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleStartEdit = (itemId: string, currentStock: number, currentMoq: number) => {
    setEditingItemId(itemId);
    setEditStock(currentStock);
    setEditMoq(currentMoq);
  };

  const handleSaveInline = (productId: string, matrixItemId: string) => {
    const calculatedStatus = calculateStockStatus(editStock);
    onUpdateMatrixItem(productId, matrixItemId, editStock, editMoq, calculatedStatus);
    setEditingItemId(null);
  };

  const handleSaveNewModel = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBrand = isCustomBrand ? customBrand.trim() : brand.trim();
    if (!modelName.trim() || !finalBrand) return;

    onAddMasterModel({
      brand: finalBrand,
      series: series.trim() || undefined,
      model_name: modelName.trim(),
      release_year: releaseYear,
    });
    setIsModelModalOpen(false);
    setModelName('');
    setSeries('');
    setCustomBrand('');
    setIsCustomBrand(false);
  };

  const handleAddMatrixItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedModelId) return;

    onAddModelToMatrix(selectedProductId, selectedModelId, newStockQty, newMoq);
    setIsAddMatrixModalOpen(false);
  };

  const handleCreateAndSelectInlineModel = async () => {
    if (!inlineBrand.trim() || !inlineModelName.trim()) return;
    setIsCreatingInlineModel(true);
    try {
      const created = await onAddMasterModel({
        brand: inlineBrand.trim().toUpperCase(),
        model_name: inlineModelName.trim(),
        series: inlineSeries.trim() || undefined,
        release_year: inlineYear,
      });
      if (created && created.id) {
        setSelectedModelId(created.id);
        setShowInlineAddModel(false);
        setInlineModelName('');
        setInlineSeries('');
      }
    } catch (err) {
      console.error('Error adding master model inline:', err);
    } finally {
      setIsCreatingInlineModel(false);
    }
  };

  const handleBulkAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || bulkSelectedModelIds.length === 0) return;

    if (onBulkAddModelToMatrix) {
      const items = bulkSelectedModelIds.map((mid) => ({
        model_id: mid,
        stock_quantity: bulkStockQty,
        moq: bulkMoq,
      }));
      onBulkAddModelToMatrix(selectedProductId, items);
    } else {
      bulkSelectedModelIds.forEach((mid) => {
        onAddModelToMatrix(selectedProductId, mid, bulkStockQty, bulkMoq);
      });
    }

    setIsBulkModalOpen(false);
    setBulkSelectedModelIds([]);
  };

  const handleExportModelsCSV = () => {
    const headers = ['brand', 'series', 'model_name', 'release_year'];
    const rows = masterModels.map((m) => [
      `"${m.brand}"`,
      `"${(m.series || '').replace(/"/g, '""')}"`,
      `"${m.model_name.replace(/"/g, '""')}"`,
      m.release_year || '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `phone_models_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportModelsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length <= 1) return;
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
        if (parts.length >= 3) {
          const b = parts[0];
          const s = parts[1];
          const m = parts[2];
          const y = parseInt(parts[3]) || new Date().getFullYear();
          onAddMasterModel({
            brand: b,
            series: s || undefined,
            model_name: m,
            release_year: y,
          });
          count++;
        }
      }
      alert(`تم استيراد ${count} موديل هاتف بنجاح.`);
      if (modelsCsvInputRef.current) modelsCsvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const getStatusBadge = (status: StockStatus) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>متوفر</span>
          </span>
        );
      case 'limited':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>كمية محدودة</span>
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <XCircle className="w-3 h-3" />
            <span>نفدت الكمية</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation sub-tabs */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeSubTab === 'matrix'
                ? 'bg-[#0099DD] text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>مصفوفة توافق المنتجات بالموديلات</span>
          </button>
          <button
            onClick={() => setActiveSubTab('master_models')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
              activeSubTab === 'master_models'
                ? 'bg-[#0099DD] text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>قاموس موديلات الهواتف المركزية ({masterModels.length})</span>
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-200">
            <CheckCircle2 className="w-4 h-4 text-[#0099DD]" />
            <span>استعراض توافق الموديلات والمخزون</span>
          </div>
        )}
      </div>

      {/* Sub-tab 1: Product Compatibility Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-5">
          {/* Product Selector Dropdown */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">اختر المنتج لإدارة توافقه:</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0099DD]"
              >
                {matrixProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title_ar} (SKU: {p.sku})
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && selectedProduct && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkSelectedModelIds([]);
                    setBulkBrandFilter('all');
                    setBulkSearch('');
                    setIsBulkModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>ربط متعدد للموديلات (Bulk Add)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedModelId(masterModels[0]?.id || '');
                    setIsAddMatrixModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة موديل فردي</span>
                </button>
              </div>
            )}
          </div>

          {/* Matrix Items Table */}
          {selectedProduct ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">{selectedProduct.title_ar}</h3>
                  <p className="text-[11px] text-slate-500">
                    الحد الأدنى للطلب (MOQ) والمخزون يعملان على مستوى كل موديل هاتف متوافق بصورة مستقلة.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#0099DD] bg-white px-3 py-1 rounded-lg border border-slate-200">
                  {selectedProduct.matrix_items?.length || 0} موديل مسجل
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">ماركة الهاتف</th>
                      <th className="p-3.5">الموديل المتوافق</th>
                      <th className="p-3.5">الكمية المتوفرة (Stock)</th>
                      <th className="p-3.5">أقل كمية للطلب (MOQ)</th>
                      <th className="p-3.5">حالة التوفر</th>
                      {isAdmin && <th className="p-3.5 text-center">الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!selectedProduct.matrix_items || selectedProduct.matrix_items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400">
                          لا توجد موديلات مضافة لهذا المنتج بعد. اضغط &quot;إضافة موديل متوافق&quot; للبدء.
                        </td>
                      </tr>
                    ) : (
                      selectedProduct.matrix_items.map((item) => {
                        const isEditing = editingItemId === item.id;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="p-3.5 font-bold text-slate-800">{item.model?.brand}</td>
                            <td className="p-3.5 font-semibold text-slate-700">{item.model?.model_name}</td>

                            {/* Stock Quantity */}
                            <td className="p-3.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editStock}
                                  onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-center"
                                />
                              ) : (
                                <span className="font-extrabold text-slate-900 text-sm">
                                  {item.stock_quantity} قطعة
                                </span>
                              )}
                            </td>

                            {/* MOQ */}
                            <td className="p-3.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={editMoq}
                                  onChange={(e) => setEditMoq(parseInt(e.target.value) || 1)}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-center"
                                />
                              ) : (
                                <span className="bg-slate-100 px-2.5 py-1 rounded-md font-bold text-slate-700 border border-slate-200">
                                  {item.moq} قطع كحد أدنى
                                </span>
                              )}
                            </td>

                            {/* Stock Status Badge */}
                            <td className="p-3.5">{getStatusBadge(item.stock_status)}</td>

                            {/* Actions */}
                            {isAdmin && (
                              <td className="p-3.5 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleSaveInline(selectedProduct.id, item.id)}
                                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                      title="حفظ"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingItemId(null)}
                                      className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                      title="إلغاء"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleStartEdit(item.id, item.stock_quantity, item.moq)}
                                      className="p-1.5 rounded-lg bg-blue-50 text-[#0099DD] hover:bg-blue-100 border border-blue-200"
                                      title="تعديل الكمية والحد الأدنى"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteMatrixItem(selectedProduct.id, item.id)}
                                      className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
                                      title="حذف الموديل من المصفوفة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
              لا توجد منتجات تحتوي على مصفوفة توافق مفعلة.
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: Master Models Repository */}
      {activeSubTab === 'master_models' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">مستودع موديلات الهواتف المركزية</h3>
              <p className="text-[11px] text-slate-500">
                هذه القائمة المركزية تمثل كل هواتف السوق المعتمدة في النظام، وترتبط بها مصفوفات المنتجات.
              </p>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={modelsCsvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportModelsCSV}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleExportModelsCSV}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                  title="تصدير قاموس الموديلات إلى ملف CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => modelsCsvInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                  title="استيراد موديلات هواتف من ملف CSV"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>استيراد CSV</span>
                </button>

                <button
                  onClick={() => {
                    setIsCustomBrand(false);
                    setCustomBrand('');
                    setIsModelModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة موديل هاتف جديد</span>
                </button>
              </div>
            )}
          </div>

          {/* Master Models Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الماركة (Brand)</th>
                  <th className="p-3">السلسلة (Series)</th>
                  <th className="p-3">اسم الموديل الكامل</th>
                  <th className="p-3">سنة الإصدار</th>
                  {isAdmin && <th className="p-3 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterModels.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{m.brand}</td>
                    <td className="p-3 text-slate-500">{m.series || '-'}</td>
                    <td className="p-3 font-semibold text-slate-800">{m.model_name}</td>
                    <td className="p-3 font-mono text-slate-500">{m.release_year || '-'}</td>
                    {isAdmin && (
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`هل تريد حذف الموديل ${m.model_name} نهائياً؟`)) {
                              onDeleteMasterModel(m.id);
                            }
                          }}
                          className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Model to Matrix */}
      {isAddMatrixModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm">
                إضافة موديل لمصفوفة: {selectedProduct.title_ar}
              </h3>
              <button
                onClick={() => setIsAddMatrixModalOpen(false)}
                className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddMatrixItem} className="p-5 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">الموديل المتوافق:</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineAddModel(!showInlineAddModel)}
                    className="text-[11px] text-[#0099DD] hover:underline font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showInlineAddModel ? 'اختيار من القاموس' : '+ إضافة موديل جديد فوراً'}</span>
                  </button>
                </div>

                {!showInlineAddModel ? (
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                    required
                  >
                    {masterModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.brand} - {m.model_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl space-y-2.5">
                    <div className="text-[11px] font-bold text-sky-900">
                      تسجيل موديل جديد في القاموس المركزي:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">الماركة (Brand) *</label>
                        <input
                          type="text"
                          required
                          value={inlineBrand}
                          onChange={(e) => setInlineBrand(e.target.value)}
                          placeholder="مثال: Apple"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم الموديل الكامل *</label>
                        <input
                          type="text"
                          required
                          value={inlineModelName}
                          onChange={(e) => setInlineModelName(e.target.value)}
                          placeholder="مثال: iPhone 16 Pro Max"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">السلسلة (اختياري)</label>
                        <input
                          type="text"
                          value={inlineSeries}
                          onChange={(e) => setInlineSeries(e.target.value)}
                          placeholder="مثال: iPhone 16"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">سنة الإصدار</label>
                        <input
                          type="number"
                          value={inlineYear}
                          onChange={(e) => setInlineYear(parseInt(e.target.value) || 2025)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateAndSelectInlineModel}
                      disabled={isCreatingInlineModel || !inlineBrand.trim() || !inlineModelName.trim()}
                      className="w-full py-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-lg font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isCreatingInlineModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>حفظ الموديل واختياره للمصفوفة</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكمية الأولية (Stock):</label>
                  <input
                    type="number"
                    min="0"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحد الأدنى للطلب (MOQ):</label>
                  <input
                    type="number"
                    min="1"
                    value={newMoq}
                    onChange={(e) => setNewMoq(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddMatrixModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-[#0099DD] hover:bg-[#007BB3] text-white px-5 py-2 rounded-xl font-bold shadow-sm"
                >
                  إضافة للمصفوفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Master Phone Model */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-sm">إضافة موديل هاتف جديد للقاموس المركزي</h3>
              <button
                onClick={() => setIsModelModalOpen(false)}
                className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveNewModel} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الماركة (Brand) *</label>
                  <select
                    value={isCustomBrand ? '__custom__' : brand}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomBrand(true);
                      } else {
                        setIsCustomBrand(false);
                        setBrand(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="__custom__">+ ماركة جديدة مخصصة...</option>
                  </select>
                  {isCustomBrand && (
                    <input
                      type="text"
                      required
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      placeholder="أدخل اسم الماركة الجديدة..."
                      className="w-full px-3 py-1.5 mt-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#0099DD]"
                    />
                  )}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سنة الإصدار</label>
                  <input
                    type="number"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(parseInt(e.target.value) || 2024)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">السلسلة (Series)</label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="مثال: iPhone 16 أو Galaxy S24"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الموديل الكامل *</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="مثال: iPhone 16 Pro Max"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-[#0099DD] hover:bg-[#007BB3] text-white px-5 py-2 rounded-xl font-bold shadow-sm"
                >
                  حفظ الموديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Add Models to Matrix */}
      {isBulkModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0099DD]" />
                  <span>ربط متعدد لموديلات الهواتف — {selectedProduct.title_ar}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  حدد مجموعة موديلات هواتف لإضافتها دفعة واحدة لمصفوفة هذا المنتج.
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkBrandFilter}
                  onChange={(e) => setBulkBrandFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="all">كل الماركات</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder="بحث بالموديل..."
                    className="w-full pl-2 pr-8 py-1.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Select All in Filter */}
              <button
                type="button"
                onClick={() => {
                  const matching = masterModels.filter((m) => {
                    const matchB = bulkBrandFilter === 'all' || m.brand === bulkBrandFilter;
                    const matchQ = !bulkSearch || m.model_name.toLowerCase().includes(bulkSearch.toLowerCase());
                    return matchB && matchQ;
                  }).map((m) => m.id);

                  const allSelected = matching.every((id) => bulkSelectedModelIds.includes(id));
                  if (allSelected) {
                    setBulkSelectedModelIds(bulkSelectedModelIds.filter((id) => !matching.includes(id)));
                  } else {
                    setBulkSelectedModelIds(Array.from(new Set([...bulkSelectedModelIds, ...matching])));
                  }
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#0099DD]" />
                <span>تحديد / إلغاء الكل</span>
              </button>
            </div>

            {/* Models Checkbox Grid */}
            <div className="flex-1 overflow-y-auto p-4 max-h-72">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {masterModels
                  .filter((m) => {
                    const matchB = bulkBrandFilter === 'all' || m.brand === bulkBrandFilter;
                    const matchQ = !bulkSearch || m.model_name.toLowerCase().includes(bulkSearch.toLowerCase());
                    return matchB && matchQ;
                  })
                  .map((m) => {
                    const isChecked = bulkSelectedModelIds.includes(m.id);
                    const alreadyInMatrix = selectedProduct.matrix_items?.some((mi) => mi.model_id === m.id);

                    return (
                      <label
                        key={m.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition text-xs ${
                          isChecked
                            ? 'bg-sky-50/70 border-[#0099DD]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setBulkSelectedModelIds((prev) =>
                                prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              );
                            }}
                            className="w-4 h-4 text-[#0099DD] rounded"
                          />
                          <div>
                            <span className="font-bold text-slate-900">{m.model_name}</span>
                            <span className="text-[10px] text-slate-400 block">{m.brand} {m.series ? `• ${m.series}` : ''}</span>
                          </div>
                        </div>

                        {alreadyInMatrix && (
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                            مضاف سابقاً
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Modal Bottom Controls: Default Stock & MOQ & Submit */}
            <form onSubmit={handleBulkAddSubmit} className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <label className="font-bold text-slate-700 whitespace-nowrap">الكمية الافتراضية:</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkStockQty}
                    onChange={(e) => setBulkStockQty(parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="font-bold text-slate-700 whitespace-nowrap">الحد الأدنى (MOQ):</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkMoq}
                    onChange={(e) => setBulkMoq(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-white transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={bulkSelectedModelIds.length === 0}
                  className="px-5 py-2 bg-[#0099DD] hover:bg-[#007BB3] text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
                >
                  إضافة ({bulkSelectedModelIds.length}) موديل للمصفوفة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
