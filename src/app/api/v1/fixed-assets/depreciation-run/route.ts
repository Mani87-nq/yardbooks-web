/**
 * POST /api/v1/fixed-assets/depreciation-run — Run depreciation for a fiscal period
 *
 * Processes all active assets (or a filtered subset) and creates
 * FixedAssetDepreciationEntry records for the given period.
 * Also creates a DepreciationRun batch record.
 *
 * Supports both book depreciation (IFRS) and Jamaica tax capital allowances.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, conflict, internalError } from '@/lib/api-error';
// ============================================
// Validation schema
// ============================================

const depreciationRunSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  periodNumber: z.number().int().min(1).max(12),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  categoryIds: z.array(z.string()).optional(), // filter to specific categories
  assetIds: z.array(z.string()).optional(),     // filter to specific assets
});

// ============================================
// POST — Run depreciation
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Auth + permission (requires depreciate permission)
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:depreciate');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = depreciationRunSchema.safeParse(body);
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

    // Validate period dates
    if (data.periodEndDate <= data.periodStartDate) {
      return badRequest('Period end date must be after period start date');
    }

    // Check for duplicate run for this period
    const existingRun = await prisma.depreciationRun.findFirst({
      where: {
        companyId: companyId!,
        fiscalYear: data.fiscalYear,
        periodNumber: data.periodNumber,
        status: { not: 'REVERSED' },
      },
    });
    if (existingRun) {
      return conflict(
        `A depreciation run for fiscal year ${data.fiscalYear}, period ${data.periodNumber} already exists (status: ${existingRun.status})`
      );
    }

    // Build asset query filter
    const assetWhere: Record<string, unknown> = {
      companyId: companyId!,
      status: 'ACTIVE',
      isFullyDepreciated: false,
      bookDepreciationMethod: { not: 'NONE' },
    };
    if (data.categoryIds?.length) {
      assetWhere.categoryId = { in: data.categoryIds };
    }
    if (data.assetIds?.length) {
      assetWhere.id = { in: data.assetIds };
    }

    // Fetch all eligible assets
    const assets = await prisma.fixedAsset.findMany({
      where: assetWhere,
    });

    if (assets.length === 0) {
      return badRequest('No eligible assets found for depreciation in this period');
    }

    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let totalBookDepreciation = 0;
      let totalTaxAllowance = 0;
      const processedAssetIds: string[] = [];
      const processedCategoryIds = new Set<string>();
      const entriesToCreate: Array<Record<string, unknown>> = [];

      for (const asset of assets) {
        const totalCost = Number(asset.totalCapitalizedCost ?? asset.acquisitionCost ?? 0);
        const residualValue = Number(asset.bookResidualValue ?? 0);
        const depreciableCost = totalCost - residualValue;
        const currentAccumDep = Number(asset.bookAccumulatedDepreciation ?? 0);
        const openingNBV = totalCost - currentAccumDep;

        // ── Book depreciation calculation ──
        let bookDepAmount = 0;

        if (openingNBV > residualValue && depreciableCost > 0) {
          switch (asset.bookDepreciationMethod) {
            case 'STRAIGHT_LINE': {
              const usefulLifeMonths = asset.bookUsefulLifeMonths ?? 60; // default 5 years
              const monthlyDep = depreciableCost / usefulLifeMonths;
              bookDepAmount = Math.min(monthlyDep, openingNBV - residualValue);
              break;
            }
            case 'REDUCING_BALANCE': {
              const usefulLifeMonths = asset.bookUsefulLifeMonths ?? 60;
              // Annual rate derived from useful life: rate = 1 - (residual/cost)^(1/years)
              const years = usefulLifeMonths / 12;
              const annualRate = residualValue > 0 && totalCost > 0
                ? 1 - Math.pow(residualValue / totalCost, 1 / years)
                : 2 / years; // double declining as fallback
              const monthlyRate = annualRate / 12;
              bookDepAmount = Math.min(openingNBV * monthlyRate, openingNBV - residualValue);
              break;
            }
            case 'UNITS_OF_PRODUCTION': {
              // For units-of-production, fall back to straight-line as units data
              // would need to be passed per asset. This is a safe default.
              const usefulLifeMonths = asset.bookUsefulLifeMonths ?? 60;
              const monthlyDep = depreciableCost / usefulLifeMonths;
              bookDepAmount = Math.min(monthlyDep, openingNBV - residualValue);
              break;
            }
            default:
              bookDepAmount = 0;
          }
        }

        // Round to 2 decimal places
        bookDepAmount = Math.round(bookDepAmount * 100) / 100;
        const closingNBV = Math.round((openingNBV - bookDepAmount) * 100) / 100;

        // ── Tax capital allowance calculation ──
        const taxEligibleCost = Number(asset.taxEligibleCost ?? totalCost);
        const currentTaxAccum = Number(asset.taxAccumulatedAllowances ?? 0);
        const taxOpeningWDV = Number(asset.taxWrittenDownValue ?? (taxEligibleCost - currentTaxAccum));
        let taxAllowance = 0;
        let taxAllowanceType: string = 'none';

        if (taxOpeningWDV > 0 && !asset.isFullyAllowed) {
          const initialRate = Number(asset.taxInitialAllowanceRate ?? 0);
          const annualRate = Number(asset.taxAnnualAllowanceRate ?? 0);

          // Check if initial allowance has been claimed
          const initialClaimed = Number(asset.taxInitialAllowanceClaimed ?? 0);
          const isFirstYear = initialClaimed === 0 && initialRate > 0;

          if (isFirstYear && data.periodNumber === 1) {
            // Initial allowance claimed in period 1 of the first year
            taxAllowance = taxEligibleCost * initialRate;
            taxAllowanceType = 'initial';
          } else if (annualRate > 0) {
            // Annual allowance — monthly portion
            const annualAmount = taxOpeningWDV * annualRate;
            taxAllowance = annualAmount / 12;
            taxAllowanceType = 'annual';
          }

          // Cannot reduce below zero
          taxAllowance = Math.min(taxAllowance, taxOpeningWDV);
        }

        taxAllowance = Math.round(taxAllowance * 100) / 100;
        const taxClosingWDV = Math.round((taxOpeningWDV - taxAllowance) * 100) / 100;

        totalBookDepreciation += bookDepAmount;
        totalTaxAllowance += taxAllowance;
        processedAssetIds.push(asset.id);
        if (asset.categoryId) processedCategoryIds.add(asset.categoryId);

        // Prepare entry
        entriesToCreate.push({
          companyId: companyId!,
          assetId: asset.id,
          fiscalYear: data.fiscalYear,
          periodNumber: data.periodNumber,
          periodStartDate: data.periodStartDate,
          periodEndDate: data.periodEndDate,
          bookDepreciationAmount: bookDepAmount,
          bookOpeningNBV: openingNBV,
          bookClosingNBV: closingNBV,
          taxAllowanceType,
          taxAllowanceAmount: taxAllowance,
          taxOpeningWDV: taxOpeningWDV,
          taxClosingWDV: taxClosingWDV,
          status: 'DRAFT',
        });

        // Update asset running totals
        const newAccumDep = currentAccumDep + bookDepAmount;
        const newTaxAccum = currentTaxAccum + taxAllowance;
        const isFullyDepreciated = closingNBV <= residualValue;
        const isFullyAllowed = taxClosingWDV <= 0;

        await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            bookAccumulatedDepreciation: newAccumDep,
            bookNetBookValue: closingNBV,
            taxAccumulatedAllowances: newTaxAccum,
            taxWrittenDownValue: taxClosingWDV,
            isFullyDepreciated,
            isFullyAllowed,
            ...(taxAllowanceType === 'initial'
              ? { taxInitialAllowanceClaimed: taxAllowance }
              : {}),
            updatedBy: user!.sub,
          },
        });
      }

      // Bulk create all depreciation entries
      await tx.fixedAssetDepreciationEntry.createMany({
        data: entriesToCreate as any,
      });

      // Create the depreciation run batch record
      const run = await tx.depreciationRun.create({
        data: {
          companyId: companyId!,
          fiscalYear: data.fiscalYear,
          periodNumber: data.periodNumber,
          periodEndDate: data.periodEndDate,
          assetCategoryIds: Array.from(processedCategoryIds),
          assetIds: processedAssetIds,
          assetsProcessed: processedAssetIds.length,
          totalBookDepreciation: Math.round(totalBookDepreciation * 100) / 100,
          totalTaxAllowance: Math.round(totalTaxAllowance * 100) / 100,
          status: 'DRAFT',
          createdBy: user!.sub,
        },
      });

      return run;
    });

    return NextResponse.json(
      {
        data: result,
        summary: {
          assetsProcessed: result.assetsProcessed,
          totalBookDepreciation: Number(result.totalBookDepreciation),
          totalTaxAllowance: Number(result.totalTaxAllowance),
          fiscalYear: result.fiscalYear,
          periodNumber: result.periodNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to run depreciation');
  }
}
