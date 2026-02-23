/**
 * POST /api/v1/stock-counts/[id]/post — Post stock count variances to the General Ledger
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const postSchema = z.object({
  inventoryAccountId: z.string().min(1),
  varianceAccountId: z.string().min(1),
  date: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:post');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });
    if (!stockCount) return notFound('Stock count not found');

    if (stockCount.status !== 'APPROVED') {
      return badRequest('Stock count must be APPROVED before posting to GL');
    }

    if (stockCount.journalEntryId) {
      return badRequest('Stock count has already been posted to GL');
    }

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify GL accounts exist and belong to the company
    const [inventoryAccount, varianceAccount] = await Promise.all([
      prisma.gLAccount.findFirst({ where: { id: parsed.data.inventoryAccountId, companyId: companyId! } }),
      prisma.gLAccount.findFirst({ where: { id: parsed.data.varianceAccountId, companyId: companyId! } }),
    ]);
    if (!inventoryAccount) return badRequest('Inventory GL account not found');
    if (!varianceAccount) return badRequest('Variance GL account not found');

    // Calculate total variance value
    const itemsWithVariance = stockCount.items.filter(
      (item) => item.varianceValue != null && Number(item.varianceValue) !== 0,
    );

    if (itemsWithVariance.length === 0) {
      return badRequest('No variance to post. All counted quantities match expected quantities.');
    }

    const totalVarianceValue = itemsWithVariance.reduce(
      (sum, item) => sum + Number(item.varianceValue ?? 0),
      0,
    );

    const absVariance = Math.abs(totalVarianceValue);
    const postDate = parsed.data.date ?? new Date();

    // Generate journal entry number
    const jeCount = await prisma.journalEntry.count({ where: { companyId: companyId! } });
    const entryNumber = `JE-${String(jeCount + 1).padStart(5, '0')}`;

    // Create journal entry in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Positive variance = surplus (counted > expected): Dr Inventory, Cr Variance
      // Negative variance = shortage (counted < expected): Dr Variance, Cr Inventory
      const lines = [];

      if (totalVarianceValue > 0) {
        // Surplus: increase inventory
        lines.push(
          {
            lineNumber: 1,
            accountId: inventoryAccount.id,
            accountCode: inventoryAccount.accountNumber,
            accountName: inventoryAccount.name,
            description: `Stock count surplus: ${stockCount.countNumber}`,
            debitAmount: absVariance,
            creditAmount: 0,
          },
          {
            lineNumber: 2,
            accountId: varianceAccount.id,
            accountCode: varianceAccount.accountNumber,
            accountName: varianceAccount.name,
            description: `Stock count surplus: ${stockCount.countNumber}`,
            debitAmount: 0,
            creditAmount: absVariance,
          },
        );
      } else {
        // Shortage: decrease inventory
        lines.push(
          {
            lineNumber: 1,
            accountId: varianceAccount.id,
            accountCode: varianceAccount.accountNumber,
            accountName: varianceAccount.name,
            description: `Stock count shortage: ${stockCount.countNumber}`,
            debitAmount: absVariance,
            creditAmount: 0,
          },
          {
            lineNumber: 2,
            accountId: inventoryAccount.id,
            accountCode: inventoryAccount.accountNumber,
            accountName: inventoryAccount.name,
            description: `Stock count shortage: ${stockCount.countNumber}`,
            debitAmount: 0,
            creditAmount: absVariance,
          },
        );
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          companyId: companyId!,
          date: postDate,
          description: `Stock count variance: ${stockCount.countNumber} - ${stockCount.name}`,
          reference: stockCount.countNumber,
          sourceModule: 'STOCK_COUNT',
          sourceDocumentId: stockCount.id,
          sourceDocumentType: 'StockCount',
          totalDebits: absVariance,
          totalCredits: absVariance,
          status: 'POSTED',
          notes: parsed.data.notes || null,
          createdById: user!.sub,
          lines: { create: lines },
        },
        include: { lines: true },
      });

      // Update stock count with journal entry link
      const updatedStockCount = await tx.stockCount.update({
        where: { id },
        data: {
          status: 'POSTED',
          journalEntryId: journalEntry.id,
          totalVarianceValue: totalVarianceValue,
        },
        include: { items: true },
      });

      return { stockCount: updatedStockCount, journalEntry };
    });

    return NextResponse.json(result);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to post stock count to GL');
  }
}
