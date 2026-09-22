'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ProductManager } from '@/components/admin/ProductManager';

export default function AdminProductsPage() {
  const {
    products,
    categories,
    staffSession,
    customRoles,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
  } = useStore();

  if (!staffSession) return null;

  return (
    <ProductManager
      products={products}
      categories={categories}
      currentRole={staffSession.role}
      staffProfile={staffSession}
      customRoles={customRoles}
      onAddProduct={addProduct}
      onUpdateProduct={updateProduct}
      onDeleteProduct={deleteProduct}
      onToggleActive={toggleProductActive}
    />
  );
}
