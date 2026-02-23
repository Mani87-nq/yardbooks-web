/**
 * GET /api/v1/fixed-assets/[id]/depreciation — List depreciation entries for a single asset
 *
 * Supports pagination and optional fiscalYear filter.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

// ============================================
// GET — List depreciation entries for an asset
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;

    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify asset exists and belongs to company
    const asset = await prisma.fixedAsset.findFirst({
      where: { id: assetId, companyId: companyId! },
      select: { id: true },
    });
    if (!asset) {
      return notFound('Fixed asset not found');
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    // Optional fiscal year filter
    const fiscalYearParam = searchParams.get('fiscalYear');
    let fiscalYear: number | undefined;
    if (fiscalYearParam) {
      fiscalYear = parseInt(fiscalYearParam);
      if (isNaN(fiscalYear) || fiscalYear < 1900 || fiscalYear > 2100) {
        return badRequest('Invalid fiscal year');
      }
    }

    // Optional status filter
    const statusParam = searchParams.get('status');
    const validStatuses = ['DRAFT', 'POSTED', 'REVERSED'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid depreciation entry status');
    }

    const where = {
      assetId,
      companyId: companyId!,
      ...(fiscalYear ? { fiscalYear } : {}),
      ...(status ? { status } : {}),
    };

    const entries = await prisma.fixedAssetDepreciationEntry.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ fiscalYear: 'asc' }, { periodNumber: 'asc' }],
    });

    const hasMore = entries.length > limit;
    const data = hasMore ? entries.slice(0, limit) : entries;

    // Calculate summary totals for the returned entries
    const totalBookDepreciation = data.reduce(
      (sum, e) => sum + Number(e.bookDepreciationAmount), 0
    );
    const totalTaxAllowance = data.reduce(
      (sum, e) => sum + Number(e.taxAllowanceAmount), 0
    );

    return NextResponse.json({
      data,
      summary: {
        totalBookDepreciation,
        totalTaxAllowance,
        entryCount: data.length,
      },
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list depreciation entries');
  }
}
