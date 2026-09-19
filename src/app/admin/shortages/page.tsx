'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ShortagesManager } from '@/components/admin/ShortagesManager';
import { canManageShortages } from '@/services/authService';

export default function AdminShortagesPage() {
  const { shortages, staffSession, updateShortageStatus } = useStore();

  if (!staffSession || !canManageShortages(staffSession.role, staffSession)) return null;

  return (
    <ShortagesManager
      shortages={shortages}
      currentRole={staffSession.role}
      staffProfile={staffSession}
      onUpdateShortageStatus={updateShortageStatus}
    />
  );
}
