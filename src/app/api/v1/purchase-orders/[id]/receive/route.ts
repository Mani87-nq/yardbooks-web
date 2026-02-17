/**
 * POST /api/v1/purchase-orders/[id]/receive — Create a Goods Received Note
 *
 * Creates a GRN against the purchase order, updates PO item receivedQty,
 * and transitions PO status to PARTIAL or RECEIVED as appropriate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

type RouteContext = { params: Promise<{ id: string }> };

const grnItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  quantityReceived: z.number().positive(),
  quantityAccepted: z.number().min(0),
  quantityRejected: z.number().min(0).default(0),
  rejectionReason: z.string().max(500).optional(),
});

const createGRNSchema = z.object({
  grnNumber: z.string().min(1).max(50),
  receivedDate: z.string().date(),
  receivedBy: z.string().max(200).optional(),
  items: z.array(grnItemSchema).min(1),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Load the PO with its items
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });

    if (!purchaseOrder) return notFound('Purchase order not found');

    // Cannot receive against CANCELLED or DRAFT POs
    if (purchaseOrder.status === 'CANCELLED') {
      return badRequest('Cannot receive goods against a cancelled purchase order');
    }
    if (purchaseOrder.status === 'DRAFT') {
      return badRequest('Cannot receive goods against a draft purchase order. Send the PO first.');
    }

    const body = await request.json();
    const parsed = createGRNSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items: grnItems, receivedDate, ...grnData } = parsed.data;

    // Validate that accepted + rejected = received for each item
    for (let i = 0; i < grnItems.length; i++) {
      const item = grnItems[i];
      if (item.quantityAccepted + item.quantityRejected !== item.quantityReceived) {
        return badRequest(
          `Item ${i + 1}: quantityAccepted (${item.quantityAccepted}) + quantityRejected (${item.quantityRejected}) must equal quantityReceived (${item.quantityReceived})`,
        );
      }
    }

    // Execute everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the GRN
      const grn = await tx.goodsReceivedNote.create({
        data: {
          ...grnData,
          companyId: companyId!,
          purchaseOrderId: id,
          receivedDate: new Date(receivedDate),
          receivedBy: grnData.receivedBy ?? user!.sub,
          items: {
            create: grnItems.map((item) => ({
              productId: item.productId ?? null,
              description: item.description,
              quantityReceived: item.quantityReceived,
              quantityAccepted: item.quantityAccepted,
              quantityRejected: item.quantityRejected,
              rejectionReason: item.rejectionReason ?? null,
            })),
          },
        },
        include: { items: true },
      });

      // Update receivedQty on PO items that match by productId
      for (const grnItem of grnItems) {
        if (grnItem.productId) {
          const poItem = purchaseOrder.items.find(
            (pi) => pi.productId === grnItem.productId,
          );
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                receivedQty: new Decimal(Number(poItem.receivedQty) + grnItem.quantityAccepted),
              },
            });
          }
        }
      }

      // Reload PO items to determine new status
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      // Determine new PO status
      const allFullyReceived = updatedItems.every(
        (item) => Number(item.receivedQty) >= Number(item.quantity),
      );
      const anyReceived = updatedItems.some(
        (item) => Number(item.receivedQty) > 0,
      );

      let newStatus = purchaseOrder.status;
      if (allFullyReceived) {
        newStatus = 'RECEIVED';
      } else if (anyReceived) {
        newStatus = 'PARTIAL';
      }

      if (newStatus !== purchaseOrder.status) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      return { grn, newStatus };
    });

    return NextResponse.json(
      {
        goodsReceivedNote: result.grn,
        purchaseOrderStatus: result.newStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    // Handle unique constraint violation on grnNumber
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return badRequest('A GRN with this number already exists for this company');
    }
    return internalError(
      error instanceof Error ? error.message : 'Failed to create goods received note',
    );
  }
}
