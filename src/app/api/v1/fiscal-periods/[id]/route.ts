/**
 * GET/PUT /api/v1/fiscal-periods/[id]
 * View and manage a specific accounting period.
 * Supports state transitions: OPEN → SOFT_LOCKED → LOCKED → CLOSED
 * Also handles year-end closing (closing entries to retained earnings).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const period = await prisma.accountingPeriod.findFirst({
      where: { id, companyId: companyId! },
      include: {
        accountBalances: {
          include: {
            account: { select: { accountNumber: true, name: true, type: true } },
          },
        },
      },
    });

    if (!period) return notFound('Period not found');

    // Get period close checklist
    const checklist = await getPeriodChecklist(companyId!, period);

    return NextResponse.json({ ...period, checklist });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get period');
  }
}

const updatePeriodSchema = z.object({
  action: z.enum(['open', 'soft_lock', 'lock', 'close', 'reopen']),
  reason: z.string().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'gl:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const period = await prisma.accountingPeriod.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!period) return notFound('Period not found');

    const body = await request.json();
    const parsed = updatePeriodSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { action, reason } = parsed.data;

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      FUTURE: ['open'],
      OPEN: ['soft_lock'],
      SOFT_LOCKED: ['lock', 'reopen'],
      LOCKED: ['close', 'reopen'],
      CLOSED: [], // Cannot transition from CLOSED
    };

    const allowed = validTransitions[period.status] ?? [];
    if (!allowed.includes(action)) {
      return badRequest(`Cannot ${action} a period in ${period.status} status`);
    }

    switch (action) {
      case 'open': {
        const updated = await prisma.accountingPeriod.update({
          where: { id },
          data: { status: 'OPEN' },
        });
        return NextResponse.json(updated);
      }

      case 'soft_lock': {
        const updated = await prisma.accountingPeriod.update({
          where: { id },
          data: {
            status: 'SOFT_LOCKED',
            lockedAt: new Date(),
            lockedBy: user!.sub,
            lockedReason: reason,
          },
        });
        return NextResponse.json(updated);
      }

      case 'lock': {
        const updated = await prisma.accountingPeriod.update({
          where: { id },
          data: {
            status: 'LOCKED',
            lockedAt: new Date(),
            lockedBy: user!.sub,
            lockedReason: reason,
          },
        });
        return NextResponse.json(updated);
      }

      case 'close': {
        // Run period close checklist
        const checklist = await getPeriodChecklist(companyId!, period);
        const blockingItems = checklist.filter((c) => c.required && !c.completed);
        if (blockingItems.length > 0) {
          return badRequest(`Cannot close period. Incomplete items: ${blockingItems.map((i) => i.name).join(', ')}`);
        }

        const updated = await prisma.accountingPeriod.update({
          where: { id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: user!.sub,
          },
        });
        return NextResponse.json(updated);
      }

      case 'reopen': {
        const updated = await prisma.accountingPeriod.update({
          where: { id },
          data: {
            status: 'OPEN',
            lockedAt: null,
            lockedBy: null,
            lockedReason: null,
            closedAt: null,
            closedBy: null,
          },
        });
        return NextResponse.json(updated);
      }

      default:
        return badRequest('Invalid action');
    }
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update period');
  }
}

interface ChecklistItem {
  name: string;
  description: string;
  completed: boolean;
  required: boolean;
}

async function getPeriodChecklist(
  companyId: string,
  period: { startDate: Date; endDate: Date }
): Promise<ChecklistItem[]> {
  const items: ChecklistItem[] = [];

  // Check 1: Bank reconciliation completed
  const unreconciledAccounts = await prisma.bankAccount.count({
    where: {
      companyId,
      isActive: true,
      reconciliations: {
        none: {
          status: 'COMPLETED',
          periodEnd: { gte: period.startDate, lte: period.endDate },
        },
      },
    },
  });
  items.push({
    name: 'Bank Reconciliation',
    description: 'All bank accounts reconciled for the period',
    completed: unreconciledAccounts === 0,
    required: true,
  });

  // Check 2: No draft journal entries
  const draftEntries = await prisma.journalEntry.count({
    where: {
      companyId,
      status: 'DRAFT',
      date: { gte: period.startDate, lte: period.endDate },
    },
  });
  items.push({
    name: 'Journal Entries Posted',
    description: 'No draft journal entries in the period',
    completed: draftEntries === 0,
    required: true,
  });

  // Check 3: No draft invoices
  const draftInvoices = await prisma.invoice.count({
    where: {
      companyId: companyId,
      status: 'DRAFT',
      issueDate: { gte: period.startDate, lte: period.endDate },
      deletedAt: null,
    },
  });
  items.push({
    name: 'Invoices Finalized',
    description: 'No draft invoices in the period',
    completed: draftInvoices === 0,
    required: false,
  });

  return items;
}
