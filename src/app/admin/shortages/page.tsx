'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { ShortagesManager } from '@/components/admin/ShortagesManager';

export default function AdminShortagesPage() {
  const { shortages, staffSession, updateShortageStatus } = useStore();

  if (!staffSession || (staffSession.role !== 'admin' && staffSession.role !== 'sales_agent')) return null;

  return (
    <ShortagesManager
      shortages={shortages}
      currentRole={staffSession.role}
      onUpdateShortageStatus={updateShortageStatus}
    />
  );
}
