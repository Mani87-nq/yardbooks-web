/**
 * GET    /api/v1/purchase-orders/[id] — Get PO details with items
 * PUT    /api/v1/purchase-orders/[id] — Update a PO
 * DELETE /api/v1/purchase-orders/[id] — Cancel a PO (set status to CANCELLED)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: companyId! },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        goodsReceivedNotes: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!purchaseOrder) return notFound('Purchase order not found');
    return NextResponse.json(purchaseOrder);
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to get purchase order',
    );
  }
}

const updateItemSchema = z.object({
  id: z.string().optional(), // Existing item ID for updates
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  sku: z.string().max(50).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const updatePOSchema = z.object({
  vendorName: z.string().min(1).max(200).optional(),
  vendorId: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT']).optional(),
  orderDate: z.string().date().optional(),
  expectedDate: z.string().date().optional(),
  items: z.array(updateItemSchema).min(1).optional(),
  taxAmount: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });
    if (!existing) return notFound('Purchase order not found');

    // Only DRAFT or SENT POs can be edited
    if (!['DRAFT', 'SENT'].includes(existing.status)) {
      return badRequest(
        `Cannot update a purchase order with status "${existing.status}". Only DRAFT and SENT orders can be edited.`,
      );
    }

    const body = await request.json();
    const parsed = updatePOSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items, orderDate, expectedDate, ...rest } = parsed.data;

    // If items are provided, recalculate totals and replace all items
    const updateData: Record<string, unknown> = { ...rest };

    if (orderDate) updateData.orderDate = new Date(orderDate);
    if (expectedDate) updateData.expectedDate = new Date(expectedDate);

    if (items) {
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const taxAmount =
        rest.taxAmount !== undefined
          ? rest.taxAmount
          : Number(existing.taxAmount);
      updateData.subtotal = subtotal;
      updateData.total = subtotal + taxAmount;

      // Delete old items and create new ones in a transaction
      const purchaseOrder = await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            ...updateData,
            items: {
              create: items.map((item) => ({
                productId: item.productId ?? null,
                description: item.description,
                sku: item.sku ?? null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.quantity * item.unitPrice,
              })),
            },
          },
          include: { items: true },
        });
      });

      return NextResponse.json(purchaseOrder);
    }

    // No items update - just update header fields
    if (rest.taxAmount !== undefined) {
      updateData.total = Number(existing.subtotal) + rest.taxAmount;
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to update purchase order',
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'inventory:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Purchase order not found');

    if (existing.status === 'CANCELLED') {
      return badRequest('Purchase order is already cancelled');
    }

    // Set status to CANCELLED rather than hard-deleting
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to cancel purchase order',
    );
  }
}
