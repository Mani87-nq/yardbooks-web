'use client';

/**
 * ModuleGate — conditionally renders children based on module activation.
 *
 * Similar to PermissionGate, but checks whether a module is active for
 * the current company instead of checking RBAC permissions.
 *
 * Usage:
 *   <ModuleGate moduleId="salon">
 *     <SalonDashboard />
 *   </ModuleGate>
 *
 *   <ModuleGate moduleId="salon" fallback={<ModuleUpgradePrompt moduleId="salon" />}>
 *     <SalonDashboard />
 *   </ModuleGate>
 */
import React from 'react';
import { useModuleStore } from '../store';

interface ModuleGateProps {
  /** The module ID to check activation for */
  moduleId: string;
  /** Content to render when the module is active */
  children: React.ReactNode;
  /** Optional fallback when the module is not active (defaults to null) */
  fallback?: React.ReactNode;
}

export function ModuleGate({ moduleId, children, fallback = null }: ModuleGateProps) {
  const isActive = useModuleStore((s) => s.isModuleActive(moduleId));
  const isLoaded = useModuleStore((s) => s.loaded);

  // While the module list is still loading, render nothing to avoid flicker
  if (!isLoaded) {
    return null;
  }

  if (!isActive) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
