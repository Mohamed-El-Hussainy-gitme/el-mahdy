'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldAlert,
  Boxes,
  Save,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Product, Category, UserRole } from '@/types';
import { validateProductData, calculateMatrixStockSummary } from '@/services/productService';
import { canManageProducts } from '@/services/authService';
import { uploadProductImage } from '@/lib/storage';

interface ProductManagerProps {
  products: Product[];
  categories: Category[];
  currentRole: UserRole;
  onAddProduct: (product: any) => void | Promise<any>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void | Promise<void>;
  onDeleteProduct: (id: string) => void | Promise<void>;
  onToggleActive?: (id: string, active: boolean) => void | Promise<void>;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  categories,
  currentRole,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onToggleActive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [sku, setSku] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [descAr, setDescAr] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [isExchangeOnly, setIsExchangeOnly] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [hasMatrix, setHasMatrix] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryFileInputRef = React.useRef<HTMLInputElement>(null);
  const csvInputRef = React.useRef<HTMLInputElement>(null);

  const isAdmin = canManageProducts(currentRole);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.title_ar.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.description_ar && p.description_ar.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const handleOpenModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setSku(prod.sku);
      setTitleAr(prod.title_ar);
      setDescAr(prod.description_ar || '');
      setPrice(prod.price);
      setCostPrice(prod.cost_price || 0);
      setImageUrl(prod.image_url);
      setGalleryUrls(prod.gallery_urls || []);
      setIsExchangeOnly(prod.is_exchange_only);
      setIsFeatured(prod.is_featured);
      setHasMatrix(prod.has_compatibility_matrix);
      setSelectedCategoryIds(prod.category_ids || []);
    } else {
      setEditingProduct(null);
      setSku('MH-' + Math.floor(10000 + Math.random() * 90000));
      setTitleAr('');
      setDescAr('');
      setPrice(100);
      setCostPrice(70);
      setImageUrl('');
      setGalleryUrls([]);
      setIsExchangeOnly(false);
      setIsFeatured(false);
      setHasMatrix(false);
      setSelectedCategoryIds(categories.length > 0 ? [categories[0].id] : []);
    }
    setIsModalOpen(true);
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const res = await uploadProductImage(file);
    setIsUploading(false);
    if (res.url) {
      setImageUrl(res.url);
    } else {
      alert('فشل رفع الصورة: ' + (res.error || 'خطأ غير معروف'));
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingGallery(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const res = await uploadProductImage(files[i], 'products/gallery');
      if (res.url) {
        newUrls.push(res.url);
      }
    }
    setIsUploadingGallery(false);
    if (newUrls.length > 0) {
      setGalleryUrls((prev) => [...prev, ...newUrls]);
    }
    if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
  };

  const handleExportCSV = () => {
    const headers = ['sku', 'title_ar', 'price', 'cost_price', 'is_featured', 'has_matrix'];
    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.title_ar.replace(/"/g, '""')}"`,
      p.price,
      p.cost_price || 0,
      p.is_featured ? 'true' : 'false',
      p.has_compatibility_matrix ? 'true' : 'false',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const pSku = parts[0] || ('MH-' + Math.floor(10000 + Math.random() * 90000));
          const pTitle = parts[1];
          const pPrice = parseFloat(parts[2]) || 0;
          const pCost = parseFloat(parts[3]) || 0;
          onAddProduct({
            sku: pSku,
            title_ar: pTitle,
            price: pPrice,
            cost_price: pCost,
            image_url: '',
            is_exchange_only: false,
            is_featured: false,
            has_compatibility_matrix: true,
            category_ids: categories.length > 0 ? [categories[0].id] : [],
          });
          count++;
        }
      }
      alert(`تم استيراد ${count} منتج بنجاح.`);
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const productPayload = {
      sku: sku.trim(),
      title_ar: titleAr.trim(),
      description_ar: descAr.trim(),
      price: Number(price),
      cost_price: Number(costPrice) || 0,
      image_url: imageUrl.trim(),
      gallery_urls: galleryUrls,
      is_exchange_only: isExchangeOnly,
      is_featured: isFeatured,
      is_active: true,
      has_compatibility_matrix: hasMatrix,
      category_ids: selectedCategoryIds,
    };

    const validation = validateProductData(productPayload);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    if (editingProduct) {
      onUpdateProduct(editingProduct.id, productPayload);
    } else {
      onAddProduct(productPayload);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج نهائياً من الكتالوج؟')) {
      onDeleteProduct(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#0099DD]" />
            <span>إدارة المنتجات والكتالوج ({products.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            سعر موحد للجميع ظاهر بدون تسجيل. المنتج يمكن ربطه بأكثر من تصنيف رئيسي (Many-to-Many).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو كود SKU..."
              className="w-full pl-3 pr-9 py-2 rounded-xl text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0099DD]"
            />
          </div>

          {/* Hidden CSV input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 whitespace-nowrap"
                title="تصدير بيانات المنتجات إلى ملف CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير CSV</span>
              </button>

              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 whitespace-nowrap"
                title="استيراد منتجات من ملف CSV"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>استيراد CSV</span>
              </button>

              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منتج</span>
              </button>
            </>
          )}

          {!isAdmin && (
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${
              currentRole === 'sales_agent'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {currentRole === 'sales_agent'
                  ? 'كتالوج المنتجات والأسعار المعتمدة'
                  : 'دليل الأصناف للتجهيز والمطابقة'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">المنتج</th>
                <th className="p-3.5">كود SKU</th>
                <th className="p-3.5">سعر البيع (ج.م)</th>
                {isAdmin && <th className="p-3.5">التكلفة والهامش</th>}
                <th className="p-3.5">التصنيفات المربوطة</th>
                <th className="p-3.5">مصفوفة التوافق</th>
                <th className="p-3.5">الحالة والخصائص</th>
                {isAdmin && <th className="p-3.5 text-center">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="text-center py-12 text-slate-400">
                    لا توجد منتجات مطابقة لعملية البحث.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const matrixSummary = calculateMatrixStockSummary(p.matrix_items);
                  const linkedCategories = categories.filter((c) => p.category_ids?.includes(c.id));

                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/70 transition ${!p.is_active ? 'opacity-50' : ''}`}>
                      {/* Product image & title */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <Image
                              src={p.image_url || '/logo.png'}
                              alt={p.title_ar}
                              fill
                              className="object-contain p-1"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{p.title_ar}</p>
                            {p.description_ar && (
                              <p className="text-[11px] text-slate-400 line-clamp-1">{p.description_ar}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-3.5 font-mono text-slate-600 font-bold">{p.sku}</td>

                      {/* Selling Price */}
                      <td className="p-3.5 font-extrabold text-[#0099DD] text-sm whitespace-nowrap">
                        {p.price.toFixed(2)} ج.م
                      </td>

                      {/* Cost Price & Margin (Admin Only) */}
                      {isAdmin && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-mono text-slate-700 font-bold text-xs">
                            {p.cost_price ? `${p.cost_price.toFixed(2)} ج.م` : '-'}
                          </div>
                          {p.cost_price && p.price > 0 ? (
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                              هامش: {(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%
                            </div>
                          ) : null}
                        </td>
                      )}

                      {/* Categories chips */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {linkedCategories.map((c) => (
                            <span
                              key={c.id}
                              className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200"
                            >
                              {c.name_ar}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Matrix info */}
                      <td className="p-3.5">
                        {p.has_compatibility_matrix ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Boxes className="w-3 h-3" />
                              <span>متوافق مع {p.matrix_items?.length || 0} موديل</span>
                            </span>
                            <div className="text-[10px] text-slate-400">
                              إجمالي المخزون: {matrixSummary.totalStock} قطعة
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">منتج فردي (بدون مصفوفة)</span>
                        )}
                      </td>

                      {/* Badges + is_active toggle */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Active toggle (admin only) */}
                          {isAdmin && onToggleActive && (
                            <button
                              type="button"
                              onClick={() => onToggleActive(p.id, !p.is_active)}
                              title={p.is_active ? 'إخفاء المنتج من الكتالوج' : 'إظهار المنتج في الكتالوج'}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                p.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {p.is_active ? 'مفعّل' : 'مخفي'}
                            </button>
                          )}
                          {p.is_exchange_only && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              قابل للاستبدال فقط
                            </span>
                          )}
                          {p.is_featured && (
                            <span className="bg-blue-50 text-[#0099DD] border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              مميز
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action buttons (Admin only) */}
                      {isAdmin && (
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenModal(p)}
                              className="p-1.5 rounded-lg bg-blue-50 text-[#0099DD] hover:bg-blue-100 border border-blue-200 transition"
                              title="تعديل المنتج"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للكتالوج'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">كود المنتج (SKU) *</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD] font-mono"
                  required
                />
              </div>

              {/* Price, Cost Price & Margin */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر البيع (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD] font-bold text-[#0099DD]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر التكلفة (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD] font-bold text-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">هامش الربح</label>
                  <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-emerald-700 text-center text-xs h-[38px] flex items-center justify-center">
                    {price > 0 && costPrice > 0 ? `${(((price - costPrice) / price) * 100).toFixed(1)}%` : '-'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان المنتج بالعربية *</label>
                <input
                  type="text"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: سكرين 3 ملى 5×1 - اميجو"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف المنتج</label>
                <textarea
                  value={descAr}
                  onChange={(e) => setDescAr(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD]"
                />
              </div>

              {/* Main Image with Supabase Storage Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة المنتج الرئيسية</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD] text-xs font-mono"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shrink-0"
                  >
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>رفع صورة</span>
                  </button>
                </div>
              </div>

              {/* Multiple Gallery Images */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">معرض الصور الإضافية (Gallery)</label>
                  <span className="text-[11px] text-slate-400 font-semibold">{galleryUrls.length} صور مضافة</span>
                </div>

                <input
                  type="file"
                  ref={galleryFileInputRef}
                  onChange={handleGalleryUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    placeholder="أدخل رابط صورة إضافية أو ارفع من جهازك..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newGalleryUrl.trim()) {
                        setGalleryUrls([...galleryUrls, newGalleryUrl.trim()]);
                        setNewGalleryUrl('');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300 shrink-0"
                  >
                    إضافة رابط
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={isUploadingGallery}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shrink-0"
                  >
                    {isUploadingGallery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>رفع صور</span>
                  </button>
                </div>
                {galleryUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {galleryUrls.map((url, idx) => (
                      <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white">
                        <Image src={url} alt={`gallery-${idx}`} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => setGalleryUrls(galleryUrls.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-rose-900/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-bold"
                          title="حذف الصورة"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories Many-to-Many */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ربط التصنيفات (يمكن اختيار أكثر من تصنيف رئيسي):
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 max-h-32 overflow-y-auto">
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                          isSelected
                            ? 'bg-[#0099DD] text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat.name_ar}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasMatrix}
                    onChange={(e) => setHasMatrix(e.target.checked)}
                    className="w-4 h-4 text-[#0099DD] rounded"
                  />
                  <span className="font-bold text-slate-700">مصفوفة توافق</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExchangeOnly}
                    onChange={(e) => setIsExchangeOnly(e.target.checked)}
                    className="w-4 h-4 text-[#0099DD] rounded"
                  />
                  <span className="font-bold text-slate-700">استبدال فقط</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 text-[#0099DD] rounded"
                  />
                  <span className="font-bold text-slate-700">منتج مميز</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white px-5 py-2 rounded-xl font-bold shadow-sm transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ المنتج</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
