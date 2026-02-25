/**
 * POST /api/v1/invoices/[id]/payments — Record a manual payment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import Decimal from 'decimal.js';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { postPaymentReceived } from '@/lib/accounting/engine';
import { createNotification } from '@/lib/notification-service';

type RouteContext = { params: Promise<{ id: string }> };

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum([
    'CASH', 'CHEQUE', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'WIPAY',
  ]),
  date: z.coerce.date().optional(),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!invoice) return notFound('Invoice not found');

    // Validate request body
    const body = await request.json();
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const paymentAmount = new Decimal(parsed.data.amount);
    const currentBalance = new Decimal(invoice.balance.toString());

    if (paymentAmount.greaterThan(currentBalance)) {
      return badRequest('Payment amount cannot exceed remaining balance');
    }

    // Atomically create payment + update invoice
    const result = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: paymentAmount.toDecimalPlaces(2).toNumber(),
          paymentMethod: parsed.data.paymentMethod,
          date: parsed.data.date || new Date(),
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
          createdBy: user!.sub,
        },
      });

      const newAmountPaid = new Decimal(invoice.amountPaid.toString()).plus(paymentAmount);
      const newBalance = new Decimal(invoice.total.toString()).minus(newAmountPaid);
      const newStatus = newBalance.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIAL';

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid.toDecimalPlaces(2).toNumber(),
          balance: Decimal.max(newBalance, new Decimal(0)).toDecimalPlaces(2).toNumber(),
          status: newStatus,
          ...(newStatus === 'PAID' ? { paidDate: new Date() } : {}),
        },
        include: { items: true, customer: { select: { id: true, name: true } }, payments: true },
      });

      // Post to general ledger
      await postPaymentReceived({
        companyId: companyId!,
        userId: user!.sub,
        paymentId: payment.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customer?.name ?? 'Customer',
        date: payment.date,
        amount: paymentAmount.toDecimalPlaces(2).toNumber(),
        paymentMethod: parsed.data.paymentMethod,
        tx,
      });

      return { payment, invoice: updatedInvoice };
    });

    // Fire-and-forget notification
    const formatAmount = new Intl.NumberFormat('en-JM', {
      style: 'currency',
      currency: 'JMD',
    }).format(paymentAmount.toDecimalPlaces(2).toNumber());

    createNotification({
      companyId: companyId!,
      type: 'PAYMENT_RECEIVED',
      priority: 'MEDIUM',
      title: 'Payment Received',
      message: `Payment of ${formatAmount} received for invoice ${invoice.invoiceNumber}`,
      link: `/invoices/${id}`,
      relatedId: id,
      relatedType: 'invoice',
    }).catch(() => {});

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to record payment');
  }
}
