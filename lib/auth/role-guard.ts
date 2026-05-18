import { getCurrentUser } from './session';
import { UserRole } from '@/lib/types';

/**
 * Role hierarchy helpers — use these instead of hardcoding role strings.
 */
export const STORE_ROLES: UserRole[] = ['store_admin', 'store_manager', 'call_admin', 'technician'];
export const STORE_WRITE_ROLES: UserRole[] = ['store_admin', 'call_admin', 'technician']; // roles that can mutate store data
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'store_admin'];
export const HQ_ROLES: UserRole[] = ['super_admin', 'manager']; // Admin panel access
export const TICKET_ROLES: UserRole[] = ['super_admin', 'store_admin', 'call_admin', 'technician'];

/**
 * Server-side role guard for route protection.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser();

  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Require the user to be a super_admin.
 */
export async function requireSuperAdmin() {
  return requireRole(['super_admin']);
}

export async function requireHQAccess() {
  return requireRole(['super_admin', 'manager']);
}

/**
 * Check if user has a specific role.
 */
export async function checkRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role;
}

/**
 * Check if user has any of the specified roles.
 */
export async function checkRoles(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? roles.includes(user.role) : false;
}
