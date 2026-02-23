/**
 * POST /api/v1/banking/import
 *
 * Import bank transactions from a CSV file.
 * Supports NCB, Scotiabank Jamaica, JMMB, and generic CSV formats.
 *
 * Accepts multipart form data with:
 *   - file: The CSV file
 *   - bankAccountId: The bank account to import into
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { parseBankCSV } from '@/lib/banking/csv-parser';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bankAccountId = formData.get('bankAccountId') as string | null;

    if (!file) return badRequest('CSV file is required');
    if (!bankAccountId) return badRequest('bankAccountId is required');

    // Verify bank account belongs to company
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: companyId! },
    });
    if (!bankAccount) return notFound('Bank account not found');

    // Read and parse the CSV
    const csvText = await file.text();
    const parseResult = parseBankCSV(csvText);

    if (!parseResult.success) {
      return badRequest(`CSV parse error: ${parseResult.error}`);
    }

    if (parseResult.transactions.length === 0) {
      return badRequest('No valid transactions found in CSV');
    }

    // Import transactions, skipping duplicates
    let imported = 0;
    let skipped = 0;

    for (const tx of parseResult.transactions) {
      // Simple duplicate detection: same date + amount + description
      const existing = await prisma.bankTransaction.findFirst({
        where: {
          bankAccountId,
          transactionDate: tx.date,
          amount: Math.abs(tx.amount),
          description: tx.description,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.bankTransaction.create({
        data: {
          bankAccountId,
          transactionDate: tx.date,
          postDate: tx.date,
          description: tx.description,
          amount: Math.abs(tx.amount),
          reference: tx.reference ?? null,
          balance: tx.balance ?? null,
          category: tx.type,
          isReconciled: false,
        },
      });

      imported++;
    }

    return NextResponse.json({
      message: 'Bank transactions imported successfully',
      bankName: parseResult.bankName ?? 'Unknown',
      totalParsed: parseResult.transactions.length,
      imported,
      skipped,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to import bank transactions');
  }
}
