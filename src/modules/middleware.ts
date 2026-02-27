/**
 * Module API route middleware.
 *
 * Provides a `requireModule()` helper that follows the same pattern as
 * `requireAuth` / `requirePermission` / `requireCompany` in
 * `@/lib/auth/middleware`.
 *
 * Usage in an API route:
 *
 *   import { requireAuth, requireCompany } from '@/lib/auth/middleware';
 *   import { requireModule } from '@/modules/middleware';
 *
 *   export async function GET(request: NextRequest) {
 *     const { user, error: authErr } = await requireAuth(request);
 *     if (authErr) return authErr;
 *
 *     const { companyId, error: compErr } = requireCompany(user!);
 *     if (compErr) return compErr;
 *
 *     const { error: modErr } = await requireModule(companyId!, 'salon');
 *     if (modErr) return modErr;
 *
 *     // ... module-specific logic ...
 *   }
 */
import { NextResponse } from 'next/server';
import { isModuleActive } from './activation';
import { moduleRegistry } from './registry';

interface RequireModuleResult {
  active: boolean;
  error: NextResponse | null;
}

/**
 * Express-style middleware check: verifies the requested module is
 * activated for the given company.
 *
 * Returns `{ active: true, error: null }` on success.
 * Returns `{ active: false, error: NextResponse }` with a 404 JSON
 * body if the module is not active (follows the existing RFC 7807
 * pattern from `@/lib/api-error`).
 */
export async function requireModule(
  companyId: string,
  moduleId: string
): Promise<RequireModuleResult> {
  // Quick check: does the module even exist in the registry?
  const manifest = moduleRegistry.getModule(moduleId);
  if (!manifest) {
    return {
      active: false,
      error: NextResponse.json(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: `Module "${moduleId}" does not exist.`,
        },
        { status: 404 }
      ),
    };
  }

  const active = await isModuleActive(companyId, moduleId);

  if (!active) {
    return {
      active: false,
      error: NextResponse.json(
        {
          type: 'module_not_active',
          title: 'Module not available',
          status: 404,
          detail: `The ${manifest.name} module is not activated for your company.`,
        },
        { status: 404 }
      ),
    };
  }

  return { active: true, error: null };
}

/**
 * Higher-order function that creates a pre-bound module check.
 * Useful when building module-specific route files:
 *
 *   const checkSalon = createModuleGuard('salon');
 *
 *   export async function GET(req, ctx) {
 *     const { error } = await checkSalon(companyId);
 *     if (error) return error;
 *     // ...
 *   }
 */
export function createModuleGuard(moduleId: string) {
  return async (companyId: string): Promise<RequireModuleResult> => {
    return requireModule(companyId, moduleId);
  };
}
