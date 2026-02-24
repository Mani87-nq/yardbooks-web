/**
 * GET/PUT/DELETE /api/v1/journal-entries/[id]
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
    const { user, error: authError } = await requirePermission(request, 'journal:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId: companyId! },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) return notFound('Journal entry not found');
    return NextResponse.json(entry);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get journal entry');
  }
}

const journalLineSchema = z.object({
  accountId: z.string().min(1),
  accountCode: z.string().max(20).optional(),
  accountName: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
  lineNumber: z.number().int().optional(),
});

const updateJournalEntrySchema = z.object({
  date: z.coerce.date().optional(),
  reference: z.string().max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(journalLineSchema).min(2).optional(),
}).refine(
  (data) => {
    if (!data.lines) return true;
    const totalDebits = data.lines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredits = data.lines.reduce((sum, l) => sum + l.creditAmount, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.journalEntry.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Journal entry not found');
    if (existing.status !== 'DRAFT') {
      return badRequest('Only draft entries can be edited');
    }

    const body = await request.json();
    const parsed = updateJournalEntrySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { lines, ...entryData } = parsed.data;

    // If lines are provided, replace them
    if (lines) {
      await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
      await prisma.journalLine.createMany({
        data: lines.map((l, idx) => ({
          journalEntryId: id,
          lineNumber: l.lineNumber ?? idx + 1,
          accountId: l.accountId,
          accountCode: l.accountCode ?? '',
          accountName: l.accountName ?? '',
          description: l.description ?? null,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
        })),
      });
    }

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        ...entryData,
        ...(lines ? {
          totalDebits: lines.reduce((sum, l) => sum + l.debitAmount, 0),
          totalCredits: lines.reduce((sum, l) => sum + l.creditAmount, 0),
        } : {}),
      },
      include: { lines: { include: { account: { select: { accountNumber: true, name: true } } } } },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update journal entry');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.journalEntry.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Journal entry not found');

    if (existing.status === 'POSTED') {
      return badRequest('Posted journal entries cannot be deleted. Create a reversing entry instead.');
    }

    await prisma.journalEntry.update({ where: { id }, data: { status: 'VOID' } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete journal entry');
  }
}
