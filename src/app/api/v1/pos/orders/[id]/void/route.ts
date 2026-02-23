/**
 * POST /api/v1/pos/orders/[id]/void — Void an order (requires voidReason)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
type RouteContext = { params: Promise<{ id: string }> };

const voidOrderSchema = z.object({
  voidReason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:void');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = voidOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { payments: true },
    });
    if (!order) return notFound('Order not found');

    if (order.status === 'VOIDED') {
      return badRequest('Order is already voided');
    }
    if (order.status === 'REFUNDED') {
      return badRequest('Cannot void a refunded order');
    }

    const voidedOrder = await prisma.$transaction(async (tx) => {
      // Cancel all pending payments
      await tx.posPayment.updateMany({
        where: { orderId: id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'CANCELLED' },
      });

      // Update order status
      const updated = await tx.posOrder.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: parsed.data.voidReason,
          amountDue: 0,
        },
        include: { items: true, payments: true },
      });

      // If this was a completed order with a session, update session totals
      if (order.sessionId && order.status === 'COMPLETED') {
        const orderTotal = Number(order.total);

        await tx.posSession.update({
          where: { id: order.sessionId },
          data: {
            totalVoids: { increment: orderTotal },
            netSales: { decrement: orderTotal },
          },
        });

        // If there were cash payments, reverse them from expected cash
        const cashPayments = order.payments.filter(
          (p) => p.method === 'CASH' && p.status === 'COMPLETED'
        );
        const totalCashReceived = cashPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );
        const totalCashChange = cashPayments.reduce(
          (sum, p) => sum + (p.changeGiven ? Number(p.changeGiven) : 0),
          0
        );
        const netCash = Math.round((totalCashReceived - totalCashChange) * 100) / 100;

        if (netCash > 0) {
          await tx.cashMovement.create({
            data: {
              sessionId: order.sessionId,
              type: 'ADJUSTMENT',
              amount: -netCash,
              orderId: id,
              performedBy: user!.sub,
              reason: `Void order ${order.orderNumber}: ${parsed.data.voidReason}`,
            },
          });

          await tx.posSession.update({
            where: { id: order.sessionId },
            data: {
              expectedCash: { decrement: netCash },
            },
          });
        }
      }

      return updated;
    });

    return NextResponse.json(voidedOrder);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to void order');
  }
}
