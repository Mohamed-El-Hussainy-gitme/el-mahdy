'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { OrdersManager } from '@/components/admin/OrdersManager';

export default function AdminOrdersPage() {
  const {
    orders,
    staffSession,
    products,
    masterModels,
    updateOrderStatus,
    updateOrderItems,
    assignCustomerSalesRep,
  } = useStore();

  if (!staffSession) return null;

  return (
    <OrdersManager
      orders={orders}
      staffSession={staffSession}
      products={products}
      masterModels={masterModels}
      onUpdateOrderStatus={updateOrderStatus}
      onUpdateOrderItems={updateOrderItems}
      onAssignSalesRep={assignCustomerSalesRep}
    />
  );
}
