/**
 * POST /api/v1/banking/import
 *
 * Import bank transactions from a CSV or OFX/QFX file.
 * Supports NCB, Scotiabank Jamaica, JMMB, Sagicor, and generic formats.
 *
 * Accepts multipart form data with:
 *   - file: The CSV or OFX/QFX file
 *   - bankAccountId: The bank account to import into
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';
import { parseBankCSV } from '@/lib/banking/csv-parser';
import { parseOFX, isOFXFormat } from '@/lib/banking/ofx-parser';

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

    if (!file) return badRequest('A bank statement file (CSV, OFX, or QFX) is required');
    if (!bankAccountId) return badRequest('bankAccountId is required');

    // Verify bank account belongs to company
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: companyId! },
    });
    if (!bankAccount) return notFound('Bank account not found');

    // Read file content
    const fileText = await file.text();
    const fileName = file.name || '';

    // Detect format and parse
    let parseResult;
    let fileFormat: string;

    if (isOFXFormat(fileName, fileText)) {
      parseResult = parseOFX(fileText);
      fileFormat = 'OFX';
    } else {
      parseResult = parseBankCSV(fileText);
      fileFormat = 'CSV';
    }

    if (!parseResult.success) {
      return badRequest(`${fileFormat} parse error: ${parseResult.error}`);
    }

    if (parseResult.transactions.length === 0) {
      return badRequest(`No valid transactions found in ${fileFormat} file`);
    }

    // Create an import batch for tracking
    const importBatch = await prisma.importBatch.create({
      data: {
        bankAccountId,
        fileName: fileName,
        fileType: fileFormat.toLowerCase(),
        transactionCount: parseResult.transactions.length,
        importedBy: user!.sub,
        status: 'pending',
      },
    });

    // Import transactions, skipping duplicates
    let imported = 0;
    let skipped = 0;

    for (const tx of parseResult.transactions) {
      // Duplicate detection: same date + amount + description (or reference)
      const existing = await prisma.bankTransaction.findFirst({
        where: {
          bankAccountId,
          transactionDate: tx.date,
          amount: Math.abs(tx.amount),
          OR: [
            { description: tx.description },
            ...(tx.reference ? [{ reference: tx.reference }] : []),
          ],
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
          importBatchId: importBatch.id,
        },
      });

      imported++;
    }

    // Update import batch status
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: {
        transactionCount: imported,
        status: 'completed',
      },
    });

    return NextResponse.json({
      message: `Bank transactions imported successfully from ${fileFormat} file`,
      fileFormat,
      bankName: parseResult.bankName ?? 'Unknown',
      accountNumber: parseResult.accountNumber,
      totalParsed: parseResult.transactions.length,
      imported,
      skipped,
      importBatchId: importBatch.id,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to import bank transactions');
  }
}
