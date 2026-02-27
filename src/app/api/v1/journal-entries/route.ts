/**
 * GET/POST /api/v1/journal-entries
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'journal:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    const entries = await prisma.journalEntry.findMany({
      where: { companyId: companyId!, status: { not: 'VOID' } },
      include: { lines: { include: { account: { select: { accountNumber: true, name: true } } } } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { date: 'desc' },
    });

    const hasMore = entries.length > limit;
    const data = hasMore ? entries.slice(0, limit) : entries;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list journal entries');
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

const createJournalEntrySchema = z.object({
  date: z.coerce.date(),
  reference: z.string().max(100).optional(),
  description: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  lines: z.array(journalLineSchema).min(2),
}).refine(
  (data) => {
    const totalDebits = data.lines.reduce((sum, l) => sum + Number(l.debitAmount || 0), 0);
    const totalCredits = data.lines.reduce((sum, l) => sum + Number(l.creditAmount || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'journal:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createJournalEntrySchema.safeParse(body);
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

    // Generate entry number
    const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

    const entry = await prisma.journalEntry.create({
      data: {
        ...entryData,
        entryNumber,
        companyId: companyId!,
        totalDebits: lines.reduce((sum, l) => sum + Number(l.debitAmount || 0), 0),
        totalCredits: lines.reduce((sum, l) => sum + Number(l.creditAmount || 0), 0),
        createdById: user!.sub,
        lines: {
          create: lines.map((l, idx) => ({
            lineNumber: l.lineNumber ?? idx + 1,
            accountId: l.accountId,
            accountCode: l.accountCode ?? '',
            accountName: l.accountName ?? '',
            description: l.description,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
          })),
        },
      },
      include: { lines: { include: { account: { select: { accountNumber: true, name: true } } } } },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create journal entry');
  }
}
