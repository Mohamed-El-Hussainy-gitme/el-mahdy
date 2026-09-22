'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ShortagesManager } from '@/components/admin/ShortagesManager';
import { canManageShortages } from '@/services/authService';

export default function AdminShortagesPage() {
  const { shortages, staffSession, updateShortageStatus, customRoles } = useStore();

  if (!staffSession || !canManageShortages(staffSession.role, staffSession, customRoles)) return null;

  return (
    <ShortagesManager
      shortages={shortages}
      currentRole={staffSession.role}
      staffProfile={staffSession}
      customRoles={customRoles}
      onUpdateShortageStatus={updateShortageStatus}
    />
  );
}
