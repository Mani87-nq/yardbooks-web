/**
 * Module Activation System.
 *
 * Manages per-company module activation state using the CompanyModule
 * database table.  Server-side code calls these functions to check
 * whether a module is active, and to activate / deactivate modules.
 *
 * Results are cached per-request via an in-memory Map to avoid
 * repeated database round-trips within a single API handler.
 */
import { prisma } from '@/lib/db';
import { moduleRegistry } from './registry';
import { eventBus } from './event-bus';

// ============================================
// REQUEST-SCOPED CACHE
// ============================================

/**
 * In-memory cache keyed by companyId.
 * Stores the Set of active module IDs fetched during this request.
 *
 * IMPORTANT: Call `clearActivationCache()` at the beginning of each
 * request (e.g. in middleware) to prevent stale data from a previous
 * invocation when running under a long-lived server process.
 */
const cache = new Map<string, Set<string>>();

/**
 * Clear the per-request activation cache.
 * Should be called at the start of every incoming request.
 */
export function clearActivationCache(): void {
  cache.clear();
}

// ============================================
// QUERIES
// ============================================

/**
 * Fetch active module IDs for a company from the database and populate
 * the request cache.
 */
async function loadActiveModules(companyId: string): Promise<Set<string>> {
  if (cache.has(companyId)) {
    return cache.get(companyId)!;
  }

  const rows: Array<{ moduleId: string }> = await prisma.companyModule.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: { moduleId: true },
  });

  const moduleIds = new Set<string>(rows.map((r) => r.moduleId));
  cache.set(companyId, moduleIds);
  return moduleIds;
}

/**
 * Check if a specific module is active for a company.
 * Uses the per-request cache to avoid repeated DB queries.
 */
export async function isModuleActive(
  companyId: string,
  moduleId: string
): Promise<boolean> {
  const active = await loadActiveModules(companyId);
  return active.has(moduleId);
}

/**
 * Return all active module IDs for a company.
 */
export async function getActiveModules(
  companyId: string
): Promise<string[]> {
  const active = await loadActiveModules(companyId);
  return Array.from(active);
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Activate a module for a company.
 *
 * Pre-checks:
 *   1. The module exists in the registry.
 *   2. All module dependencies are already active for this company.
 *
 * On success:
 *   - Creates or updates the CompanyModule row (upsert).
 *   - Emits `module.activated` via the event bus.
 *   - Invalidates the request cache for this company.
 */
export async function activateModule(
  companyId: string,
  moduleId: string
): Promise<void> {
  // 0. Clear stale cache before doing anything
  clearActivationCache();

  // 1. Validate module exists
  const manifest = moduleRegistry.getModule(moduleId);
  if (!manifest) {
    throw new Error(`Unknown module: "${moduleId}"`);
  }

  // 2. Validate dependencies
  const currentActive = await getActiveModules(companyId);
  const { met, missing } = moduleRegistry.areDependenciesMet(moduleId, currentActive);
  if (!met) {
    throw new Error(
      `Cannot activate module "${moduleId}": missing dependencies [${missing.join(', ')}].`
    );
  }

  // 3. Upsert CompanyModule
  await prisma.companyModule.upsert({
    where: {
      companyId_moduleId: { companyId, moduleId },
    },
    create: {
      companyId,
      moduleId,
      isActive: true,
      activatedAt: new Date(),
      settings: {},
    },
    update: {
      isActive: true,
      activatedAt: new Date(),
      deactivatedAt: null,
    },
  });

  // 4. Invalidate cache
  cache.delete(companyId);

  // 5. Emit lifecycle event
  await eventBus.emit('module.activated', { moduleId, companyId });

  // 6. Flush any queued async event handlers so they execute
  //    before the response is sent back to the client.
  await eventBus.flush();
}

/**
 * Deactivate a module for a company.
 *
 * Pre-checks:
 *   - No other active module depends on this one.
 *
 * The CompanyModule row is NOT deleted — it is soft-disabled so that
 * configuration and data are preserved for potential re-activation.
 */
export async function deactivateModule(
  companyId: string,
  moduleId: string
): Promise<void> {
  // Clear stale cache before doing anything
  clearActivationCache();

  // Check that no other active module depends on this one
  const currentActive = await getActiveModules(companyId);
  const allModules = moduleRegistry.getAllModules();

  for (const mod of allModules) {
    if (
      mod.id !== moduleId &&
      currentActive.includes(mod.id) &&
      mod.dependencies.includes(moduleId)
    ) {
      throw new Error(
        `Cannot deactivate module "${moduleId}": module "${mod.id}" depends on it.`
      );
    }
  }

  // Soft-disable
  await prisma.companyModule.updateMany({
    where: { companyId, moduleId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  });

  // Invalidate cache
  cache.delete(companyId);

  // Remove event handlers from this module
  eventBus.removeModule(moduleId);

  // Emit lifecycle event
  await eventBus.emit('module.deactivated', { moduleId, companyId });

  // Flush any queued async event handlers so they execute
  // before the response is sent back to the client.
  await eventBus.flush();
}
