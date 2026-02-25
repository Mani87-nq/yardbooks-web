/**
 * POST /api/v1/invoices/[id]/send
 * Sends an invoice email to the specified recipient.
 * Updates invoice status to SENT if currently DRAFT.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { sendEmail } from '@/lib/email/service';
import { invoiceEmail } from '@/lib/email/templates';

type RouteContext = { params: Promise<{ id: string }> };

const sendInvoiceSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500).optional(),
  message: z.string().max(5000).optional(),
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
      include: {
        customer: { select: { id: true, name: true, email: true } },
        company: { select: { businessName: true, tradingName: true, currency: true, email: true, logoUrl: true } },
      },
    });

    if (!invoice) return notFound('Invoice not found');

    const body = await request.json();
    const parsed = sendInvoiceSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid email parameters');

    const { to, subject } = parsed.data;
    const companyName = invoice.company.tradingName || invoice.company.businessName;
    const currency = invoice.company.currency || 'JMD';

    // Build email using the invoiceEmail template with tenant branding
    const emailContent = invoiceEmail({
      customerName: invoice.customer?.name || 'Valued Customer',
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.total),
      currency,
      dueDate: invoice.dueDate.toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' }),
      companyName,
      companyLogoUrl: invoice.company.logoUrl || undefined,
    });

    const result = await sendEmail({
      to,
      subject: subject || emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      replyTo: invoice.company.email || user!.email,
    });

    if (!result.success) {
      return internalError(`Email delivery failed: ${result.error}`);
    }

    // Update invoice status to SENT if currently DRAFT
    if (invoice.status === 'DRAFT') {
      await prisma.invoice.update({
        where: { id },
        data: { status: 'SENT' },
      });
    }

    return NextResponse.json({
      message: `Invoice sent to ${to}`,
      messageId: result.messageId,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to send invoice');
  }
}
