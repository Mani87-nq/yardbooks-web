/**
 * POST /api/v1/stock-transfers/[id]/ship — Mark transfer as shipped, deduct from source
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const shipSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantityShipped: z.number().min(0),
  })).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json().catch(() => ({}));
    const parsed = shipSchema.safeParse(body);

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });
    if (!transfer) return notFound('Stock transfer not found');

    if (transfer.status !== 'APPROVED') {
      return badRequest(`Transfer must be APPROVED before shipping. Current status: "${transfer.status}".`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update shipped quantities
      for (const item of transfer.items) {
        const shippedOverride = parsed.data?.items?.find((i) => i.id === item.id);
        const qty = shippedOverride ? shippedOverride.quantityShipped : Number(item.quantityRequested);

        // Update item shipped quantity
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityShipped: qty },
        });

        // Deduct from source product inventory
        if (qty > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: qty } },
          });
        }
      }

      // Update transfer status
      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'IN_TRANSIT',
          shippedBy: user!.sub,
          shippedAt: new Date(),
        },
        include: {
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
          items: true,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to ship transfer');
  }
}
