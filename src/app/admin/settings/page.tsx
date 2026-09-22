'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { SettingsManager } from '@/components/admin/SettingsManager';
import { canManageSettings } from '@/services/authService';

export default function AdminSettingsPage() {
  const { staffSession, customRoles } = useStore();

  if (!staffSession || !canManageSettings(staffSession.role, staffSession, customRoles)) return null;

  return <SettingsManager currentRole={staffSession.role} staffProfile={staffSession} customRoles={customRoles} />;
}
