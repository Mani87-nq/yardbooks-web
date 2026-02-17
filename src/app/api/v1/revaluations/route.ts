/**
 * GET  /api/v1/revaluations — List revaluation entries (company-scoped)
 * POST /api/v1/revaluations — Run month-end revaluation for foreign currency bank accounts
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { getExchangeRate, convertToJMD } from '@/lib/currency/converter';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:reconcile');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const month = searchParams.get('month'); // YYYY-MM-DD format

    const where: Record<string, unknown> = {
      companyId: companyId!,
    };

    if (month) {
      where.revaluationMonth = new Date(month);
    }

    const entries = await prisma.revaluationEntry.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        bankAccount: {
          select: { id: true, accountName: true, bankName: true, currency: true },
        },
      },
    });

    const hasMore = entries.length > limit;
    const data = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({
      data,
      pagination: { nextCursor, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list revaluations');
  }
}

// ---- POST (Run month-end revaluation) ----

const revaluationSchema = z.object({
  revaluationMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'banking:reconcile');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = revaluationSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const revaluationMonth = new Date(parsed.data.revaluationMonth);

    // Find all foreign currency bank accounts for this company
    const foreignAccounts = await prisma.bankAccount.findMany({
      where: {
        companyId: companyId!,
        isActive: true,
        currency: { not: 'JMD' },
      },
    });

    if (foreignAccounts.length === 0) {
      return badRequest('No foreign currency bank accounts found for this company');
    }

    const results = [];

    for (const account of foreignAccounts) {
      // Get the current exchange rate for this currency
      const currentRate = await getExchangeRate(account.currency, 'JMD', revaluationMonth);
      if (currentRate === null) {
        // Skip accounts without a rate, but note the issue
        results.push({
          bankAccountId: account.id,
          accountName: account.accountName,
          currency: account.currency,
          skipped: true,
          reason: `No exchange rate found for ${account.currency}`,
        });
        continue;
      }

      // Check for existing revaluation for this account and month
      const existing = await prisma.revaluationEntry.findUnique({
        where: {
          bankAccountId_revaluationMonth: {
            bankAccountId: account.id,
            revaluationMonth,
          },
        },
      });

      // Get the previous rate: either from last revaluation or the original rate
      let previousRate: number;
      if (existing) {
        previousRate = Number(existing.currentRate);
      } else {
        // Look for the most recent revaluation before this month
        const prevRevaluation = await prisma.revaluationEntry.findFirst({
          where: {
            bankAccountId: account.id,
            revaluationMonth: { lt: revaluationMonth },
          },
          orderBy: { revaluationMonth: 'desc' },
        });
        previousRate = prevRevaluation ? Number(prevRevaluation.currentRate) : currentRate;
      }

      const balanceInForeign = Number(account.currentBalance);
      const previousJmdValue = convertToJMD(balanceInForeign, previousRate);
      const currentJmdValue = convertToJMD(balanceInForeign, currentRate);
      const unrealizedGainLoss = Math.round((currentJmdValue - previousJmdValue) * 100) / 100;

      if (existing) {
        // Update existing revaluation
        const updated = await prisma.revaluationEntry.update({
          where: { id: existing.id },
          data: {
            previousRate,
            currentRate,
            balanceInForeign,
            previousJmdValue,
            currentJmdValue,
            unrealizedGainLoss,
          },
        });
        results.push({ ...updated, skipped: false });
      } else {
        // Create new revaluation entry
        const entry = await prisma.revaluationEntry.create({
          data: {
            companyId: companyId!,
            bankAccountId: account.id,
            currency: account.currency,
            previousRate,
            currentRate,
            balanceInForeign,
            previousJmdValue,
            currentJmdValue,
            unrealizedGainLoss,
            revaluationMonth,
            createdBy: user!.sub,
          },
        });
        results.push({ ...entry, skipped: false });
      }
    }

    const totalUnrealizedGainLoss = results
      .filter((r) => !('skipped' in r && r.skipped))
      .reduce((sum, r) => sum + (Number((r as Record<string, unknown>).unrealizedGainLoss) || 0), 0);

    return NextResponse.json(
      {
        data: results,
        summary: {
          accountsProcessed: foreignAccounts.length,
          accountsRevalued: results.filter((r) => !('skipped' in r && r.skipped)).length,
          accountsSkipped: results.filter((r) => 'skipped' in r && r.skipped).length,
          totalUnrealizedGainLoss: Math.round(totalUnrealizedGainLoss * 100) / 100,
          revaluationMonth: parsed.data.revaluationMonth,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to run revaluation');
  }
}
