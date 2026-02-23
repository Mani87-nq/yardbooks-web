/**
 * GET    /api/v1/fixed-assets/[id] — Get a single fixed asset with relations
 * PUT    /api/v1/fixed-assets/[id] — Update a fixed asset
 * DELETE /api/v1/fixed-assets/[id] — Soft delete (set status to DISPOSED)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

// ============================================
// GET — Single fixed asset
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const asset = await prisma.fixedAsset.findFirst({
      where: { id, companyId: companyId! },
      include: {
        category: { select: { id: true, code: true, name: true } },
        depreciationEntries: {
          orderBy: [{ fiscalYear: 'desc' }, { periodNumber: 'desc' }],
          take: 24, // Last 2 years of monthly entries
        },
        disposals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!asset) {
      return notFound('Fixed asset not found');
    }

    return NextResponse.json({ data: asset });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get fixed asset');
  }
}

// ============================================
// Validation schema for update
// ============================================

const updateAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  categoryId: z.string().optional(),
  assetTag: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),

  // Location & Assignment
  locationId: z.string().optional(),
  locationName: z.string().max(255).optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().max(255).optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().max(255).optional(),

  // Acquisition
  acquisitionDate: z.coerce.date().optional(),
  purchaseDate: z.coerce.date().optional(),
  acquisitionMethod: z.enum([
    'PURCHASE', 'LEASE_FINANCE', 'DONATION', 'CONSTRUCTION', 'TRANSFER', 'OPENING_BALANCE',
  ]).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().max(255).optional(),
  vendor: z.string().max(255).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.coerce.date().optional(),
  purchaseOrderNumber: z.string().max(100).optional(),

  // Cost
  purchaseCost: z.number().min(0).optional(),
  acquisitionCost: z.number().min(0).optional(),
  currency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).optional(),
  exchangeRate: z.number().positive().optional(),
  installationCost: z.number().min(0).optional(),
  freightCost: z.number().min(0).optional(),
  customsDuty: z.number().min(0).optional(),
  otherCapitalizedCosts: z.number().min(0).optional(),

  // Book Depreciation
  bookDepreciationMethod: z.enum([
    'STRAIGHT_LINE', 'REDUCING_BALANCE', 'UNITS_OF_PRODUCTION', 'NONE',
  ]).optional(),
  bookUsefulLifeMonths: z.number().int().positive().optional(),
  bookResidualValue: z.number().min(0).optional(),
  bookDepreciationStartDate: z.coerce.date().optional(),

  // Tax
  taxCapitalAllowanceClass: z.string().max(100).optional(),
  taxInitialAllowanceRate: z.number().min(0).max(1).optional(),
  taxAnnualAllowanceRate: z.number().min(0).max(1).optional(),

  // Status
  status: z.enum([
    'ACTIVE', 'IDLE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST', 'TRANSFERRED',
  ]).optional(),
  location: z.string().max(500).optional(),

  // Insurance & Warranty
  insuredValue: z.number().min(0).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
  insuranceExpiry: z.coerce.date().optional(),
  warrantyExpiry: z.coerce.date().optional(),
  warrantyProvider: z.string().max(255).optional(),

  // GL Account overrides
  assetGLAccountCode: z.string().max(20).optional(),
  accumulatedDepGLAccountCode: z.string().max(20).optional(),
  depreciationExpenseGLAccountCode: z.string().max(20).optional(),

  notes: z.string().max(5000).optional(),
});

// ============================================
// PUT — Update a fixed asset
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify asset exists and belongs to company
    const existing = await prisma.fixedAsset.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) {
      return notFound('Fixed asset not found');
    }

    // Validate body
    const body = await request.json();
    const parsed = updateAssetSchema.safeParse(body);
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

    // If categoryId is being changed, resolve category details
    let categoryUpdates: Record<string, unknown> = {};
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await prisma.assetCategory.findFirst({
        where: { id: data.categoryId, companyId: companyId! },
      });
      if (!category) {
        return badRequest('Asset category not found');
      }
      categoryUpdates = {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
      };
    }

    // Recalculate totals if cost fields changed
    const acquisitionCost = data.acquisitionCost ?? data.purchaseCost ?? Number(existing.acquisitionCost ?? 0);
    const installationCost = data.installationCost ?? Number(existing.installationCost ?? 0);
    const freightCost = data.freightCost ?? Number(existing.freightCost ?? 0);
    const customsDuty = data.customsDuty ?? Number(existing.customsDuty ?? 0);
    const otherCapitalizedCosts = data.otherCapitalizedCosts ?? Number(existing.otherCapitalizedCosts ?? 0);

    const hasCostChange = data.acquisitionCost != null || data.purchaseCost != null ||
      data.installationCost != null || data.freightCost != null ||
      data.customsDuty != null || data.otherCapitalizedCosts != null;

    let costUpdates: Record<string, unknown> = {};
    if (hasCostChange) {
      const totalCapitalizedCost = acquisitionCost + installationCost + freightCost + customsDuty + otherCapitalizedCosts;
      const rate = data.exchangeRate ?? Number(existing.exchangeRate);
      costUpdates = {
        totalCapitalizedCost,
        acquisitionCostJMD: acquisitionCost * rate,
      };
    }

    // Build the update payload — only include fields that were provided
    const { categoryId: _cat, ...updateFields } = data;

    const asset = await prisma.fixedAsset.update({
      where: { id },
      data: {
        ...updateFields,
        ...categoryUpdates,
        ...costUpdates,
        updatedBy: user!.sub,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({ data: asset });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update fixed asset');
  }
}

// ============================================
// DELETE — Soft delete (mark as disposed/inactive)
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify asset exists and belongs to company
    const existing = await prisma.fixedAsset.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) {
      return notFound('Fixed asset not found');
    }

    // Cannot delete an already disposed asset
    if (existing.status === 'DISPOSED') {
      return badRequest('Asset is already disposed');
    }

    // Soft delete: set status to DISPOSED and record who did it
    await prisma.fixedAsset.update({
      where: { id },
      data: {
        status: 'DISPOSED',
        updatedBy: user!.sub,
      },
    });

    return NextResponse.json({
      message: 'Fixed asset has been marked as disposed.',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete fixed asset');
  }
}
