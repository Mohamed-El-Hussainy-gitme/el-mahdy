'use client';

import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Layers,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  Folder,
  Smartphone,
  Zap,
  Battery,
  Sparkles,
  Box,
  Headphones,
  Tag,
  Cpu,
  Wrench,
  Shield,
  Check,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Category, Product, UserRole, UserProfile } from '@/types';
import { validateCategoryDeletion } from '@/services/categoryService';
import { canManageCategories } from '@/services/authService';
import { uploadImage } from '@/lib/storage';

const AVAILABLE_ICONS = [
  'Folder',
  'Smartphone',
  'Zap',
  'Battery',
  'Sparkles',
  'Box',
  'Headphones',
  'Tag',
  'Cpu',
  'Wrench',
  'Shield',
];

const renderCategoryIcon = (iconName?: string) => {
  switch (iconName) {
    case 'Smartphone':
      return <Smartphone className="w-4 h-4 text-[#0099DD]" />;
    case 'Zap':
      return <Zap className="w-4 h-4 text-amber-500" />;
    case 'Battery':
      return <Battery className="w-4 h-4 text-emerald-500" />;
    case 'Sparkles':
      return <Sparkles className="w-4 h-4 text-purple-500" />;
    case 'Box':
      return <Box className="w-4 h-4 text-blue-500" />;
    case 'Headphones':
      return <Headphones className="w-4 h-4 text-rose-500" />;
    case 'Tag':
      return <Tag className="w-4 h-4 text-sky-500" />;
    case 'Cpu':
      return <Cpu className="w-4 h-4 text-indigo-500" />;
    case 'Wrench':
      return <Wrench className="w-4 h-4 text-slate-600" />;
    case 'Shield':
      return <Shield className="w-4 h-4 text-emerald-600" />;
    default:
      return <Folder className="w-4 h-4 text-slate-500" />;
  }
};

interface CategoryTreeManagerProps {
  categories: Category[];
  categoriesTree: Category[];
  products?: Product[];
  currentRole: UserRole;
  staffProfile?: UserProfile | null;
  onAddCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => void | Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string) => { success: boolean; message?: string } | Promise<{ success: boolean; message?: string }>;
}

