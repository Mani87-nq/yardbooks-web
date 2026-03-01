/**
 * GET  /api/v1/expenses — List expenses (paginated, company-scoped)
 * POST /api/v1/expenses — Create a new expense
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { postExpenseCreated } from '@/lib/accounting/engine';
import { createNotification } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'expenses:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const search = searchParams.get('search') ?? undefined;
    const categoryParam = searchParams.get('category');
    const validCategories = ['ADVERTISING', 'BANK_FEES', 'CONTRACTOR', 'EQUIPMENT', 'INSURANCE', 'INVENTORY', 'MEALS', 'OFFICE_SUPPLIES', 'PROFESSIONAL_SERVICES', 'RENT', 'REPAIRS', 'SALARIES', 'SOFTWARE', 'TAXES', 'TELEPHONE', 'TRAVEL', 'UTILITIES', 'VEHICLE', 'OTHER'] as const;
    const category = categoryParam && validCategories.includes(categoryParam as any) ? categoryParam : undefined;
    if (categoryParam && !category) {
      return badRequest('Invalid expense category');
    }

    const where = {
      companyId: companyId!,
      deletedAt: null,
      ...(category ? { category: category as any } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' as const } },
              { reference: { contains: search, mode: 'insensitive' as const } },
              { vendor: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const expenses = await prisma.expense.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { date: 'desc' },
    });

    const hasMore = expenses.length > limit;
    const data = hasMore ? expenses.slice(0, limit) : expenses;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list expenses');
  }
}

const createExpenseSchema = z.object({
  vendorId: z.string().optional(),
  category: z.enum(['ADVERTISING', 'BANK_FEES', 'CONTRACTOR', 'EQUIPMENT', 'INSURANCE', 'INVENTORY', 'MEALS', 'OFFICE_SUPPLIES', 'PROFESSIONAL_SERVICES', 'RENT', 'REPAIRS', 'SALARIES', 'SOFTWARE', 'TAXES', 'TELEPHONE', 'TRAVEL', 'UTILITIES', 'VEHICLE', 'OTHER']),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  gctAmount: z.number().min(0).default(0),
  gctClaimable: z.boolean().default(false),
  date: z.coerce.date(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'WIPAY']),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  receiptUrl: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'expenses:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Use a transaction so expense + journal entry are atomic
    const expense = await prisma.$transaction(async (tx: any) => {
      const exp = await tx.expense.create({
        data: {
          ...parsed.data,
          vendorId: parsed.data.vendorId || null,
          companyId: companyId!,
          createdBy: user!.sub,
        },
      });

      // Auto-post to General Ledger
      await postExpenseCreated({
        companyId: companyId!,
        userId: user!.sub,
        expenseId: exp.id,
        category: exp.category,
        description: exp.description,
        date: exp.date,
        amount: Number(exp.amount),
        gctAmount: Number(exp.gctAmount),
        gctClaimable: exp.gctClaimable,
        paymentMethod: exp.paymentMethod,
        tx,
      });

      return exp;
    });

    // Fire-and-forget notification
    const formatAmount = new Intl.NumberFormat('en-JM', {
      style: 'currency',
      currency: 'JMD',
    }).format(Number(expense.amount));

    createNotification({
      companyId: companyId!,
      type: 'EXPENSE_APPROVED',
      priority: 'LOW',
      title: 'New Expense Recorded',
      message: `Expense of ${formatAmount} for ${expense.description || expense.category}`,
      link: `/expenses`,
      relatedId: expense.id,
      relatedType: 'expense',
    }).catch(() => {});

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create expense');
  }
}
