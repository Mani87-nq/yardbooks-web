/**
 * GET  /api/v1/budgets — List budgets
 * POST /api/v1/budgets — Create a budget with lines per account per month
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── GET: List budgets ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get('fiscalYear');
    const status = searchParams.get('status');

    const where: any = { companyId: companyId! };
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
    if (status) where.status = status;

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, accountNumber: true, name: true, type: true },
            },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { fiscalYear: 'desc' },
    });

    // Calculate total budget per budget
    const data = budgets.map((b) => {
      const totalBudget = b.lines.reduce((sum, line) => {
        let lineTotal = 0;
        for (let m = 1; m <= 12; m++) {
          lineTotal += Number((line as any)[`month${m}`] ?? 0);
        }
        return sum + lineTotal;
      }, 0);

      return { ...b, totalBudget: Math.round(totalBudget * 100) / 100 };
    });

    return NextResponse.json({ data });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list budgets');
  }
}

// ─── POST: Create a budget ──────────────────────────────────────

const budgetLineSchema = z.object({
  accountId: z.string().min(1),
  month1: z.number().min(0).default(0),
  month2: z.number().min(0).default(0),
  month3: z.number().min(0).default(0),
  month4: z.number().min(0).default(0),
  month5: z.number().min(0).default(0),
  month6: z.number().min(0).default(0),
  month7: z.number().min(0).default(0),
  month8: z.number().min(0).default(0),
  month9: z.number().min(0).default(0),
  month10: z.number().min(0).default(0),
  month11: z.number().min(0).default(0),
  month12: z.number().min(0).default(0),
});

const createBudgetSchema = z.object({
  name: z.string().min(1).max(200),
  fiscalYear: z.number().int().min(2020).max(2100),
  notes: z.string().max(1000).optional(),
  lines: z.array(budgetLineSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed');
    }

    const { name, fiscalYear, notes, lines } = parsed.data;

    // Check for existing budget for this fiscal year
    const existing = await prisma.budget.findUnique({
      where: { companyId_fiscalYear: { companyId: companyId!, fiscalYear } },
    });
    if (existing) {
      return badRequest(`A budget already exists for fiscal year ${fiscalYear}. Edit the existing budget instead.`);
    }

    // Verify all account IDs belong to this company
    const accountIds = lines.map((l) => l.accountId);
    const accounts = await prisma.gLAccount.findMany({
      where: { id: { in: accountIds }, companyId: companyId! },
      select: { id: true },
    });
    const validIds = new Set(accounts.map((a) => a.id));
    const invalidIds = accountIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return badRequest(`Invalid GL accounts: ${invalidIds.join(', ')}`);
    }

    // Create budget with lines
    const budget = await prisma.budget.create({
      data: {
        companyId: companyId!,
        name,
        fiscalYear,
        notes,
        createdBy: user!.sub,
        lines: {
          create: lines.map((line) => ({
            accountId: line.accountId,
            month1: line.month1,
            month2: line.month2,
            month3: line.month3,
            month4: line.month4,
            month5: line.month5,
            month6: line.month6,
            month7: line.month7,
            month8: line.month8,
            month9: line.month9,
            month10: line.month10,
            month11: line.month11,
            month12: line.month12,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, accountNumber: true, name: true, type: true },
            },
          },
        },
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create budget');
  }
}
