/**
 * GET  /api/employee/pos/orders/[id]/payments — List payments for an order
 * POST /api/employee/pos/orders/[id]/payments — Add payment, calculate change,
 *      update order status to COMPLETED when fully paid.
 *
 * On completion: deducts inventory, posts GL journal, updates session/shift totals,
 * awards loyalty points.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { postPosOrderCompleted } from '@/lib/accounting/engine';

const POS_PAYMENT_METHODS = [
  'CASH', 'JAM_DEX', 'LYNK_WALLET', 'WIPAY',
  'CARD_VISA', 'CARD_MASTERCARD', 'CARD_OTHER',
  'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER',
] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

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
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

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
          metadata: (parsed.data.metadata as any) ?? undefined,
        },
      });

      // Only update order totals for completed payments
      if (parsed.data.status === 'COMPLETED') {
        const newAmountPaid = Math.round((Number(order.amountPaid) + effectivePayment) * 100) / 100;
        const newAmountDue = Math.round((Number(order.total) - newAmountPaid) * 100) / 100;
        const totalChangeGiven = Math.round((Number(order.changeGiven) + changeGiven) * 100) / 100;
        const isFullyPaid = newAmountDue <= 0;

        let glTransactionId: string | null = null;

        if (isFullyPaid) {
          // 1. Determine cash vs non-cash split from ALL completed payments
          const allPayments = await tx.posPayment.findMany({
            where: { orderId: id, status: 'COMPLETED' },
          });
          let cashTotal = 0;
          let nonCashTotal = 0;
          for (const p of allPayments) {
            const amt = Number(p.amount);
            if (p.method === 'CASH') {
              cashTotal += amt;
            } else {
              nonCashTotal += amt;
            }
          }

          // 2. Inventory deduction + COGS calculation
          let totalCost = 0;
          const orderItems = await tx.posOrderItem.findMany({
            where: { orderId: id },
          });

          for (const item of orderItems) {
            if (item.productId && !item.inventoryDeducted) {
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { costPrice: true, quantity: true },
              });

              if (product) {
                totalCost += Number(item.quantity) * Number(product.costPrice);

                await tx.product.update({
                  where: { id: item.productId },
                  data: { quantity: { decrement: Number(item.quantity) } },
                });

                await tx.posOrderItem.update({
                  where: { id: item.id },
                  data: { inventoryDeducted: true },
                });
              }
            }
          }

          totalCost = Math.round(totalCost * 100) / 100;

          // 3. Post GL journal entry (best-effort)
          try {
            const glResult = await postPosOrderCompleted({
              companyId: companyId!,
              userId: employee!.sub,
              orderId: id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              date: new Date(),
              subtotal: Number(order.subtotal),
              gctAmount: Number(order.gctAmount),
              orderDiscountAmount: Number(order.orderDiscountAmount),
              total: Number(order.total),
              cashAmount: cashTotal,
              nonCashAmount: nonCashTotal,
              totalCost,
              tx,
            });

            if (glResult.success && glResult.journalEntryId) {
              glTransactionId = glResult.journalEntryId;
            }
          } catch {
            console.error(`[Kiosk POS] GL posting failed for order ${order.orderNumber}`);
          }
        }

        const updatedOrder = await tx.posOrder.update({
          where: { id },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue < 0 ? 0 : newAmountDue,
            changeGiven: totalChangeGiven,
            status: isFullyPaid ? 'COMPLETED' : 'PARTIALLY_PAID',
            completedAt: isFullyPaid ? new Date() : null,
            ...(glTransactionId ? { glTransactionId } : {}),
          },
          include: { items: true, payments: true },
        });

        // Record cash movement for ALL cash payments (including split payments)
        if (parsed.data.method === 'CASH' && order.sessionId) {
          await tx.cashMovement.create({
            data: {
              sessionId: order.sessionId,
              type: 'SALE',
              amount: effectivePayment,
              orderId: id,
              performedBy: employee!.sub,
              reason: `Payment for order ${order.orderNumber}`,
            },
          });

          await tx.posSession.update({
            where: { id: order.sessionId },
            data: {
              expectedCash: {
                increment: Math.round((effectivePayment - changeGiven) * 100) / 100,
              },
            },
          });
        }

        // Update session totalSales if order is now completed
        if (isFullyPaid && order.sessionId) {
          await tx.posSession.update({
            where: { id: order.sessionId },
            data: {
              totalSales: { increment: Number(order.total) },
              netSales: { increment: Number(order.total) },
            },
          });
        }

        // Update Shift totalSales for the employee
        if (isFullyPaid && order.createdBy) {
          await (tx as any).shift.updateMany({
            where: {
              employeeProfileId: order.createdBy,
              status: 'ACTIVE',
              companyId: companyId!,
            },
            data: {
              totalSales: { increment: Number(order.total) },
              transactionCount: { increment: 1 },
            },
          });
        }

        // Award loyalty points inside the transaction (best-effort)
        if (isFullyPaid && order.customerId) {
          try {
            const memberships = await (tx as any).loyaltyMember.findMany({
              where: { customerId: order.customerId, status: 'ACTIVE' },
              include: { program: true },
            });

            const orderTotal = Number(order.total);
            for (const member of memberships) {
              if (member.program?.isActive) {
                const points = Math.floor(
                  orderTotal * Number(member.program.pointsPerDollar)
                );
                if (points > 0) {
                  const currentBalance = member.pointsBalance || 0;

                  await (tx as any).loyaltyTransaction.create({
                    data: {
                      memberId: member.id,
                      loyaltyProgramId: member.loyaltyProgramId,
                      type: 'EARN',
                      points,
                      balanceAfter: currentBalance + points,
                      description: `Purchase #${order.orderNumber}`,
                      orderId: id,
                      companyId: companyId!,
                    },
                  });

                  await (tx as any).loyaltyMember.update({
                    where: { id: member.id },
                    data: {
                      pointsBalance: { increment: points },
                      lifetimePoints: { increment: points },
                      lastActivityAt: new Date(),
                    },
                  });
                }
              }
            }
          } catch (loyaltyErr) {
            console.error(
              `[Kiosk POS] Loyalty points failed for order ${order.orderNumber}:`,
              loyaltyErr
            );
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
