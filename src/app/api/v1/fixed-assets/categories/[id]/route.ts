/**
 * GET    /api/v1/fixed-assets/categories/[id] — Get a single asset category
 * PUT    /api/v1/fixed-assets/categories/[id] — Update an asset category
 * DELETE /api/v1/fixed-assets/categories/[id] — Delete an asset category
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, conflict, internalError } from '@/lib/api-error';
// ============================================
// GET — Single asset category
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const category = await prisma.assetCategory.findFirst({
      where: { id, companyId: companyId! },
      include: {
        _count: { select: { assets: true } },
      },
    });

    if (!category) {
      return notFound('Asset category not found');
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get asset category');
  }
}

// ============================================
// Validation schema for update
// ============================================

const updateCategorySchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),

  // GL Accounts
  assetGLAccountCode: z.string().min(1).max(20).optional(),
  accumulatedDepGLAccountCode: z.string().min(1).max(20).optional(),
  depreciationExpenseGLAccountCode: z.string().min(1).max(20).optional(),
  gainOnDisposalGLAccountCode: z.string().min(1).max(20).optional(),
  lossOnDisposalGLAccountCode: z.string().min(1).max(20).optional(),

  // Book depreciation defaults
  defaultBookMethod: z.enum([
    'STRAIGHT_LINE', 'REDUCING_BALANCE', 'UNITS_OF_PRODUCTION', 'NONE',
  ]).optional(),
  defaultBookUsefulLifeMonths: z.number().int().positive().optional(),
  defaultBookResidualValuePercent: z.number().min(0).max(100).optional(),

  // Jamaica Tax Capital Allowance
  taxCapitalAllowanceClass: z.string().min(1).max(100).optional(),
  taxInitialAllowanceRate: z.number().min(0).max(1).optional(),
  taxAnnualAllowanceRate: z.number().min(0).max(1).optional(),
  taxAllowanceYears: z.number().int().positive().optional(),

  // Cost cap
  hasCostCap: z.boolean().optional(),
  costCapAmount: z.number().min(0).optional(),
  costCapCurrency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).optional(),

  // Flags
  isActive: z.boolean().optional(),
  requiresSerialNumber: z.boolean().optional(),
  requiresInsurance: z.boolean().optional(),
});

// ============================================
// PUT — Update an asset category
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify category exists and belongs to company
    const existing = await prisma.assetCategory.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) {
      return notFound('Asset category not found');
    }

    // System categories cannot be modified
    if (existing.isSystemCategory) {
      return badRequest('System categories cannot be modified');
    }

    // Validate body
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const data = parsed.data;

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== existing.code) {
      const duplicateCode = await prisma.assetCategory.findFirst({
        where: { companyId: companyId!, code: data.code, id: { not: id } },
      });
      if (duplicateCode) {
        return conflict(`An asset category with code "${data.code}" already exists`);
      }
    }

    const category = await prisma.assetCategory.update({
      where: { id },
      data,
      include: {
        _count: { select: { assets: true } },
      },
    });

    return NextResponse.json({ data: category });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update asset category');
  }
}

// ============================================
// DELETE — Delete an asset category
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify category exists and belongs to company
    const existing = await prisma.assetCategory.findFirst({
      where: { id, companyId: companyId! },
      include: { _count: { select: { assets: true } } },
    });
    if (!existing) {
      return notFound('Asset category not found');
    }

    // Cannot delete system categories
    if (existing.isSystemCategory) {
      return badRequest('System categories cannot be deleted');
    }

    // Cannot delete a category that has assets
    if (existing._count.assets > 0) {
      return badRequest(
        `Cannot delete category "${existing.name}" because it has ${existing._count.assets} asset(s) assigned. Reassign or remove the assets first.`
      );
    }

    await prisma.assetCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      message: `Asset category "${existing.name}" has been deleted.`,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete asset category');
  }
}
