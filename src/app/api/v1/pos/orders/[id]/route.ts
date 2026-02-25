/**
 * GET /api/v1/pos/orders/[id] — Get single order with items + payments
 * PUT /api/v1/pos/orders/[id] — Update order/items
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
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const order = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      include: {
        items: { orderBy: { lineNumber: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return notFound('Order not found');

    return NextResponse.json(order);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get order');
  }
}

const updateOrderItemSchema = z.object({
  id: z.string().optional(), // existing item id for updates
  productId: z.string().optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  name: z.string().min(1).max(300),
  description: z.string().max(500).optional(),
  quantity: z.number().positive(),
  uomCode: z.string().min(1).max(20).default('EA'),
  uomId: z.string().optional(),
  uomName: z.string().max(50).optional(),
  unitPrice: z.number().min(0),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  discountValue: z.number().min(0).optional(),
  isGctExempt: z.boolean().default(false),
  gctRate: z.number().min(0).max(1).optional(),
  warehouseId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const updateOrderSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().max(50).optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  items: z.array(updateOrderItemSchema).min(1).optional(),
  orderDiscountType: z.enum(['FIXED', 'PERCENTAGE']).optional().nullable(),
  orderDiscountValue: z.number().min(0).optional().nullable(),
  orderDiscountReason: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.posOrder.findFirst({
      where: { id, companyId: companyId! },
      include: { items: true },
    });
    if (!existing) return notFound('Order not found');

    // Only allow updates on editable statuses
    if (['COMPLETED', 'VOIDED', 'REFUNDED'].includes(existing.status)) {
      return badRequest(`Cannot update an order with status ${existing.status}`);
    }

    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items: newItems, ...orderUpdates } = parsed.data;

    // Get POS settings for gctRate
    const settings = await prisma.posSettings.findUnique({
      where: { companyId: companyId! },
    });
    const defaultGctRate = settings ? Number(settings.gctRate) : 0.15;

    const order = await prisma.$transaction(async (tx) => {
      // If items are provided, recalculate everything
      if (newItems && newItems.length > 0) {
        // Delete existing items and recreate
        await tx.posOrderItem.deleteMany({ where: { orderId: id } });

        const calculatedItems = newItems.map((item, index) => {
          const qty = Number(item.quantity);
          const price = Number(item.unitPrice);
          const lineSubtotal = Math.round(qty * price * 100) / 100;

          let discountAmount = 0;
          if (item.discountType && item.discountValue) {
            if (item.discountType === 'PERCENTAGE') {
              discountAmount = Math.round(lineSubtotal * (Number(item.discountValue) / 100) * 100) / 100;
            } else {
              discountAmount = Number(item.discountValue);
            }
          }

          const lineTotalBeforeTax = Math.round((lineSubtotal - discountAmount) * 100) / 100;
          const itemGctRate = item.isGctExempt ? 0 : (item.gctRate ?? defaultGctRate);
          const gctAmount = Math.round(lineTotalBeforeTax * Number(itemGctRate) * 100) / 100;
          const lineTotal = Math.round((lineTotalBeforeTax + gctAmount) * 100) / 100;

          return {
            orderId: id,
            lineNumber: index + 1,
            productId: item.productId ?? null,
            sku: item.sku ?? null,
            barcode: item.barcode ?? null,
            name: item.name,
            description: item.description ?? null,
            quantity: item.quantity,
            uomCode: item.uomCode,
            uomId: item.uomId ?? null,
            uomName: item.uomName ?? null,
            unitPrice: item.unitPrice,
            lineSubtotal,
            discountType: item.discountType ?? null,
            discountValue: item.discountValue ?? null,
            discountAmount,
            lineTotalBeforeTax,
            isGctExempt: item.isGctExempt,
            gctRate: itemGctRate,
            gctAmount,
            lineTotal,
            warehouseId: item.warehouseId ?? null,
            notes: item.notes ?? null,
          };
        });

        // Recalculate order totals
        const subtotal = calculatedItems.reduce(
          (sum, item) => sum + Number(item.lineTotalBeforeTax || 0),
          0
        );

        const discType = orderUpdates.orderDiscountType ?? existing.orderDiscountType;
        const discValue = orderUpdates.orderDiscountValue ?? (existing.orderDiscountValue ? Number(existing.orderDiscountValue) : null);

        let orderDiscountAmount = 0;
        if (discType && discValue) {
          if (discType === 'PERCENTAGE') {
            orderDiscountAmount = Math.round(subtotal * (Number(discValue) / 100) * 100) / 100;
          } else {
            orderDiscountAmount = Number(discValue);
          }
        }

        const taxableAmount = Math.round((subtotal - orderDiscountAmount) * 100) / 100;
        const exemptAmount = calculatedItems
          .filter((i) => i.isGctExempt)
          .reduce((sum, i) => sum + Number(i.lineTotalBeforeTax || 0), 0);
        const gctAmount = calculatedItems.reduce(
          (sum, item) => sum + Number(item.gctAmount || 0),
          0
        );
        const total = Math.round((subtotal - orderDiscountAmount + gctAmount) * 100) / 100;
        const amountDue = Math.round((total - Number(existing.amountPaid)) * 100) / 100;

        await tx.posOrderItem.createMany({ data: calculatedItems });

        return tx.posOrder.update({
          where: { id },
          data: {
            ...orderUpdates,
            itemCount: calculatedItems.length,
            subtotal,
            orderDiscountAmount,
            taxableAmount,
            exemptAmount,
            gctAmount,
            total,
            amountDue,
          },
          include: { items: { orderBy: { lineNumber: 'asc' } }, payments: true },
        });
      }

      // No items change — only update order-level fields
      // Recalculate discount if discount fields changed
      const updateData: Record<string, unknown> = { ...orderUpdates };

      if (orderUpdates.orderDiscountType !== undefined || orderUpdates.orderDiscountValue !== undefined) {
        const subtotal = Number(existing.subtotal);
        const discType = orderUpdates.orderDiscountType ?? existing.orderDiscountType;
        const discValue = orderUpdates.orderDiscountValue ?? (existing.orderDiscountValue ? Number(existing.orderDiscountValue) : null);

        let orderDiscountAmount = 0;
        if (discType && discValue) {
          if (discType === 'PERCENTAGE') {
            orderDiscountAmount = Math.round(subtotal * (Number(discValue) / 100) * 100) / 100;
          } else {
            orderDiscountAmount = Number(discValue);
          }
        }

        const gctAmount = Number(existing.gctAmount);
        const total = Math.round((subtotal - orderDiscountAmount + gctAmount) * 100) / 100;
        const amountDue = Math.round((total - Number(existing.amountPaid)) * 100) / 100;

        updateData.orderDiscountAmount = orderDiscountAmount;
        updateData.taxableAmount = Math.round((subtotal - orderDiscountAmount) * 100) / 100;
        updateData.total = total;
        updateData.amountDue = amountDue;
      }

      return tx.posOrder.update({
        where: { id },
        data: updateData,
        include: { items: { orderBy: { lineNumber: 'asc' } }, payments: true },
      });
    });

    return NextResponse.json(order);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update order');
  }
}
