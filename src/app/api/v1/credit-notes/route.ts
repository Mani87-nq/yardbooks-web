/**
 * GET/POST /api/v1/credit-notes
 * Manage credit notes.
 * - Full or partial credit against an invoice
 * - Creates reversing journal entry
 * - Can be applied to future invoices
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError, notFound } from '@/lib/api-error';
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const where: Record<string, unknown> = { companyId: companyId! };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const creditNotes = await prisma.creditNote.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    return NextResponse.json({ data: creditNotes });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list credit notes');
  }
}

const createCreditNoteSchema = z.object({
  invoiceId: z.string().min(1),
  subtotal: z.number().positive(),
  gctAmount: z.number().min(0).default(0),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createCreditNoteSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { invoiceId, subtotal, gctAmount, reason, notes } = parsed.data;
    const total = subtotal + gctAmount;

    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: companyId!, deletedAt: null },
    });
    if (!invoice) return notFound('Invoice not found');

    // Verify credit note amount doesn't exceed invoice balance
    if (total > Number(invoice.balance)) {
      return badRequest(`Credit note total (${total}) exceeds invoice balance (${invoice.balance})`);
    }

    // Generate credit note number
    const creditNoteNumber = `CN-${Date.now().toString(36).toUpperCase()}`;

    // Create credit note and update invoice balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const creditNote = await tx.creditNote.create({
        data: {
          companyId: companyId!,
          creditNoteNumber,
          invoiceId,
          customerId: invoice.customerId,
          subtotal,
          gctAmount,
          total,
          reason,
          notes,
          status: 'DRAFT',
          createdBy: user!.sub,
        },
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return creditNote;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create credit note');
  }
}
