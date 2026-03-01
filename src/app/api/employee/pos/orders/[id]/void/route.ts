/**
 * POST /api/employee/pos/orders/[id]/void — Void an order
 *
 * Permission check: employee.permissions.canVoid — if false, returns 403.
 * UI should trigger ManagerOverrideModal before calling this route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, badRequest, forbidden, internalError } from '@/lib/api-error';
// GL reversal is handled inline since no dedicated void function exists

type RouteContext = { params: Promise<{ id: string }> };

const voidOrderSchema = z.object({
  voidReason: z.string().min(1).max(500),
  overrideApproved: z.boolean().optional(), // True if manager override was obtained
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    // Permission check
    const permissions = employee!.permissions as Record<string, unknown>;
    if (!permissions?.canVoid) {
      return forbidden('You do not have permission to void orders. Manager override required.');
    }

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
      include: { payments: true, items: true },
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

      // If completed order, restock inventory and reverse financials
      if (order.status === 'COMPLETED') {
        // Restock inventory for all deducted items
        for (const item of order.items) {
          if (item.productId && item.inventoryDeducted) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: Number(item.quantity) } },
            });

            await tx.posOrderItem.update({
              where: { id: item.id },
              data: { inventoryDeducted: false },
            });
          }
        }

        // Update session totals
        if (order.sessionId) {
          const orderTotal = Number(order.total);

          await tx.posSession.update({
            where: { id: order.sessionId },
            data: {
              totalVoids: { increment: orderTotal },
              netSales: { decrement: orderTotal },
            },
          });

          // Reverse cash from expected cash
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
                performedBy: employee!.sub,
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

        // Reverse GL journal entry (best-effort) — void the original journal
        if (order.glTransactionId) {
          try {
            await tx.journalEntry.update({
              where: { id: order.glTransactionId },
              data: {
                isReversed: true,
              },
            });
          } catch {
            console.error(`[Kiosk POS] GL reversal failed for void ${order.orderNumber}`);
          }
        }
      }

      return updated;
    });

    return NextResponse.json(voidedOrder);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to void order');
  }
}
