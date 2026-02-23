'use client';

/**
 * usePermissions — Client-side RBAC hook for YaadBooks.
 *
 * Reads the current user's role from the Zustand store (set during hydration)
 * and provides helpers to check permissions, exactly matching the server-side
 * RBAC definitions in src/lib/auth/rbac.ts.
 *
 * Usage:
 *   const { can, canAny, canAll, role } = usePermissions();
 *   if (can('invoices:delete')) { ... }
 */

import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissions,
  compareRoles,
  type Role,
  type Permission,
} from '@/lib/auth/rbac';

export interface UsePermissionsReturn {
  /** The user's role in the active company */
  role: Role;
  /** Check if the user has a specific permission */
  can: (permission: Permission) => boolean;
  /** Check if the user has ANY of the listed permissions */
  canAny: (permissions: Permission[]) => boolean;
  /** Check if the user has ALL of the listed permissions */
  canAll: (permissions: Permission[]) => boolean;
  /** Get all permissions for the current role */
  permissions: Permission[];
  /** True if the user is at least the given role level */
  isAtLeast: (minimumRole: Role) => boolean;
  /** True if OWNER */
  isOwner: boolean;
  /** True if ADMIN or OWNER */
  isAdmin: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const userRole = useAppStore((s) => s.userRole);

  // Default to READ_ONLY if no role is set (safest fallback)
  const role: Role = (userRole as Role) || 'READ_ONLY';

  return useMemo(() => {
    const permissions = getPermissions(role);

    return {
      role,
      can: (permission: Permission) => hasPermission(role, permission),
      canAny: (perms: Permission[]) => hasAnyPermission(role, perms),
      canAll: (perms: Permission[]) => hasAllPermissions(role, perms),
      permissions,
      isAtLeast: (minimumRole: Role) => compareRoles(role, minimumRole) >= 0,
      isOwner: role === 'OWNER',
      isAdmin: role === 'OWNER' || role === 'ADMIN',
    };
  }, [role]);
}
