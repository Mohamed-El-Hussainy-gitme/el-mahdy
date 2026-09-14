'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { SettingsManager } from '@/components/admin/SettingsManager';

export default function AdminSettingsPage() {
  const { staffSession } = useStore();

  if (!staffSession || staffSession.role !== 'admin') return null;

  return <SettingsManager currentRole={staffSession.role} />;
}
