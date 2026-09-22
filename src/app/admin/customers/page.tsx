'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { CustomerManager } from '@/components/admin/CustomerManager';
import { canManageCustomers } from '@/services/authService';

export default function AdminCustomersPage() {
  const { staffSession, customRoles } = useStore();

  if (
    !staffSession ||
    (!canManageCustomers(staffSession.role, staffSession, customRoles) &&
      !staffSession.custom_role?.can_receive_customers)
  ) {
    return null;
  }

  return <CustomerManager currentRole={staffSession.role} staffProfile={staffSession} customRoles={customRoles} />;
}
