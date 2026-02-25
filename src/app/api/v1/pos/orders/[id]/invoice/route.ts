/**
 * POST /api/v1/pos/orders/[id]/invoice — Generate an invoice from a completed POS order.
 *
 * Maps POS order data (items, totals, customer) to a formal Invoice record.
 * If the POS order is fully paid the invoice is created as PAID; otherwise SENT.
 * Updates the POS order's invoiceId / invoiceNumber for cross-reference.
 *
 * Requires: `customerId` on the POS order OR in the request body.
 * Walk-in orders without a customer record cannot generate invoices.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const invoiceFromOrderSchema = z.object({
  customerId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  dueDate: z.coerce.date().optional(),
});

/**
 * Map a numeric GCT rate to the enum used by InvoiceItem.
 */
function gctRateToEnum(rate: number): 'STANDARD' | 'TELECOM' | 'TOURISM' | 'ZERO_RATED' | 'EXEMPT' {
  const r = Number(rate);
  if (r === 0) return 'ZERO_RATED';
  if (Math.abs(r - 0.15) < 0.001) return 'STANDARD';
  if (Math.abs(r - 0.25) < 0.001) return 'TELECOM';
  if (Math.abs(r - 0.10) < 0.001) return 'TOURISM';
  return r === 0 ? 'EXEMPT' : 'STANDARD';
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Parse optional body
    const body = await request.json().catch(() => ({}));
    const parsed = invoiceFromOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Fetch the POS order
    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { items: { orderBy: { lineNumber: 'asc' } } },
    });

    if (!order) return notFound('Order not found');

    // Prevent duplicate invoice generation
    if (order.invoiceId) {
      return badRequest(`Invoice already exists for this order: ${order.invoiceNumber}`);
    }

    // Resolve customerId — from request body, then order, else error
    const customerId = parsed.data.customerId ?? order.customerId;
    if (!customerId) {
      return badRequest(
        'Cannot generate invoice for a walk-in order without a customer. ' +
        'Provide a customerId in the request body.',
      );
    }

    // Verify customer exists and belongs to company
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: companyId! },
      select: { id: true, name: true },
    });
    if (!customer) return notFound('Customer not found');

    const isFullyPaid = order.status === 'COMPLETED';
    const now = new Date();

    const invoice = await prisma.$transaction(async (tx) => {
      // Generate invoice number: INV-YYYYMM-XXXX
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const count = await tx.invoice.count({ where: { companyId: companyId! } });
      const seq = String(count + 1).padStart(4, '0');
      const invoiceNumber = `INV-${year}${month}-${seq}`;

      // Map POS order items to invoice items
      const invoiceItems = order.items.map((item, idx) => {
        // Each item's total = lineTotalBeforeTax + gctAmount = lineTotal
        const itemTotal = Number(item.lineTotal);
        return {
          productId: item.productId ?? undefined,
          description: item.name + (item.description ? ` — ${item.description}` : ''),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          gctRate: item.isGctExempt ? ('EXEMPT' as const) : gctRateToEnum(Number(item.gctRate)),
          gctAmount: Number(item.gctAmount),
          total: itemTotal,
          uomId: item.uomId ?? undefined,
          uomShortCode: item.uomCode,
          lineNumber: idx + 1,
        };
      });

      const newInvoice = await tx.invoice.create({
        data: {
          companyId: companyId!,
          invoiceNumber,
          customerId: customer.id,
          subtotal: Number(order.subtotal),
          gctAmount: Number(order.gctAmount),
          discount: Number(order.orderDiscountAmount),
          discountType: order.orderDiscountType ?? 'FIXED',
          total: Number(order.total),
          amountPaid: isFullyPaid ? Number(order.total) : Number(order.amountPaid),
          balance: isFullyPaid ? 0 : Number(order.amountDue),
          status: isFullyPaid ? 'PAID' : 'SENT',
          issueDate: order.completedAt ?? now,
          dueDate: parsed.data.dueDate ?? order.completedAt ?? now,
          paidDate: isFullyPaid ? (order.completedAt ?? now) : null,
          notes: parsed.data.notes ?? `Generated from POS Order ${order.orderNumber}`,
          terms: parsed.data.terms ?? null,
          createdBy: user!.sub,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });

      // Link invoice back to the POS order
      await tx.posOrder.update({
        where: { id },
        data: {
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.invoiceNumber,
        },
      });

      return newInvoice;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate invoice from order');
  }
}
