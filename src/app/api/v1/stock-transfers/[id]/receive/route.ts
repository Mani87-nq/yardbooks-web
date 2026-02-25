/**
 * POST /api/v1/stock-transfers/[id]/receive — Mark transfer as received, add to destination inventory
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const receiveSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantityReceived: z.number().min(0),
    notes: z.string().optional(),
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
    const parsed = receiveSchema.safeParse(body);

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });
    if (!transfer) return notFound('Stock transfer not found');

    if (transfer.status !== 'IN_TRANSIT') {
      return badRequest(`Transfer must be IN_TRANSIT to receive. Current status: "${transfer.status}".`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update received quantities and add to destination inventory
      for (const item of transfer.items) {
        const receivedOverride = parsed.data?.items?.find((i) => i.id === item.id);
        const qty = receivedOverride
          ? receivedOverride.quantityReceived
          : Number(item.quantityShipped ?? item.quantityRequested);

        // Update item received quantity
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: qty,
            ...(receivedOverride?.notes ? { notes: receivedOverride.notes } : {}),
          },
        });

        // Add to destination product inventory
        if (qty > 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: qty } },
          });
        }
      }

      // Update transfer status
      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedBy: user!.sub,
          receivedAt: new Date(),
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
    return internalError(error instanceof Error ? error.message : 'Failed to receive transfer');
  }
}
