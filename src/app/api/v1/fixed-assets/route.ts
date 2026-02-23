/**
 * GET  /api/v1/fixed-assets — List fixed assets (paginated, company-scoped)
 * POST /api/v1/fixed-assets — Create a new fixed asset
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
// ============================================
// GET — List fixed assets
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    // Status filter
    const statusParam = searchParams.get('status');
    const validStatuses = ['ACTIVE', 'IDLE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST', 'TRANSFERRED'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid asset status');
    }

    // Category filter
    const categoryId = searchParams.get('categoryId') ?? undefined;

    // Search filter
    const search = searchParams.get('search') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
              { assetTag: { contains: search, mode: 'insensitive' as const } },
              { serialNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const assets = await prisma.fixedAsset.findMany({
      where,
      include: {
        category: { select: { id: true, code: true, name: true } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = assets.length > limit;
    const data = hasMore ? assets.slice(0, limit) : assets;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list fixed assets');
  }
}

// ============================================
// Validation schema
// ============================================

const createAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000),
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
  ]).default('PURCHASE'),
  supplierId: z.string().optional(),
  supplierName: z.string().max(255).optional(),
  vendor: z.string().max(255).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.coerce.date().optional(),
  purchaseOrderNumber: z.string().max(100).optional(),

  // Cost
  purchaseCost: z.number().min(0).optional(),
  acquisitionCost: z.number().min(0).optional(),
  currency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).default('JMD'),
  exchangeRate: z.number().positive().default(1),
  installationCost: z.number().min(0).optional(),
  freightCost: z.number().min(0).optional(),
  customsDuty: z.number().min(0).optional(),
  otherCapitalizedCosts: z.number().min(0).optional(),

  // Book Depreciation
  bookDepreciationMethod: z.enum([
    'STRAIGHT_LINE', 'REDUCING_BALANCE', 'UNITS_OF_PRODUCTION', 'NONE',
  ]).default('STRAIGHT_LINE'),
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
  ]).default('ACTIVE'),
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
// POST — Create a new fixed asset
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createAssetSchema.safeParse(body);
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

    // If categoryId provided, resolve category details
    let categoryCode: string | undefined;
    let categoryName: string | undefined;
    if (data.categoryId) {
      const category = await prisma.assetCategory.findFirst({
        where: { id: data.categoryId, companyId: companyId! },
      });
      if (!category) {
        return badRequest('Asset category not found');
      }
      categoryCode = category.code;
      categoryName = category.name;

      // Apply category defaults if not explicitly provided
      if (!data.bookDepreciationMethod || data.bookDepreciationMethod === 'STRAIGHT_LINE') {
        data.bookDepreciationMethod = data.bookDepreciationMethod ?? category.defaultBookMethod;
      }
      if (data.bookUsefulLifeMonths == null) {
        data.bookUsefulLifeMonths = category.defaultBookUsefulLifeMonths;
      }
      if (data.taxCapitalAllowanceClass == null) {
        data.taxCapitalAllowanceClass = category.taxCapitalAllowanceClass;
      }
      if (data.taxInitialAllowanceRate == null) {
        data.taxInitialAllowanceRate = Number(category.taxInitialAllowanceRate);
      }
      if (data.taxAnnualAllowanceRate == null) {
        data.taxAnnualAllowanceRate = Number(category.taxAnnualAllowanceRate);
      }
    }

    // Calculate total capitalized cost
    const acquisitionCost = data.acquisitionCost ?? data.purchaseCost ?? 0;
    const totalCapitalizedCost =
      acquisitionCost +
      (data.installationCost ?? 0) +
      (data.freightCost ?? 0) +
      (data.customsDuty ?? 0) +
      (data.otherCapitalizedCosts ?? 0);

    // Calculate acquisition cost in JMD
    const acquisitionCostJMD = acquisitionCost * (data.exchangeRate ?? 1);

    // Calculate book residual value and initial NBV
    const bookResidualValue = data.bookResidualValue ?? 0;
    const bookNetBookValue = totalCapitalizedCost;

    // Generate asset number
    const assetNumber = await generateAssetNumber(companyId!);

    const asset = await prisma.fixedAsset.create({
      data: {
        companyId: companyId!,
        assetNumber,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId || null,
        categoryCode: categoryCode || null,
        categoryName: categoryName || null,
        assetTag: data.assetTag || null,
        serialNumber: data.serialNumber || null,
        barcode: data.barcode || null,

        // Location
        locationId: data.locationId || null,
        locationName: data.locationName || null,
        departmentId: data.departmentId || null,
        departmentName: data.departmentName || null,
        assignedTo: data.assignedTo || null,
        assignedToName: data.assignedToName || null,

        // Acquisition
        acquisitionDate: data.acquisitionDate || null,
        purchaseDate: data.purchaseDate || null,
        acquisitionMethod: data.acquisitionMethod,
        supplierId: data.supplierId || null,
        supplierName: data.supplierName || null,
        vendor: data.vendor || null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate || null,
        purchaseOrderNumber: data.purchaseOrderNumber || null,

        // Cost
        purchaseCost: data.purchaseCost ?? null,
        acquisitionCost: acquisitionCost,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        acquisitionCostJMD: acquisitionCostJMD,
        installationCost: data.installationCost ?? null,
        freightCost: data.freightCost ?? null,
        customsDuty: data.customsDuty ?? null,
        otherCapitalizedCosts: data.otherCapitalizedCosts ?? null,
        totalCapitalizedCost: totalCapitalizedCost,

        // Book Depreciation
        bookDepreciationMethod: data.bookDepreciationMethod,
        bookUsefulLifeMonths: data.bookUsefulLifeMonths ?? null,
        bookResidualValue: bookResidualValue,
        bookDepreciationStartDate: data.bookDepreciationStartDate || null,
        bookAccumulatedDepreciation: 0,
        bookNetBookValue: bookNetBookValue,

        // Tax
        taxCapitalAllowanceClass: data.taxCapitalAllowanceClass || null,
        taxInitialAllowanceRate: data.taxInitialAllowanceRate ?? null,
        taxAnnualAllowanceRate: data.taxAnnualAllowanceRate ?? null,
        taxAccumulatedAllowances: 0,
        taxWrittenDownValue: totalCapitalizedCost,
        taxEligibleCost: totalCapitalizedCost,

        // Status
        status: data.status,
        location: data.location || null,

        // Insurance & Warranty
        insuredValue: data.insuredValue ?? null,
        insurancePolicyNumber: data.insurancePolicyNumber || null,
        insuranceExpiry: data.insuranceExpiry || null,
        warrantyExpiry: data.warrantyExpiry || null,
        warrantyProvider: data.warrantyProvider || null,

        // GL overrides
        assetGLAccountCode: data.assetGLAccountCode || null,
        accumulatedDepGLAccountCode: data.accumulatedDepGLAccountCode || null,
        depreciationExpenseGLAccountCode: data.depreciationExpenseGLAccountCode || null,

        notes: data.notes || null,
        createdBy: user!.sub,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create fixed asset');
  }
}

// ============================================
// Helpers
// ============================================

async function generateAssetNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.fixedAsset.count({
    where: { companyId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  return `FA-${year}-${String(count + 1).padStart(5, '0')}`;
}
