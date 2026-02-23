/**
 * GET  /api/v1/fixed-assets/categories — List asset categories (company-scoped)
 * POST /api/v1/fixed-assets/categories — Create a new asset category
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, conflict, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

// ============================================
// GET — List asset categories
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // default true

    const categories = await prisma.assetCategory.findMany({
      where: {
        companyId: companyId!,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        _count: { select: { assets: true } },
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list asset categories');
  }
}

// ============================================
// Validation schema
// ============================================

const createCategorySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),

  // GL Accounts
  assetGLAccountCode: z.string().min(1).max(20),
  accumulatedDepGLAccountCode: z.string().min(1).max(20),
  depreciationExpenseGLAccountCode: z.string().min(1).max(20),
  gainOnDisposalGLAccountCode: z.string().min(1).max(20),
  lossOnDisposalGLAccountCode: z.string().min(1).max(20),

  // Book depreciation defaults
  defaultBookMethod: z.enum([
    'STRAIGHT_LINE', 'REDUCING_BALANCE', 'UNITS_OF_PRODUCTION', 'NONE',
  ]).default('STRAIGHT_LINE'),
  defaultBookUsefulLifeMonths: z.number().int().positive(),
  defaultBookResidualValuePercent: z.number().min(0).max(100),

  // Jamaica Tax Capital Allowance
  taxCapitalAllowanceClass: z.string().min(1).max(100),
  taxInitialAllowanceRate: z.number().min(0).max(1),
  taxAnnualAllowanceRate: z.number().min(0).max(1),
  taxAllowanceYears: z.number().int().positive(),

  // Cost cap
  hasCostCap: z.boolean().default(false),
  costCapAmount: z.number().min(0).optional(),
  costCapCurrency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).optional(),

  // Flags
  isActive: z.boolean().default(true),
  requiresSerialNumber: z.boolean().default(false),
  requiresInsurance: z.boolean().default(false),
});

// ============================================
// POST — Create a new asset category
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Plan gate
    const { error: planError } = await requireFeature(request, 'fixed_assets');
    if (planError) return planError;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
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

    // Check for duplicate code within company
    const existingCode = await prisma.assetCategory.findFirst({
      where: { companyId: companyId!, code: data.code },
    });
    if (existingCode) {
      return conflict(`An asset category with code "${data.code}" already exists`);
    }

    const category = await prisma.assetCategory.create({
      data: {
        companyId: companyId!,
        code: data.code,
        name: data.name,
        description: data.description || null,
        assetGLAccountCode: data.assetGLAccountCode,
        accumulatedDepGLAccountCode: data.accumulatedDepGLAccountCode,
        depreciationExpenseGLAccountCode: data.depreciationExpenseGLAccountCode,
        gainOnDisposalGLAccountCode: data.gainOnDisposalGLAccountCode,
        lossOnDisposalGLAccountCode: data.lossOnDisposalGLAccountCode,
        defaultBookMethod: data.defaultBookMethod,
        defaultBookUsefulLifeMonths: data.defaultBookUsefulLifeMonths,
        defaultBookResidualValuePercent: data.defaultBookResidualValuePercent,
        taxCapitalAllowanceClass: data.taxCapitalAllowanceClass,
        taxInitialAllowanceRate: data.taxInitialAllowanceRate,
        taxAnnualAllowanceRate: data.taxAnnualAllowanceRate,
        taxAllowanceYears: data.taxAllowanceYears,
        hasCostCap: data.hasCostCap,
        costCapAmount: data.costCapAmount ?? null,
        costCapCurrency: data.costCapCurrency ?? null,
        isActive: data.isActive,
        requiresSerialNumber: data.requiresSerialNumber,
        requiresInsurance: data.requiresInsurance,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create asset category');
  }
}
