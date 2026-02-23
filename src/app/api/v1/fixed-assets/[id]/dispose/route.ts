/**
 * POST /api/v1/fixed-assets/[id]/dispose — Create a disposal record for a fixed asset
 *
 * Calculates book gain/loss and tax balancing charge from the asset's
 * current NBV/WDV vs the disposal proceeds.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
// ============================================
// Validation schema
// ============================================

const createDisposalSchema = z.object({
  disposalDate: z.coerce.date(),
  disposalMethod: z.enum([
    'SALE', 'TRADE_IN', 'SCRAP', 'DONATION', 'THEFT', 'WRITE_OFF', 'TRANSFER',
  ]),
  proceedsAmount: z.number().min(0).default(0),
  proceedsCurrency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).default('JMD'),
  proceedsExchangeRate: z.number().positive().default(1),
  disposalReason: z.string().max(2000).optional(),
  buyerId: z.string().optional(),
  buyerName: z.string().max(255).optional(),
  invoiceNumber: z.string().max(100).optional(),
});

// ============================================
// POST — Create disposal record
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assetId } = await params;

    // Auth + permission
    const { user, error: authError } = await requirePermission(request, 'fixed_assets:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify asset exists, belongs to company, and is not already disposed
    const asset = await prisma.fixedAsset.findFirst({
      where: { id: assetId, companyId: companyId! },
    });
    if (!asset) {
      return notFound('Fixed asset not found');
    }
    if (asset.status === 'DISPOSED') {
      return badRequest('Asset has already been disposed');
    }

    // Validate body
    const body = await request.json();
    const parsed = createDisposalSchema.safeParse(body);
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

    // ── Calculate book gain/loss ──
    const bookCostAtDisposal = Number(asset.totalCapitalizedCost ?? asset.acquisitionCost ?? 0);
    const bookAccumulatedDepAtDisposal = Number(asset.bookAccumulatedDepreciation ?? 0);
    const bookNBVAtDisposal = Number(asset.bookNetBookValue ?? (bookCostAtDisposal - bookAccumulatedDepAtDisposal));
    const proceedsAmountJMD = data.proceedsAmount * data.proceedsExchangeRate;
    const bookGainOrLoss = proceedsAmountJMD - bookNBVAtDisposal;
    const isBookGain = bookGainOrLoss >= 0;

    // ── Calculate tax balancing charge ──
    const taxCostAtDisposal = Number(asset.taxEligibleCost ?? bookCostAtDisposal);
    const taxAccumulatedAllowancesAtDisposal = Number(asset.taxAccumulatedAllowances ?? 0);
    const taxWDVAtDisposal = Number(asset.taxWrittenDownValue ?? (taxCostAtDisposal - taxAccumulatedAllowancesAtDisposal));
    const taxBalancingAmount = proceedsAmountJMD - taxWDVAtDisposal;
    const isBalancingCharge = taxBalancingAmount > 0;

    // Cap balancing charge at total allowances claimed (Jamaica tax rule)
    const balancingChargeCapped = isBalancingCharge && taxBalancingAmount > taxAccumulatedAllowancesAtDisposal;

    // Create disposal record and update asset in a transaction
    const disposal = await prisma.$transaction(async (tx) => {
      // Create the disposal record
      const disposalRecord = await tx.fixedAssetDisposal.create({
        data: {
          companyId: companyId!,
          assetId,
          disposalDate: data.disposalDate,
          disposalMethod: data.disposalMethod,
          disposalReason: data.disposalReason || null,
          proceedsAmount: data.proceedsAmount,
          proceedsCurrency: data.proceedsCurrency,
          proceedsExchangeRate: data.proceedsExchangeRate,
          proceedsAmountJMD: proceedsAmountJMD,
          buyerId: data.buyerId || null,
          buyerName: data.buyerName || null,
          invoiceNumber: data.invoiceNumber || null,

          // Book values at disposal
          bookCostAtDisposal,
          bookAccumulatedDepAtDisposal,
          bookNBVAtDisposal,

          // Tax values at disposal
          taxCostAtDisposal,
          taxAccumulatedAllowancesAtDisposal,
          taxWDVAtDisposal,

          // Gain/Loss
          bookGainOrLoss,
          isBookGain,
          taxBalancingAmount: isBalancingCharge
            ? Math.min(taxBalancingAmount, taxAccumulatedAllowancesAtDisposal)
            : taxBalancingAmount,
          isBalancingCharge,
          balancingChargeCapped,

          status: 'DRAFT',
          createdBy: user!.sub,
        },
      });

      // Update the asset status to DISPOSED
      await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          status: 'DISPOSED',
          disposalId: disposalRecord.id,
          disposalDate: data.disposalDate,
          disposalMethod: data.disposalMethod,
          disposalProceeds: data.proceedsAmount,
          updatedBy: user!.sub,
        },
      });

      return disposalRecord;
    });

    return NextResponse.json(disposal, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create disposal record');
  }
}
