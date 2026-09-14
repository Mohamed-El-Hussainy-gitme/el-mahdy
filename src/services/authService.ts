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

/**
 * Returns the list of permitted /admin routes for a given staff role.
 */
export function getAllowedAdminRoutes(role: UserRole | undefined): string[] {
  if (!role) return [];
  switch (role) {
    case 'admin':
      return [
        '/admin',
        '/admin/orders',
        '/admin/products',
        '/admin/categories',
        '/admin/matrix',
        '/admin/shortages',
        '/admin/customers',
        '/admin/staff',
        '/admin/settings',
      ];
    case 'sales_agent':
      return [
        '/admin',
        '/admin/orders',
        '/admin/customers',
        '/admin/products',
        '/admin/matrix',
        '/admin/shortages',
      ];
    case 'warehouse_preparer':
      return [
        '/admin/orders',
        '/admin/matrix',
        '/admin/products',
      ];
    default:
      return [];
  }
}

/**
 * Returns the default landing route for each role.
 */
export function getDefaultAdminRoute(role: UserRole | undefined): string {
  if (role === 'warehouse_preparer') return '/admin/orders';
  return '/admin';
}

/**
 * Checks whether a staff role is allowed to access a specific admin pathname.
 */
export function canAccessAdminRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const allowed = getAllowedAdminRoutes(role);
  // Match exact path or sub-routes (e.g. /admin/orders/[id])
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
