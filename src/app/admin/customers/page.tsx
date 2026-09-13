'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CustomerManager } from '@/components/admin/CustomerManager';

export default function AdminCustomersPage() {
  const { staffSession } = useStore();

  if (!staffSession) return null;

  return <CustomerManager currentRole={staffSession.role} />;
}
