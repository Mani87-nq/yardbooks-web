/**
 * GET  /api/v1/pos/orders/[id]/payments — List payments for an order
 * POST /api/v1/pos/orders/[id]/payments — Add payment, calculate change for cash,
 *      update order status to COMPLETED when fully paid
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

const POS_PAYMENT_METHODS = [
  'CASH', 'JAM_DEX', 'LYNK_WALLET', 'WIPAY',
  'CARD_VISA', 'CARD_MASTERCARD', 'CARD_OTHER',
  'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER',
] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Verify order exists and belongs to company
    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      select: { id: true },
    });
    if (!order) return notFound('Order not found');

    const payments = await prisma.posPayment.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: payments });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list payments');
  }
}

const createPaymentSchema = z.object({
  method: z.enum(POS_PAYMENT_METHODS),
  amount: z.number().positive(),
  reference: z.string().max(200).optional(),
  providerName: z.string().max(100).optional(),
  authorizationCode: z.string().max(100).optional(),
  amountTendered: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED']).default('COMPLETED'),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify order exists and is payable
    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!order) return notFound('Order not found');

    if (['COMPLETED', 'VOIDED', 'REFUNDED'].includes(order.status)) {
      return badRequest(`Cannot add payment to an order with status ${order.status}`);
    }

    const paymentAmount = Number(parsed.data.amount);
    const currentAmountDue = Number(order.amountDue);

    if (currentAmountDue <= 0) {
      return badRequest('Order is already fully paid');
    }

    // For cash payments, calculate change
    let changeGiven = 0;
    let amountTendered: number | null = null;
    const effectivePayment = paymentAmount > currentAmountDue ? currentAmountDue : paymentAmount;

    if (parsed.data.method === 'CASH') {
      amountTendered = parsed.data.amountTendered
        ? Number(parsed.data.amountTendered)
        : paymentAmount;

      if (amountTendered < paymentAmount) {
        return badRequest('Amount tendered cannot be less than payment amount');
      }

      // Change = tendered - remaining due (only if tendered > remaining)
      if (amountTendered > currentAmountDue) {
        changeGiven = Math.round((amountTendered - currentAmountDue) * 100) / 100;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.posPayment.create({
        data: {
          orderId: id,
          method: parsed.data.method,
          amount: effectivePayment,
          reference: parsed.data.reference ?? null,
          providerName: parsed.data.providerName ?? null,
          authorizationCode: parsed.data.authorizationCode ?? null,
          status: parsed.data.status,
          processedAt: parsed.data.status === 'COMPLETED' ? new Date() : null,
          amountTendered: amountTendered ?? null,
          changeGiven: changeGiven > 0 ? changeGiven : null,
          metadata: parsed.data.metadata ?? null,
        },
      });

      // Only update order totals for completed payments
      if (parsed.data.status === 'COMPLETED') {
        const newAmountPaid = Math.round((Number(order.amountPaid) + effectivePayment) * 100) / 100;
        const newAmountDue = Math.round((Number(order.total) - newAmountPaid) * 100) / 100;
        const totalChangeGiven = Math.round((Number(order.changeGiven) + changeGiven) * 100) / 100;
        const isFullyPaid = newAmountDue <= 0;

        const updatedOrder = await tx.posOrder.update({
          where: { id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue < 0 ? 0 : newAmountDue,
            changeGiven: totalChangeGiven,
            status: isFullyPaid ? 'COMPLETED' : 'PARTIALLY_PAID',
            completedAt: isFullyPaid ? new Date() : null,
          },
          include: { items: true, payments: true },
        });

        // Update session totalSales if the order belongs to a session and is now completed
        if (isFullyPaid && order.sessionId) {
          await tx.posSession.update({
            where: { id: order.sessionId },
            data: {
              totalSales: { increment: Number(order.total) },
              netSales: { increment: Number(order.total) },
            },
          });

          // Record cash movement for cash payments
          if (parsed.data.method === 'CASH') {
            await tx.cashMovement.create({
              data: {
                sessionId: order.sessionId,
                type: 'SALE',
                amount: effectivePayment,
                orderId: id,
                performedBy: user!.sub,
                reason: `Payment for order ${order.orderNumber}`,
              },
            });

            // Update expected cash on session
            await tx.posSession.update({
              where: { id: order.sessionId },
              data: {
                expectedCash: {
                  increment: Math.round((effectivePayment - changeGiven) * 100) / 100,
                },
              },
            });
          }
        }

        return { payment, order: updatedOrder };
      }

      return { payment, order };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to add payment');
  }
}