export const CategoryTreeManager: React.FC<CategoryTreeManagerProps> = ({
  categories,
  categoriesTree,
  products,
  currentRole,
  staffProfile,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [icon, setIcon] = useState('Folder');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isAdmin = canManageCategories(currentRole, staffProfile);

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (cat?: Category, defaultParentId?: string | null) => {
    if (cat) {
      setEditingCategory(cat);
      setNameAr(cat.name_ar);
      setSlug(cat.slug);
      setParentId(cat.parent_id || null);
      setIcon(cat.icon || 'Folder');
      setImageUrl(cat.image_url || '');
      setSortOrder(cat.sort_order || 1);
    } else {
      setEditingCategory(null);
      setNameAr('');
      setSlug('');
      setParentId(defaultParentId || null);
      setIcon('Folder');
      setImageUrl('');
      setSortOrder(categories.length + 1);
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const res = await uploadImage(file, 'categories');
    setIsUploading(false);
    if (res.url) {
      setImageUrl(res.url);
    } else {
      alert('فشل رفع صورة التصنيف: ' + (res.error || 'خطأ غير معروف'));
    }
  };

  const handleMove = (cat: Category, direction: 'up' | 'down') => {
    const current = cat.sort_order || 1;
    const newOrder = direction === 'up' ? Math.max(1, current - 1) : current + 1;
    onUpdateCategory(cat.id, { sort_order: newOrder });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;

    const finalSlug = slug.trim() || nameAr.trim().toLowerCase().replace(/\s+/g, '-');

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, {
        name_ar: nameAr.trim(),
        slug: finalSlug,
        parent_id: parentId,
        icon: icon,
        image_url: imageUrl.trim() ? imageUrl.trim() : null,
        sort_order: Number(sortOrder) || 1,
      });
    } else {
      onAddCategory({
        name_ar: nameAr.trim(),
        slug: finalSlug,
        parent_id: parentId,
        icon: icon,
        image_url: imageUrl.trim() ? imageUrl.trim() : undefined,
        sort_order: Number(sortOrder) || categories.length + 1,
        is_active: true,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const validation = validateCategoryDeletion(categories, id, products);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    const confirmMsg = validation.linkedProductsCount && validation.linkedProductsCount > 0
      ? `تنبيه: هذا التصنيف مرتبط به (${validation.linkedProductsCount}) منتج.\nحذف التصنيف سيفك ارتباط هذه المنتجات منه دون حذف المنتجات نفسها.\n\nهل أنت متأكد من حذف هذا التصنيف؟`
      : 'هل أنت متأكد من حذف هذا التصنيف نهائياً؟';

    if (confirm(confirmMsg)) {
      const res = await onDeleteCategory(id);
      if (!res.success && res.message) {
        alert(res.message);
      }
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: Category, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes[node.id];

    return (
      <div key={node.id} className="relative">
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition group ${
            depth === 0
              ? 'bg-white border-slate-200 shadow-sm font-bold text-slate-800'
              : depth === 1
              ? 'bg-slate-50/80 border-slate-200/80 font-medium text-slate-700 mr-6'
              : 'bg-slate-100/60 border-slate-200/60 text-slate-600 mr-12 text-sm'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="w-6 h-6 rounded-md hover:bg-slate-200/80 flex items-center justify-center text-slate-600 transition"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              </div>
            )}

            {/* Category Icon or Uploaded Image */}
            {node.image_url ? (
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                <img src={node.image_url} alt={node.name_ar} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                {renderCategoryIcon(node.icon)}
              </div>
            )}

            <span className="text-sm">{node.name_ar}</span>

            <span className="text-[11px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
              {node.slug}
            </span>

            {/* Sort Order Badge */}
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono" title="الترتيب اليدوي">
              ترتيب: {node.sort_order || 1}
            </span>

            {hasChildren && (
              <span className="text-[11px] font-bold text-[#0099DD] bg-[#0099DD]/10 px-2 py-0.5 rounded-full">
                {node.children!.length} تصنيف فرعي
              </span>
            )}
          </div>

          {/* Action buttons & Up/Down reordering (Admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
              {/* Up/Down Sort */}
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white ml-1">
                <button
                  type="button"
                  onClick={() => handleMove(node, 'up')}
                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                  title="تقديم في الترتيب (للأعلى)"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(node, 'down')}
                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition border-r border-slate-200"
                  title="تأخير في الترتيب (للأسفل)"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => handleOpenModal(undefined, node.id)}
                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 border border-emerald-200 transition"
                title="إضافة تصنيف فرعي داخل هذا التصنيف"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">فرعي</span>
              </button>
              <button
                onClick={() => handleOpenModal(node)}
                className="p-1.5 rounded-lg bg-blue-50 text-[#0099DD] hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition"
                title="تعديل التصنيف"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(node.id)}
                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold border border-rose-200 transition"
                title="حذف التصنيف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && !isCollapsed && (
          <div className="mt-1.5 space-y-1.5 border-r-2 border-slate-200 pr-2">
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-[#0099DD]" />
            <span>شجرة التصنيفات والترتيب اليدوي ({categories.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            بنية شجرية لانهائية، وأيقونات مخصصة، وإمكانية الترتيب اليدوي للتصنيفات في واجهة المتجر.
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-[#0099DD] hover:bg-[#007BB3] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تصنيف رئيسي</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200">
            <ShieldAlert className="w-4 h-4" />
            <span>عرض فقط (إدارة التصنيفات تتطلب صلاحية مدير النظام)</span>
          </div>
        )}
      </div>

      {/* Categories Tree Container */}
      <div className="space-y-2.5">
        {categoriesTree.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            لا توجد تصنيفات حالياً. اضغط &quot;إضافة تصنيف رئيسي&quot; للبدء.
          </div>
        ) : (
          categoriesTree.map((rootNode) => renderTreeNode(rootNode))
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم التصنيف (بالعربية) *</label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: شواحن سريع أو كابلات تايب سي"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0099DD]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المعرف اللطيف (Slug)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="fast-chargers"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الترتيب اليدوي (Sort Order)</label>
                  <input
                    type="number"
                    min="1"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">أيقونة التصنيف (Icon)</label>
                <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {AVAILABLE_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`h-9 rounded-lg flex items-center justify-center transition border ${
                        icon === ic
                          ? 'bg-[#0099DD] text-white border-[#0099DD] shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={ic}
                    >
                      {renderCategoryIcon(ic)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Image Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة التصنيف الفعلية (Category Image)</label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {imageUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0 shadow-sm">
                      <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow hover:bg-red-700 transition"
                        title="إزالة الصورة"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white shrink-0">
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                      <span className="text-[9px] mt-0.5">بدون صورة</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0099DD]" />
                          <span>جاري الرفع...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-[#0099DD]" />
                          <span>{imageUrl ? 'تغيير صورة التصنيف' : 'رفع صورة للتصنيف'}</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-400">
                      تظهر كصورة دائرية أو كارت للكتالوج بالواجهة وصفحة الكتالوجات (مستحسن: 600×600).
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التصنيف الأب (Parent Category)</label>
                <select
                  value={parentId || ''}
                  onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="">-- تصنيف رئيسي (بدون أب) --</option>
                  {categories
                    .filter((c) => !editingCategory || c.id !== editingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar} ({c.slug})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-[#0099DD] hover:bg-[#007BB3] text-white px-5 py-2 rounded-xl font-bold shadow-sm transition text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ التصنيف</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
};
