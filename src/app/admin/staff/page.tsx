'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { StaffManager } from '@/components/admin/StaffManager';

export default function AdminStaffPage() {
  const { staffSession } = useStore();

  if (!staffSession) return null;

  return <StaffManager currentRole={staffSession.role} />;
}
