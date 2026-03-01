/**
 * POST /api/employee/pos/orders/[id]/receipt — Send receipt email for a POS order
 *
 * Terminal-auth wrapper. Accepts optional email override; otherwise uses order's email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { sendEmail } from '@/lib/email/service';
import { posReceiptEmail } from '@/lib/email/templates';

type RouteContext = { params: Promise<{ id: string }> };

const sendReceiptSchema = z.object({
  email: z.string().email().optional(),
});

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CASH: 'Cash',
    JAM_DEX: 'JamDEX',
    LYNK_WALLET: 'Lynk Wallet',
    WIPAY: 'WiPay',
    CARD_VISA: 'Visa',
    CARD_MASTERCARD: 'Mastercard',
    CARD_OTHER: 'Card',
    BANK_TRANSFER: 'Bank Transfer',
    STORE_CREDIT: 'Store Credit',
    OTHER: 'Other',
  };
  return map[method] ?? method;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const parsed = sendReceiptSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid email address');
    }

    // Fetch order with items + payments
    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      include: {
        items: { orderBy: { lineNumber: 'asc' } },
        payments: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return notFound('Order not found');

    const recipientEmail = parsed.data.email ?? order.customerEmail;
    if (!recipientEmail) {
      return badRequest('No email address available. Provide one in the request body.');
    }

    // Fetch company details for branding
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { businessName: true, logoUrl: true, currency: true },
    });

    const primaryPayment = order.payments[0];
    const paymentMethodLabel = primaryPayment
      ? formatPaymentMethod(primaryPayment.method)
      : 'N/A';

    const emailContent = posReceiptEmail({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      date: (order.completedAt ?? order.createdAt).toLocaleDateString('en-JM', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      items: order.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.lineTotal),
      })),
      subtotal: Number(order.subtotal),
      discount: Number(order.orderDiscountAmount),
      gctAmount: Number(order.gctAmount),
      total: Number(order.total),
      amountPaid: Number(order.amountPaid),
      changeGiven: Number(order.changeGiven),
      paymentMethod: paymentMethodLabel,
      currency: company?.currency ?? 'JMD',
      companyName: company?.businessName ?? 'Your Business',
      companyLogoUrl: company?.logoUrl ?? undefined,
    });

    const result = await sendEmail({
      to: recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      return internalError(result.error ?? 'Failed to send receipt email');
    }

    // Update audit trail
    await prisma.posOrder.update({
      where: { id },
      data: { receiptEmail: recipientEmail },
    });

    return NextResponse.json({
      success: true,
      email: recipientEmail,
      messageId: result.messageId,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to send receipt');
  }
}
