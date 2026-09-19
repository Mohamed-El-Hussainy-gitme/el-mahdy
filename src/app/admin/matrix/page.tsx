'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CompatibilityMatrixManager } from '@/components/admin/CompatibilityMatrixManager';
import { canManageMatrix } from '@/services/authService';

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

  if (!staffSession || (!canManageMatrix(staffSession.role, staffSession) && staffSession.role !== 'warehouse_preparer')) return null;

  return (
    <CompatibilityMatrixManager
      products={products}
      masterModels={masterModels}
      currentRole={staffSession.role}
      staffProfile={staffSession}
      onAddModelToMatrix={addModelToMatrix}
      onBulkAddModelToMatrix={bulkAddModelsToMatrix}
      onUpdateMatrixItem={updateMatrixItem}
      onDeleteMatrixItem={deleteMatrixItem}
      onAddMasterModel={addMasterModel}
      onDeleteMasterModel={deleteMasterModel}
    />
  );
}
