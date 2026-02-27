/**
 * Module-Scoped Permission Helper.
 *
 * Extends the core RBAC system (`@/lib/auth/rbac`) to support
 * module-namespaced permissions that follow the pattern:
 *
 *     {moduleId}:{entity}:{action}
 *
 * Example: "salon:appointments:create"
 *
 * Module permissions are registered at application startup by
 * importing each module's manifest and calling `registerModulePermissions()`.
 * After that, `checkModulePermission()` can be used in API routes
 * and server components.
 */
import {
  type Role,
  hasPermission as hasCorePermission,
} from '@/lib/auth/rbac';
import { moduleRegistry } from './registry';
import type { ModulePermission } from './types';

// ============================================
// MODULE PERMISSION REGISTRY
// ============================================

/**
 * Map of moduleId -> role -> Set<permission keys>
 * Built once at startup from module manifests.
 */
const modulePermissionMap = new Map<string, Map<Role, Set<string>>>();

/** Whether `initModulePermissions()` has been called. */
let initialized = false;

const ROLE_HIERARCHY: Role[] = ['READ_ONLY', 'STAFF', 'ACCOUNTANT', 'ADMIN', 'OWNER'];

/**
 * Build the module permission map from the registry.
 * Called once during application bootstrap.
 *
 * For each module, we walk the role hierarchy and accumulate
 * permissions so that higher roles inherit all permissions from
 * lower roles (mirroring the core RBAC behaviour).
 */
export function initModulePermissions(): void {
  if (initialized) return;

  const allModules = moduleRegistry.getAllModules();

  for (const manifest of allModules) {
    const roleMap = new Map<Role, Set<string>>();

    // Build a lookup: which roles each permission is assigned to by default
    const permsByRole = new Map<Role, string[]>();
    for (const role of ROLE_HIERARCHY) {
      permsByRole.set(role, []);
    }

    for (const perm of manifest.permissions) {
      for (const role of perm.defaultRoles) {
        permsByRole.get(role as Role)?.push(perm.key);
      }
    }

    // Walk the hierarchy and accumulate (inherit lower-role permissions)
    const accumulated = new Set<string>();
    for (const role of ROLE_HIERARCHY) {
      const rolePerms = permsByRole.get(role) ?? [];
      for (const p of rolePerms) {
        accumulated.add(p);
      }
      roleMap.set(role, new Set(accumulated));
    }

    modulePermissionMap.set(manifest.id, roleMap);
  }

  initialized = true;
}

// ============================================
// PERMISSION CHECKS
// ============================================

/**
 * Check whether a user (identified by their role) has a given
 * module permission.
 *
 * @param role     The user's role (from the JWT / CompanyMember).
 * @param moduleId The module that owns the permission.
 * @param permission  The full permission key (e.g. "salon:appointments:create").
 *
 * Returns `true` if the role has the permission, `false` otherwise.
 *
 * NOTE: This function assumes the module is already confirmed as active
 * for the company.  Module activation should be checked first using
 * `isModuleActive()` or `requireModule()`.
 */
export function checkModulePermission(
  role: Role,
  moduleId: string,
  permission: string
): boolean {
  // Ensure the permission map has been built
  if (!initialized) {
    initModulePermissions();
  }

  const roleMap = modulePermissionMap.get(moduleId);
  if (!roleMap) return false;

  const perms = roleMap.get(role);
  return perms?.has(permission) ?? false;
}

/**
 * Combined permission check: works for both core and module permissions.
 *
 * If the permission string contains exactly two colons (e.g. "salon:appointments:create"),
 * it is treated as a module permission.  Otherwise it falls through to
 * the core RBAC check.
 */
export function hasAnyPermission(
  role: Role,
  permission: string
): boolean {
  const parts = permission.split(':');

  // Module permission pattern: {moduleId}:{entity}:{action}
  if (parts.length === 3) {
    const [moduleId] = parts;
    return checkModulePermission(role, moduleId, permission);
  }

  // Fall through to core RBAC — cast is safe because core permissions
  // have exactly one colon (e.g. "invoices:create").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return hasCorePermission(role, permission as any);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Get all permissions for a specific module.
 * Useful for the admin permission editor UI.
 */
export function getModulePermissions(moduleId: string): ModulePermission[] {
  const manifest = moduleRegistry.getModule(moduleId);
  if (!manifest) return [];
  return manifest.permissions;
}

/**
 * Get all permissions that a given role has for a specific module.
 */
export function getRoleModulePermissions(
  role: Role,
  moduleId: string
): string[] {
  if (!initialized) {
    initModulePermissions();
  }

  const roleMap = modulePermissionMap.get(moduleId);
  if (!roleMap) return [];

  const perms = roleMap.get(role);
  return perms ? Array.from(perms) : [];
}
