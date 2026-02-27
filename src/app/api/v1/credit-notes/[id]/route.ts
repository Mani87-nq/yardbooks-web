/**
 * GET/PUT /api/v1/credit-notes/[id]
 * Get or update a credit note (approve, apply to invoice, void).
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
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const creditNote = await prisma.creditNote.findFirst({
      where: { id, companyId: companyId! },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        invoice: { select: { id: true, invoiceNumber: true, total: true, balance: true } },
        journalEntry: { select: { id: true, entryNumber: true } },
      },
    });

    if (!creditNote) return notFound('Credit note not found');
    return NextResponse.json(creditNote);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get credit note');
  }
}

const updateSchema = z.object({
  action: z.enum(['approve', 'apply', 'void']),
  applyToInvoiceId: z.string().optional(), // When action = 'apply'
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const creditNote = await prisma.creditNote.findFirst({
      where: { id, companyId: companyId! },
      include: { invoice: true },
    });
    if (!creditNote) return notFound('Credit note not found');

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { action, applyToInvoiceId } = parsed.data;

    switch (action) {
      case 'approve': {
        if (creditNote.status !== 'DRAFT') {
          return badRequest('Credit note must be in DRAFT status to approve');
        }

        // Create reversing journal entry
        const total = Number(creditNote.total);

        // Generate entry number
        const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

        const result = await prisma.$transaction(async (tx) => {
          // Create the reversing journal entry
          const journalEntry = await tx.journalEntry.create({
            data: {
              companyId: companyId!,
              entryNumber,
              date: new Date(),
              description: `Credit Note ${creditNote.creditNoteNumber} against Invoice`,
              sourceModule: 'INVOICE',
              sourceDocumentId: creditNote.id,
              sourceDocumentType: 'CreditNote',
              totalDebits: total,
              totalCredits: total,
              status: 'POSTED',
              createdById: user!.sub,
              postedById: user!.sub,
              postedAt: new Date(),
            },
          });

          // Update credit note
          const updated = await tx.creditNote.update({
            where: { id },
            data: {
              status: 'APPROVED',
              journalEntryId: journalEntry.id,
            },
          });

          // Update original invoice balance
          await tx.invoice.update({
            where: { id: creditNote.invoiceId },
            data: {
              balance: { decrement: total },
            },
          });

          // Update customer balance
          await tx.customer.update({
            where: { id: creditNote.customerId },
            data: {
              balance: { decrement: total },
            },
          });

          return updated;
        });

        return NextResponse.json(result);
      }

      case 'apply': {
        if (creditNote.status !== 'APPROVED') {
          return badRequest('Credit note must be APPROVED before applying');
        }
        if (!applyToInvoiceId) {
          return badRequest('applyToInvoiceId is required');
        }

        // Find target invoice
        const targetInvoice = await prisma.invoice.findFirst({
          where: { id: applyToInvoiceId, companyId: companyId!, deletedAt: null },
        });
        if (!targetInvoice) return notFound('Target invoice not found');

        const creditAmount = Number(creditNote.total);
        const invoiceBalance = Number(targetInvoice.balance);
        const applyAmount = Math.min(creditAmount, invoiceBalance);

        const result = await prisma.$transaction(async (tx) => {
          // Apply credit to target invoice
          await tx.invoice.update({
            where: { id: applyToInvoiceId },
            data: {
              amountPaid: { increment: applyAmount },
              balance: { decrement: applyAmount },
              ...(applyAmount >= invoiceBalance ? { status: 'PAID', paidDate: new Date() } : {}),
            },
          });

          // Update credit note status
          const updated = await tx.creditNote.update({
            where: { id },
            data: {
              status: 'APPLIED',
              appliedToInvoiceId: applyToInvoiceId,
              appliedAmount: applyAmount,
              appliedAt: new Date(),
            },
          });

          return updated;
        });

        return NextResponse.json(result);
      }

      case 'void': {
        if (creditNote.status === 'APPLIED') {
          return badRequest('Cannot void an applied credit note');
        }

        const result = await prisma.$transaction(async (tx) => {
          // If approved, reverse the balance changes
          if (creditNote.status === 'APPROVED') {
            const total = Number(creditNote.total);
            await tx.invoice.update({
              where: { id: creditNote.invoiceId },
              data: { balance: { increment: total } },
            });
            await tx.customer.update({
              where: { id: creditNote.customerId },
              data: { balance: { increment: total } },
            });
          }

          return tx.creditNote.update({
            where: { id },
            data: { status: 'VOID' },
          });
        });

        return NextResponse.json(result);
      }

      default:
        return badRequest('Invalid action');
    }
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update credit note');
  }
}
