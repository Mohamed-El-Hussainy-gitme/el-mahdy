import { UserRole, UserProfile, CustomRole } from '@/types';

/**
 * Checks if the given role matches any of the allowed roles.
 */
export function hasRole(currentRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole);
}

/**
 * Helper to dynamically resolve CustomRole object from profile or available customRoles list.
 */
export function resolveCustomRole(profile?: UserProfile | null, customRoles?: CustomRole[]): CustomRole | undefined {
  if (!profile) return undefined;
  if (profile.custom_role) return profile.custom_role;
  if (customRoles && customRoles.length > 0) {
    if (profile.custom_role_id) {
      const match = customRoles.find((r) => r.id === profile.custom_role_id);
      if (match) return match;
    }
    if (profile.custom_role_name) {
      const match = customRoles.find((r) => r.name_ar === profile.custom_role_name);
      if (match) return match;
    }
  }
  return undefined;
}

/**
 * Determines whether user can access the Admin/ERP dashboard.
 * Staff (admin, sales_agent, warehouse_preparer, or any custom staff role) are allowed.
 * Customers have zero access to the ERP dashboard.
 */
export function canViewDashboard(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'customer' || profile?.role === 'customer') return false;
  if (hasRole(role, ['admin', 'sales_agent', 'warehouse_preparer'])) return true;
  if (profile?.role && hasRole(profile.role, ['admin', 'sales_agent', 'warehouse_preparer'])) return true;
  if (profile?.custom_role_id || profile?.custom_role_name) return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr) return true;
  return false;
}

/**
 * Category management permissions (Admin or custom role with can_manage_categories).
 */
export function canManageCategories(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_categories) return true;
  if ((profile as any)?.can_manage_categories === true) return true;
  return false;
}

/**
 * Product catalog management permissions (Admin or custom role with can_manage_products).
 */
export function canManageProducts(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_products) return true;
  if ((profile as any)?.can_manage_products === true) return true;
  return false;
}

/**
 * Compatibility matrix and stock modification permissions.
 */
export function canManageMatrix(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  if (role === 'warehouse_preparer' || profile?.role === 'warehouse_preparer') return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_matrix) return true;
  if ((profile as any)?.can_manage_matrix === true) return true;
  return false;
}

/**
 * Shortage logging review permissions.
 */
export function canManageShortages(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  if (hasRole(role, ['sales_agent']) || hasRole(profile?.role, ['sales_agent'])) return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_shortages) return true;
  if ((profile as any)?.can_manage_shortages === true) return true;
  return false;
}

/**
 * Orders management and processing permissions.
 */
export function canManageOrders(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  if (hasRole(role, ['sales_agent', 'warehouse_preparer']) || hasRole(profile?.role, ['sales_agent', 'warehouse_preparer'])) return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_orders || cr?.can_receive_customers) return true;
  if ((profile as any)?.can_manage_orders === true) return true;
  return false;
}

/**
 * Customer management permissions.
 */
export function canManageCustomers(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  if (hasRole(role, ['sales_agent']) || hasRole(profile?.role, ['sales_agent'])) return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_customers || cr?.can_receive_customers) return true;
  if ((profile as any)?.can_manage_customers === true) return true;
  return false;
}

/**
 * Store settings permissions.
 */
export function canManageSettings(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (role === 'admin' || profile?.role === 'admin') return true;
  const cr = resolveCustomRole(profile, customRoles);
  if (cr?.can_manage_settings) return true;
  if ((profile as any)?.can_manage_settings === true) return true;
  return false;
}

/**
 * Returns user-friendly Arabic role title.
 */
export function getRoleTitleAr(role: UserRole, profile?: UserProfile | null): string {
  if (profile?.custom_role_name) {
    return `${profile.custom_role_name} (مخصص)`;
  }
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
      return profile?.custom_role_name || role;
  }
}

/**
 * Returns the list of permitted /admin routes for a given staff role or custom role.
 */
export function getAllowedAdminRoutes(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): string[] {
  if (!role && !profile?.role) return [];
  const effectiveRole = role || profile?.role;
  if (effectiveRole === 'admin') {
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
  }

  // If custom role permissions are resolved
  const cr = resolveCustomRole(profile, customRoles);
  if (cr) {
    const routes = ['/admin'];
    if (cr.can_manage_orders || cr.can_receive_customers) routes.push('/admin/orders');
    if (cr.can_manage_products) routes.push('/admin/products');
    if (cr.can_manage_categories) routes.push('/admin/categories');
    if (cr.can_manage_matrix) routes.push('/admin/matrix');
    if (cr.can_manage_customers || cr.can_receive_customers) routes.push('/admin/customers');
    if (cr.can_manage_shortages) routes.push('/admin/shortages');
    if (cr.can_manage_settings) routes.push('/admin/settings');
    return routes;
  }

  // System roles fallback
  switch (effectiveRole) {
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
export function getDefaultAdminRoute(role: UserRole | undefined, profile?: UserProfile | null, customRoles?: CustomRole[]): string {
  const routes = getAllowedAdminRoutes(role, profile, customRoles);
  if (routes.includes('/admin')) return '/admin';
  return routes[0] || '/admin/orders';
}

/**
 * Checks whether a staff role is allowed to access a specific admin pathname.
 */
export function canAccessAdminRoute(role: UserRole | undefined, pathname: string, profile?: UserProfile | null, customRoles?: CustomRole[]): boolean {
  if (!role && !profile?.role) return false;
  const effectiveRole = role || profile?.role;
  if (effectiveRole === 'admin') return true;
  const allowed = getAllowedAdminRoutes(effectiveRole, profile, customRoles);
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

