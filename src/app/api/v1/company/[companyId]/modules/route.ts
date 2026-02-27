/**
 * GET  /api/v1/company/[companyId]/modules — List active module IDs for a company
 * POST /api/v1/company/[companyId]/modules — Activate a module for a company
 * DELETE /api/v1/company/[companyId]/modules — Deactivate a module for a company
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { forbidden, badRequest, internalError } from '@/lib/api-error';

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
    const rows = await prisma.companyModule.findMany({
      where: { companyId, isActive: true },
      select: { moduleId: true },
    });

    return NextResponse.json({
      modules: rows.map((r: { moduleId: string }) => r.moduleId),
    });
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

    const row = await prisma.companyModule.upsert({
      where: { companyId_moduleId: { companyId, moduleId } },
      create: { companyId, moduleId, isActive: true },
      update: { isActive: true, deactivatedAt: null },
    });

    return NextResponse.json({ success: true, module: row });
  } catch (err) {
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

    await prisma.companyModule.updateMany({
      where: { companyId, moduleId },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[CompanyModules] DELETE error:', err);
    return internalError('Failed to deactivate module');
  }
}
