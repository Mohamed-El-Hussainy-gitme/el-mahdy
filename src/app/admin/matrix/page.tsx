'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CompatibilityMatrixManager } from '@/components/admin/CompatibilityMatrixManager';

export default function AdminMatrixPage() {
  const {
    products,
    masterModels,
    staffSession,
    addModelToMatrix,
    bulkAddModelsToMatrix,
    updateMatrixItem,
    deleteMatrixItem,
    addMasterModel,
    deleteMasterModel,
  } = useStore();

  if (!staffSession) return null;

  return (
    <CompatibilityMatrixManager
      products={products}
      masterModels={masterModels}
      currentRole={staffSession.role}
      onAddModelToMatrix={addModelToMatrix}
      onBulkAddModelToMatrix={bulkAddModelsToMatrix}
      onUpdateMatrixItem={updateMatrixItem}
      onDeleteMatrixItem={deleteMatrixItem}
      onAddMasterModel={addMasterModel}
      onDeleteMasterModel={deleteMasterModel}
    />
  );
}
