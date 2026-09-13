'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { OrdersManager } from '@/components/admin/OrdersManager';

export default function AdminOrdersPage() {
  const { orders, staffSession, updateOrderStatus, assignCustomerSalesRep } = useStore();

  if (!staffSession) return null;

  return (
    <OrdersManager
      orders={orders}
      staffSession={staffSession}
      onUpdateOrderStatus={updateOrderStatus}
      onAssignSalesRep={assignCustomerSalesRep}
    />
  );
}
