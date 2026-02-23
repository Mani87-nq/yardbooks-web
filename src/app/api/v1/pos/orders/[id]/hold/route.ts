/**
 * POST /api/v1/pos/orders/[id]/hold — Hold order for later (requires heldReason)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
type RouteContext = { params: Promise<{ id: string }> };

const holdOrderSchema = z.object({
  heldReason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = holdOrderSchema.safeParse(body);
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
    });
    if (!order) return notFound('Order not found');

    // Only allow holding orders in specific statuses
    const holdableStatuses = ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'];
    if (!holdableStatuses.includes(order.status)) {
      return badRequest(
        `Cannot hold an order with status ${order.status}. Only orders in DRAFT, PENDING_PAYMENT, or PARTIALLY_PAID status can be held.`
      );
    }

    if (order.status === 'HELD') {
      return badRequest('Order is already on hold');
    }

    const heldOrder = await prisma.posOrder.update({
      where: { id },
      data: {
        status: 'HELD',
        heldReason: parsed.data.heldReason,
      },
      include: { items: true, payments: true },
    });

    return NextResponse.json(heldOrder);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to hold order');
  }
}
