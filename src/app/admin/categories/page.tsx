'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CategoryTreeManager } from '@/components/admin/CategoryTreeManager';

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

  if (!staffSession || staffSession.role !== 'admin') return null;

  return (
    <CategoryTreeManager
      categories={categories}
      categoriesTree={categoriesTree}
      products={products}
      currentRole={staffSession.role}
      onAddCategory={addCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
    />
  );
}
