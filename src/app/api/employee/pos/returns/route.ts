/**
 * GET  /api/employee/pos/returns — List returns (paginated)
 * POST /api/employee/pos/returns — Process a return: refund, restock, GL reversal
 *
 * Permission check: employee.permissions.canRefund
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, forbidden, internalError } from '@/lib/api-error';
import { postPosReturnCompleted } from '@/lib/accounting/engine';

// ── GET: List Returns ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const status = searchParams.get('status') ?? undefined;
    const orderId = searchParams.get('orderId') ?? undefined;
    const sessionId = searchParams.get('sessionId') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(orderId ? { originalOrderId: orderId } : {}),
      ...(sessionId ? { sessionId } : {}),
    };

    const returns = await prisma.posReturn.findMany({
      where,
      include: {
        items: true,
        originalOrder: {
          select: { orderNumber: true, customerName: true, total: true },
        },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = returns.length > limit;
    const data = hasMore ? returns.slice(0, limit) : returns;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list returns');
  }
}

// ── POST: Process Return ──────────────────────────────────────────────

const RETURN_REASONS = [
  'DEFECTIVE', 'WRONG_ITEM', 'CUSTOMER_CHANGED_MIND',
  'DAMAGED', 'OVERCHARGED', 'DUPLICATE', 'OTHER',
] as const;

const REFUND_METHODS = ['CASH', 'ORIGINAL_METHOD', 'STORE_CREDIT'] as const;

const returnItemSchema = z.object({
  orderItemId: z.string().min(1),
  productId: z.string().optional(),
  name: z.string().min(1).max(300),
  quantityReturned: z.number().positive(),
  unitPrice: z.number().min(0),
  refundAmount: z.number().min(0),
  returnReason: z.enum(RETURN_REASONS),
  reasonNotes: z.string().max(500).optional(),
  condition: z.enum(['resellable', 'damaged', 'defective']).default('resellable'),
  restockItem: z.boolean().default(true),
});

const createReturnSchema = z.object({
  orderId: z.string().min(1),
  sessionId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().max(200).default('Walk-in Customer'),
  items: z.array(returnItemSchema).min(1),
  refundMethod: z.enum(REFUND_METHODS),
  returnReason: z.enum(RETURN_REASONS),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    // Permission check
    const permissions = employee!.permissions as Record<string, unknown>;
    if (!permissions?.canRefund) {
      return forbidden('You do not have permission to process returns. Manager override required.');
    }

    const body = await request.json();
    const parsed = createReturnSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items, ...returnData } = parsed.data;

    // Fetch the original order
    const order = await prisma.posOrder.findFirst({
      where: { id: returnData.orderId, companyId: companyId! },
      include: { items: true },
    });

    if (!order) return badRequest('Original order not found');
    if (!['COMPLETED', 'REFUNDED'].includes(order.status)) {
      return badRequest(`Cannot return items from an order with status ${order.status}`);
    }

    // Calculate totals — use per-item GCT exemption from original order items
    const orderGctRate = Number(order.gctRate);
    let subtotal = 0;
    let gctAmount = 0;
    for (const returnItem of items) {
      subtotal += returnItem.refundAmount;
      const originalItem = order.items.find((oi) => oi.id === returnItem.orderItemId);
      const isExempt = originalItem?.isGctExempt ?? false;
      if (!isExempt) {
        gctAmount += Math.round(returnItem.refundAmount * orderGctRate * 100) / 100;
      }
    }
    subtotal = Math.round(subtotal * 100) / 100;
    gctAmount = Math.round(gctAmount * 100) / 100;
    const totalRefund = Math.round((subtotal + gctAmount) * 100) / 100;

    const result = await prisma.$transaction(async (tx) => {
      const returnNumber = `RTN-${Date.now().toString(36).toUpperCase()}`;

      const posReturn = await tx.posReturn.create({
        data: {
          companyId: companyId!,
          returnNumber,
          originalOrderId: order.id,
          originalOrderNumber: order.orderNumber,
          sessionId: returnData.sessionId ?? order.sessionId ?? null,
          customerId: returnData.customerId ?? order.customerId ?? null,
          customerName: returnData.customerName || order.customerName,
          subtotal,
          gctAmount,
          totalRefund,
          refundMethod: returnData.refundMethod,
          returnReason: returnData.returnReason,
          notes: returnData.notes ?? null,
          status: 'COMPLETED',
          processedBy: employee!.sub,
          completedAt: new Date(),
          items: {
            create: items.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId ?? null,
              name: item.name,
              quantityReturned: item.quantityReturned,
              unitPrice: item.unitPrice,
              refundAmount: item.refundAmount,
              returnReason: item.returnReason,
              reasonNotes: item.reasonNotes ?? null,
              condition: item.condition,
              restockItem: item.restockItem,
              inventoryRestocked: false,
            })),
          },
        },
        include: { items: true },
      });

      // Inventory restock
      let totalRestockCost = 0;
      for (const item of posReturn.items) {
        if (item.restockItem && item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { costPrice: true },
          });

          if (product) {
            totalRestockCost += Number(item.quantityReturned) * Number(product.costPrice);

            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: Number(item.quantityReturned) } },
            });

            await tx.posReturnItem.update({
              where: { id: item.id },
              data: { inventoryRestocked: true },
            });
          }
        }
      }

      totalRestockCost = Math.round(totalRestockCost * 100) / 100;

      // Update order status
      const allReturns = await tx.posReturn.findMany({
        where: { originalOrderId: order.id, status: 'COMPLETED' },
        select: { totalRefund: true },
      });
      const totalRefunded = allReturns.reduce((sum, r) => sum + Number(r.totalRefund), 0);
      const orderIsFullyRefunded = totalRefunded >= Number(order.total);

      await tx.posOrder.update({
        where: { id: order.id },
        data: {
          status: orderIsFullyRefunded ? 'REFUNDED' : order.status,
          refundReason: returnData.notes ?? `Return ${returnNumber}`,
        },
      });

      // Cash movement for cash refunds
      const sessionId = returnData.sessionId ?? order.sessionId;
      if (returnData.refundMethod === 'CASH' && sessionId) {
        await tx.cashMovement.create({
          data: {
            sessionId,
            type: 'REFUND',
            amount: totalRefund,
            orderId: order.id,
            performedBy: employee!.sub,
            reason: `Refund for ${returnNumber} on order ${order.orderNumber}`,
          },
        });

        await tx.posSession.update({
          where: { id: sessionId },
          data: {
            expectedCash: { decrement: totalRefund },
          },
        });
      }

      // GL journal entry (best-effort)
      try {
        const glResult = await postPosReturnCompleted({
          companyId: companyId!,
          userId: employee!.sub,
          returnId: posReturn.id,
          returnNumber,
          orderNumber: order.orderNumber,
          customerName: posReturn.customerName,
          date: new Date(),
          subtotal,
          gctAmount,
          totalRefund,
          refundMethod: returnData.refundMethod,
          totalRestockCost,
          tx,
        });

        if (glResult.success && glResult.journalEntryId) {
          await tx.posReturn.update({
            where: { id: posReturn.id },
            data: { glTransactionId: glResult.journalEntryId },
          });
        }
      } catch {
        console.error(`[Kiosk POS] GL posting failed for return ${returnNumber}`);
      }

      return tx.posReturn.findUniqueOrThrow({
        where: { id: posReturn.id },
        include: { items: true },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to process return');
  }
}
