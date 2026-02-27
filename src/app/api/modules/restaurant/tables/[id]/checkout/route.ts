/**
 * POST /api/modules/restaurant/tables/[id]/checkout — Generate bill, process payment, close table
 *
 * This route handles the full checkout flow for a restaurant table:
 *   1. Calculates the bill from the table session's kitchen orders
 *   2. Applies tip (fixed amount or percentage)
 *   3. Updates the TableSession with payment totals and closes it
 *   4. Sets the RestaurantTable status back to AVAILABLE
 *   5. Returns a bill summary
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const checkoutSchema = z.object({
  paymentMethod: z
    .enum([
      'CASH',
      'JAM_DEX',
      'LYNK_WALLET',
      'WIPAY',
      'CARD_VISA',
      'CARD_MASTERCARD',
      'CARD_OTHER',
      'BANK_TRANSFER',
      'OTHER',
    ])
    .default('CASH'),
  tipAmount: z.number().min(0).optional(),
  tipPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(
      request,
      'restaurant:tables:update'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { error: modErr } = await requireModule(companyId!, 'restaurant');
    if (modErr) return modErr;

    // 1. Fetch table and its active session with kitchen orders
    const table = await (prisma as any).restaurantTable.findFirst({
      where: { id, companyId: companyId!, isActive: true },
      include: {
        sessions: {
          where: { status: { in: ['ACTIVE', 'BILL_REQUESTED'] } },
          take: 1,
          orderBy: { seatedAt: 'desc' },
          include: {
            kitchenOrders: {
              where: { status: { not: 'CANCELLED' } },
              include: {
                items: {
                  where: { status: { not: 'CANCELLED' } },
                  include: {
                    menuItem: {
                      select: { id: true, name: true, price: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!table) return notFound('Table not found');

    const session = table.sessions[0];
    if (!session) {
      return conflict('No active session on this table. The table may already be cleared.');
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { paymentMethod, tipAmount: rawTipAmount, tipPercentage, notes } = parsed.data;

    // 3. Calculate subtotal from kitchen order items
    let subtotal = 0;
    const billItems: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const order of session.kitchenOrders) {
      for (const item of order.items) {
        const unitPrice = item.menuItem ? Number(item.menuItem.price) : 0;
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;

        billItems.push({
          name: item.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        });
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // 4. Calculate tax (GCT - standard 15% for Jamaica)
    const gctRate = 0.15;
    const taxAmount = Math.round(subtotal * gctRate * 100) / 100;

    // 5. Calculate tip
    let tipFinal = 0;
    if (rawTipAmount !== undefined && rawTipAmount > 0) {
      tipFinal = Math.round(rawTipAmount * 100) / 100;
    } else if (tipPercentage !== undefined && tipPercentage > 0) {
      tipFinal = Math.round(subtotal * (tipPercentage / 100) * 100) / 100;
    }

    // 6. Calculate total
    const total = Math.round((subtotal + taxAmount + tipFinal) * 100) / 100;

    // 7. Run everything in a transaction
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Update the TableSession with final totals and close it
      const updatedSession = await tx.tableSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          subtotal,
          taxAmount,
          tipAmount: tipFinal,
          total,
          closedAt: new Date(),
          notes: notes
            ? session.notes
              ? `${session.notes}\n${notes}`
              : notes
            : session.notes,
        },
      });

      // Set table status back to AVAILABLE
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'AVAILABLE' },
      });

      // Mark all kitchen orders for this session as SERVED if they are READY
      await tx.kitchenOrder.updateMany({
        where: {
          tableSessionId: session.id,
          status: { in: ['PENDING', 'PREPARING', 'READY'] },
        },
        data: { status: 'SERVED', servedAt: new Date() },
      });

      return updatedSession;
    });

    // 8. Return the bill summary
    const billSummary = {
      tableNumber: table.number,
      tableSection: table.section,
      sessionId: session.id,
      guestCount: session.guestCount,
      seatedAt: session.seatedAt,
      closedAt: result.closedAt,

      // Itemized bill
      items: billItems,
      itemCount: billItems.reduce((sum, item) => sum + item.quantity, 0),

      // Totals
      subtotal,
      taxRate: gctRate,
      taxAmount,
      tipAmount: tipFinal,
      total,

      // Payment
      paymentMethod,
      status: 'CLOSED',

      // Kitchen order summary
      kitchenOrderCount: session.kitchenOrders.length,
    };

    return NextResponse.json(billSummary, { status: 200 });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to process checkout'
    );
  }
}
