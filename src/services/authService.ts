import { UserRole } from '@/types';

/**
 * Checks if the given role matches any of the allowed roles.
 */
export function hasRole(currentRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole);
}

/**
 * Determines whether user can access the Admin/ERP dashboard.
 * Only staff (admin, sales_agent, warehouse_preparer) are allowed.
 * Customers have zero access to the ERP dashboard.
 */
export function canViewDashboard(role: UserRole | undefined): boolean {
  return hasRole(role, ['admin', 'sales_agent', 'warehouse_preparer']);
}

/**
 * Category management permissions (Admin only).
 */
export function canManageCategories(role: UserRole | undefined): boolean {
  return hasRole(role, ['admin']);
}

/**
 * Product catalog management permissions (Admin only).
 */
export function canManageProducts(role: UserRole | undefined): boolean {
  return hasRole(role, ['admin']);
}

/**
 * Compatibility matrix and stock modification permissions (Admin only).
 */
export function canManageMatrix(role: UserRole | undefined): boolean {
  return hasRole(role, ['admin']);
}

/**
 * Shortage logging review permissions (Admin and Sales Agent can view).
 */
export function canManageShortages(role: UserRole | undefined): boolean {
  return hasRole(role, ['admin', 'sales_agent']);
}

/**
 * Returns user-friendly Arabic role title.
 */
export function getRoleTitleAr(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'مدير النظام (Admin)';
    case 'sales_agent':
      return 'مندوب مبيعات معتمد (Sales Agent)';
    case 'warehouse_preparer':
      return 'مسؤول المستودع والتجهيز (Warehouse)';
    case 'customer':
      return 'عميل تجاري (Customer)';
    default:
      return role;
  }
}
