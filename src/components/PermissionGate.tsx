'use client';

/**
 * PermissionGate — conditionally renders children based on RBAC permissions.
 *
 * Usage:
 *   <PermissionGate permission="invoices:delete">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={['invoices:create', 'invoices:update']}>
 *     <EditForm />
 *   </PermissionGate>
 *
 *   <PermissionGate permission="payroll:approve" fallback={<UpgradeNotice />}>
 *     <ApproveButton />
 *   </PermissionGate>
 */
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/auth/rbac';

interface PermissionGateProps {
  /** Single permission to check */
  permission?: Permission;
  /** Show if user has ANY of these permissions */
  anyOf?: Permission[];
  /** Show if user has ALL of these permissions */
  allOf?: Permission[];
  /** Content to render when permission is granted */
  children: React.ReactNode;
  /** Optional fallback when permission is denied */
  fallback?: React.ReactNode;
}

export function PermissionGate({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermissions();

  let allowed = true;

  if (permission) {
    allowed = can(permission);
  } else if (anyOf) {
    allowed = canAny(anyOf);
  } else if (allOf) {
    allowed = canAll(allOf);
  }

  return <>{allowed ? children : fallback}</>;
}
