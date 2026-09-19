'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CategoryTreeManager } from '@/components/admin/CategoryTreeManager';
import { canManageCategories } from '@/services/authService';

export default function AdminCategoriesPage() {
  const {
    categories,
    categoriesTree,
    products,
    staffSession,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useStore();

  if (!staffSession || !canManageCategories(staffSession.role, staffSession)) return null;

  return (
    <CategoryTreeManager
      categories={categories}
      categoriesTree={categoriesTree}
      products={products}
      currentRole={staffSession.role}
      staffProfile={staffSession}
      onAddCategory={addCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
    />
  );
}
