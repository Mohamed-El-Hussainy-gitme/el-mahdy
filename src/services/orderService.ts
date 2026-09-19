import { Order, OrderItem, OrderStatus, UserProfile, UserRole } from '@/types';

/**
 * Validates whether an order status transition is permissible based on
 * the 4-stage lifecycle and the acting user's RBAC role.
 *
 * Lifecycle:
 * 1. pending -> preparation (Sales Agent / Admin confirms, inventory deducted)
 * 2. preparation -> shipping (Warehouse / Admin marks packed & dispatched)
 * 3. shipping -> delivered (Warehouse / Sales Agent / Admin marks delivered)
 * 4. shipping -> returned (Sales Agent / Admin marks returned)
 * Admin can transition or cancel at any stage.
 */
export function canTransitionOrder(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  role: UserRole,
  profile?: UserProfile | null
): { allowed: boolean; reason?: string } {
  if (fromStatus === toStatus) {
    return { allowed: false, reason: 'الطلب في هذه الحالة بالفعل.' };
  }

  // Admin or custom role with can_manage_orders has full override permissions
  if (role === 'admin' || profile?.custom_role?.can_manage_orders) {
    return { allowed: true };
  }

  // Sales Agent (or custom role with can_receive_customers) transitions
  if (role === 'sales_agent' || profile?.custom_role?.can_receive_customers) {
    if (fromStatus === 'pending' && (toStatus === 'preparation' || toStatus === 'returned')) {
      return { allowed: true };
    }
    if (fromStatus === 'shipping' && (toStatus === 'delivered' || toStatus === 'returned')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'المندوب متاح له تأكيد الطلب أو إلغاؤه أثناء المراجعة، أو إثبات التسليم/المرتجع عند الشحن.',
    };
  }

  // Warehouse Preparer transitions
  if (role === 'warehouse_preparer') {
    if (fromStatus === 'preparation' && toStatus === 'shipping') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'مسؤول المستودع متاح له نقل الطلب من التجهيز إلى الشحن فقط بعد اكتمال التحضير.',
    };
  }

  // Customer cannot transition orders
  return {
    allowed: false,
    reason: 'لا توجد صلاحيات لتعديل حالة الطلب.',
  };
}

/**
 * Filters visible orders according to RBAC role:
 * - Admin or custom role with can_manage_orders: Sees all orders.
 * - Sales Agent (or can_receive_customers): Sees orders where assigned or unassigned pending orders.
 * - Warehouse Preparer: Sees orders in 'preparation' or 'shipping' only.
 * - Customer: Sees their own orders only.
 */
export function filterOrdersForRole(orders: Order[], user: UserProfile): Order[] {
  if (user.role === 'admin' || user.custom_role?.can_manage_orders) {
    return orders;
  }

  if (user.role === 'sales_agent' || user.custom_role?.can_receive_customers) {
    return orders.filter(
      (order) => !order.sales_agent_id || order.sales_agent_id === user.id
    );
  }

  if (user.role === 'warehouse_preparer') {
    return orders.filter(
      (order) => order.status === 'preparation' || order.status === 'shipping'
    );
  }

  if (user.role === 'customer') {
    return orders.filter((order) => order.customer_id === user.id);
  }

  return [];
}

/**
 * Calculates total order sum.
 */
export function calculateOrderTotal(
  items: Array<Pick<OrderItem, 'unit_price' | 'quantity'>>
): number {
  return items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
}

/**
 * Returns Arabic badge display metadata for order statuses.
 */
export function getOrderStatusBadge(status: OrderStatus): {
  labelAr: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'pending':
      return {
        labelAr: 'قيد المراجعة',
        colorClass: 'text-amber-800',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
      };
    case 'preparation':
      return {
        labelAr: 'جاري التجهيز',
        colorClass: 'text-blue-800',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
      };
    case 'shipping':
      return {
        labelAr: 'تم الشحن',
        colorClass: 'text-purple-800',
        bgClass: 'bg-purple-50',
        borderClass: 'border-purple-200',
      };
    case 'delivered':
      return {
        labelAr: 'تم التسليم',
        colorClass: 'text-emerald-800',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
      };
    case 'returned':
      return {
        labelAr: 'مرتجع',
        colorClass: 'text-rose-800',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-200',
      };
    default:
      return {
        labelAr: status,
        colorClass: 'text-slate-700',
        bgClass: 'bg-slate-50',
        borderClass: 'border-slate-200',
      };
  }
}
