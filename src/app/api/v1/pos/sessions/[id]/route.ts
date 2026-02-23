/**
 * GET /api/v1/pos/sessions/[id] — Get session with orders summary
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const session = await prisma.posSession.findFirst({
      where: { id, companyId: companyId! },
      include: {
        terminal: { select: { id: true, name: true, location: true } },
        cashMovements: {
          orderBy: { performedAt: 'desc' },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            createdAt: true,
            completedAt: true,
            itemCount: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!session) return notFound('Session not found');

    // Build summary
    const ordersSummary = {
      totalOrders: session.orders.length,
      completedOrders: session.orders.filter((o) => o.status === 'COMPLETED').length,
      voidedOrders: session.orders.filter((o) => o.status === 'VOIDED').length,
      heldOrders: session.orders.filter((o) => o.status === 'HELD').length,
      pendingOrders: session.orders.filter((o) =>
        ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'].includes(o.status)
      ).length,
    };

    return NextResponse.json({ ...session, ordersSummary });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get session');
  }
}
