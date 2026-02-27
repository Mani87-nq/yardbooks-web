/**
 * GET    /api/v1/company/[companyId]/modules — List active module IDs for a company
 * POST   /api/v1/company/[companyId]/modules — Activate a module for a company
 * DELETE /api/v1/company/[companyId]/modules — Deactivate a module for a company
 *
 * POST and DELETE delegate to the activation layer which handles
 * dependency validation, event bus lifecycle, and caching.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { forbidden, badRequest, internalError } from '@/lib/api-error';
import { getActiveModules, activateModule, deactivateModule } from '@/modules/activation';

// ─── GET: List active modules ────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { companyId } = await params;

  // Verify user belongs to this company
  if (!user!.companies.includes(companyId)) {
    return forbidden('Not a member of this company');
  }

  try {
    const modules = await getActiveModules(companyId);

    return NextResponse.json({ modules });
  } catch (err) {
    console.error('[CompanyModules] GET error:', err);
    return internalError('Failed to fetch active modules');
  }
}

// ─── POST: Activate a module ─────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { companyId } = await params;

  if (!user!.companies.includes(companyId)) {
    return forbidden('Not a member of this company');
  }

  // Only ADMIN and OWNER can activate modules
  if (!['ADMIN', 'OWNER'].includes(user!.role)) {
    return forbidden('Only admins can activate modules');
  }

  try {
    const body = await request.json();
    const moduleId = body.moduleId;

    if (!moduleId || typeof moduleId !== 'string') {
      return badRequest('moduleId is required');
    }

    await activateModule(companyId, moduleId);

    return NextResponse.json({ success: true, moduleId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to activate module';

    // The activation layer throws descriptive errors for known issues
    // (unknown module, missing dependencies) — surface them as 400s
    if (
      message.includes('Unknown module') ||
      message.includes('missing dependencies')
    ) {
      return badRequest(message);
    }

    console.error('[CompanyModules] POST error:', err);
    return internalError('Failed to activate module');
  }
}

// ─── DELETE: Deactivate a module ─────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const { companyId } = await params;

  if (!user!.companies.includes(companyId)) {
    return forbidden('Not a member of this company');
  }

  if (!['ADMIN', 'OWNER'].includes(user!.role)) {
    return forbidden('Only admins can deactivate modules');
  }

  try {
    const body = await request.json();
    const moduleId = body.moduleId;

    if (!moduleId || typeof moduleId !== 'string') {
      return badRequest('moduleId is required');
    }

    await deactivateModule(companyId, moduleId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to deactivate module';

    // The deactivation layer throws if another module depends on this one
    if (message.includes('Cannot deactivate module')) {
      return badRequest(message);
    }

    console.error('[CompanyModules] DELETE error:', err);
    return internalError('Failed to deactivate module');
  }
}
