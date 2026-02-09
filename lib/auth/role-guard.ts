import { getCurrentUser } from './session';
import { UserRole } from '@/lib/types';

/**
 * Server-side role guard for route protection
 * Use this in server components or server actions to enforce role-based access
 *
 * @example
 * ```
 * export default async function AdminPage() {
 *   await requireRole(['admin']);
 *   // ... rest of component
 * }
 * ```
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser();

  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Check if user has a specific role (for use in server components/actions)
 */
export async function checkRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export async function checkRoles(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();
  return user ? roles.includes(user.role) : false;
}
