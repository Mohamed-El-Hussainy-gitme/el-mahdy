'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ShortagesManager } from '@/components/admin/ShortagesManager';

export default function AdminShortagesPage() {
  const { shortages, staffSession, updateShortageStatus } = useStore();

  if (!staffSession) return null;

  return (
    <ShortagesManager
      shortages={shortages}
      currentRole={staffSession.role}
      onUpdateShortageStatus={updateShortageStatus}
    />
  );
}
