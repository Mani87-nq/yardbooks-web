/**
 * Module Registry — singleton that discovers, validates, and exposes
 * all registered module manifests.
 *
 * At build-time (or first import) the registry:
 *   1. Imports every manifest from src/modules/* /manifest.ts
 *   2. Validates the dependency graph (no circular or missing deps)
 *   3. Caches the result so subsequent calls are free
 *
 * Usage:
 *   import { moduleRegistry } from '@/modules/registry';
 *   const salon = moduleRegistry.getModule('salon');
 */
import type { ModuleId, ModuleManifest, ModuleNavItem, KioskNavItem, KioskHomeWidget } from './types';

// ── Static manifest imports ──────────────────────────────────
// When a new module is added, import its manifest here and add
// it to the MANIFESTS array.  A build-time codegen script
// (scripts/generate-registry.ts) can automate this in the future.
import { manifest as retailManifest } from './retail/manifest';
import { manifest as restaurantManifest } from './restaurant/manifest';
import { manifest as salonManifest } from './salon/manifest';

const MANIFESTS: ModuleManifest[] = [
  retailManifest,
  restaurantManifest,
  salonManifest,
];

// ── Plan hierarchy (lowest → highest) ────────────────────────
const PLAN_HIERARCHY = ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'] as const;

function planIndex(plan: string): number {
  const idx = (PLAN_HIERARCHY as readonly string[]).indexOf(plan);
  return idx === -1 ? 0 : idx;
}

// ============================================
// MODULE REGISTRY CLASS
// ============================================

export class ModuleRegistry {
  private modules: Map<string, ModuleManifest>;
  private validated = false;

  constructor(manifests: ModuleManifest[]) {
    this.modules = new Map();
    for (const manifest of manifests) {
      if (this.modules.has(manifest.id)) {
        throw new Error(
          `[ModuleRegistry] Duplicate module ID: "${manifest.id}". Each module must have a unique identifier.`
        );
      }
      this.modules.set(manifest.id, manifest);
    }
  }

  // ── Queries ──────────────────────────────────────────────────

  /**
   * Get a single module manifest by ID.
   * Returns `undefined` if the module is not registered.
   */
  getModule(id: ModuleId): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  /**
   * Return all registered module manifests.
   */
  getAllModules(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }

  /**
   * Return module IDs only.
   */
  getAllModuleIds(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Get modules whose `requiredPlan` is satisfied by the given plan.
   */
  getModulesForPlan(plan: string): ModuleManifest[] {
    const idx = planIndex(plan);
    return this.getAllModules().filter((m) => planIndex(m.requiredPlan) <= idx);
  }

  /**
   * Check whether a plan satisfies the requirements of a specific module.
   */
  isPlanSufficient(moduleId: string, plan: string): boolean {
    const mod = this.modules.get(moduleId);
    if (!mod) return false;
    return planIndex(plan) >= planIndex(mod.requiredPlan);
  }

  // ── Navigation ───────────────────────────────────────────────

  /**
   * Aggregate sidebar navigation items for the set of currently-active module IDs.
   * Used by the Sidebar component to render module-specific nav sections.
   */
  getModuleNavItems(activeModuleIds: string[]): Array<{
    moduleId: string;
    moduleName: string;
    moduleIcon: string;
    moduleColor: string;
    items: ModuleNavItem[];
  }> {
    return activeModuleIds
      .map((id) => {
        const mod = this.modules.get(id);
        if (!mod) return null;
        return {
          moduleId: id,
          moduleName: mod.name,
          moduleIcon: mod.icon,
          moduleColor: mod.color,
          items: mod.navigation,
        };
      })
      .filter(
        (v): v is NonNullable<typeof v> => v !== null
      );
  }

  // ── Kiosk Navigation ────────────────────────────────────────

  /**
   * Aggregate kiosk bottom-nav items for the set of currently-active module IDs.
   * Optionally filter by employee role.  Results are sorted by priority (ascending).
   *
   * Used by the KioskBottomNav component to render module-appropriate tabs.
   */
  getKioskNavItems(activeModuleIds: string[], employeeRole?: string): KioskNavItem[] {
    const items: KioskNavItem[] = [];

    for (const id of activeModuleIds) {
      const mod = this.modules.get(id);
      if (!mod?.kioskNavigation) continue;

      for (const item of mod.kioskNavigation) {
        // If the item restricts to specific roles, check the employee's role
        if (item.roles && employeeRole && !item.roles.includes(employeeRole as never)) {
          continue;
        }
        items.push(item);
      }
    }

    return items.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Aggregate kiosk home widgets for the set of currently-active module IDs.
   * Optionally filter by employee role.  Results are sorted by priority (ascending).
   *
   * Used by the kiosk home page to render module-appropriate dashboard cards.
   */
  getKioskHomeWidgets(activeModuleIds: string[], employeeRole?: string): KioskHomeWidget[] {
    const widgets: KioskHomeWidget[] = [];

    for (const id of activeModuleIds) {
      const mod = this.modules.get(id);
      if (!mod?.kioskHomeWidgets) continue;

      for (const widget of mod.kioskHomeWidgets) {
        if (widget.roles && employeeRole && !widget.roles.includes(employeeRole as never)) {
          continue;
        }
        widgets.push(widget);
      }
    }

    return widgets.sort((a, b) => a.priority - b.priority);
  }

  // ── Dependency Validation ────────────────────────────────────

  /**
   * Validate the dependency graph for all registered modules.
   *
   * Checks:
   *   1. Every dependency ID references a registered module
   *   2. No circular dependency chains exist
   *
   * Throws a descriptive Error on the first violation found.
   * Safe to call multiple times (result is cached after the first pass).
   */
  validateDependencyGraph(): void {
    if (this.validated) return;

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string, chain: string[]): void => {
      if (visited.has(id)) return;

      if (visiting.has(id)) {
        const cycle = [...chain, id].join(' -> ');
        throw new Error(
          `[ModuleRegistry] Circular dependency detected: ${cycle}`
        );
      }

      const mod = this.modules.get(id);
      if (!mod) {
        throw new Error(
          `[ModuleRegistry] Module "${chain[chain.length - 1]}" depends on unknown module "${id}".`
        );
      }

      visiting.add(id);

      for (const depId of mod.dependencies) {
        if (!this.modules.has(depId)) {
          throw new Error(
            `[ModuleRegistry] Module "${id}" depends on unknown module "${depId}".`
          );
        }
        visit(depId, [...chain, id]);
      }

      visiting.delete(id);
      visited.add(id);
    };

    for (const id of this.modules.keys()) {
      visit(id, []);
    }

    this.validated = true;
  }

  /**
   * Check whether all dependencies for a given module are present in
   * the supplied `activeModuleIds` list.  Used before activating a new module.
   */
  areDependenciesMet(moduleId: string, activeModuleIds: string[]): { met: boolean; missing: string[] } {
    const mod = this.modules.get(moduleId);
    if (!mod) return { met: false, missing: [moduleId] };

    const activeSet = new Set(activeModuleIds);
    const missing = mod.dependencies.filter((dep) => !activeSet.has(dep));

    return { met: missing.length === 0, missing };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/** Global module registry singleton. */
export const moduleRegistry = new ModuleRegistry(MANIFESTS);

// Validate dependency graph eagerly so build fails on invalid manifests.
moduleRegistry.validateDependencyGraph();
