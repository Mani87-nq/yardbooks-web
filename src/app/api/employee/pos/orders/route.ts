/**
 * GET  /api/employee/pos/orders — List orders (paginated, filterable)
 * POST /api/employee/pos/orders — Create order with items from kiosk cart
 *
 * Terminal-auth wrapper: createdBy comes from terminal JWT employee.sub.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, internalError } from '@/lib/api-error';

const VALID_ORDER_STATUSES = [
  'DRAFT', 'HELD', 'PENDING_PAYMENT', 'PARTIALLY_PAID',
  'COMPLETED', 'VOIDED', 'REFUNDED',
] as const;

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const statusParam = searchParams.get('status');
    const status = statusParam && VALID_ORDER_STATUSES.includes(statusParam as any)
      ? statusParam
      : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid order status');
    }
    const sessionId = searchParams.get('sessionId') ?? undefined;
    const terminalId = searchParams.get('terminalId') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(terminalId ? { terminalId } : {}),
    };

    const orders = await prisma.posOrder.findMany({
      where,
      include: {
        items: true,
        payments: {
          select: { id: true, method: true, amount: true, status: true, createdAt: true },
        },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = orders.length > limit;
    const data = hasMore ? orders.slice(0, limit) : orders;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list orders');
  }
}

// ── Create Order ──────────────────────────────────────────────────────

const orderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).max(300),
  description: z.string().max(500).optional(),
  quantity: z.number().positive(),
  uomCode: z.string().min(1).max(20).default('EA'),
  unitPrice: z.number().min(0),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  discountValue: z.number().min(0).optional(),
  isGctExempt: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

const createOrderSchema = z.object({
  sessionId: z.string().min(1),
  terminalId: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().max(200).default('Walk-in Customer'),
  items: z.array(orderItemSchema).min(1),
  orderDiscountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  orderDiscountValue: z.number().min(0).optional(),
  orderDiscountReason: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items, ...orderData } = parsed.data;

    // Validate session is open
    const sessionRecord = await prisma.posSession.findFirst({
      where: { id: orderData.sessionId, companyId: companyId!, status: 'OPEN' },
      include: { terminal: { select: { name: true } } },
    });
    if (!sessionRecord) {
      return badRequest('Session not found or not open');
    }

    // Get POS settings for gctRate and order number generation
    const settings = await prisma.posSettings.findUnique({
      where: { companyId: companyId! },
    });
    if (!settings) {
      return badRequest('POS settings not configured. Please configure POS settings first.');
    }

    const defaultGctRate = Number(settings.gctRate);

    // Calculate item-level totals (server-side, authoritative)
    const calculatedItems = items.map((item, index) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      const lineSubtotal = Math.round(qty * price * 100) / 100;

      let discountAmount = 0;
      if (item.discountType && item.discountValue != null) {
        if (item.discountType === 'PERCENTAGE') {
          discountAmount = Math.round(lineSubtotal * (Number(item.discountValue) / 100) * 100) / 100;
        } else {
          discountAmount = Math.min(Number(item.discountValue), lineSubtotal);
        }
      }

      const lineTotalBeforeTax = Math.round((lineSubtotal - discountAmount) * 100) / 100;
      const itemGctRate = item.isGctExempt ? 0 : defaultGctRate;
      const gctAmount = Math.round(lineTotalBeforeTax * Number(itemGctRate) * 100) / 100;
      const lineTotal = Math.round((lineTotalBeforeTax + gctAmount) * 100) / 100;

      return {
        lineNumber: index + 1,
        productId: item.productId ?? null,
        name: item.name,
        description: item.description ?? null,
        quantity: item.quantity,
        uomCode: item.uomCode,
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
        notes: item.notes ?? null,
      };
    });

    // Calculate order-level totals
    const subtotal = calculatedItems.reduce(
      (sum, item) => sum + item.lineTotalBeforeTax,
      0
    );

    let orderDiscountAmount = 0;
    if (orderData.orderDiscountType && orderData.orderDiscountValue != null) {
      if (orderData.orderDiscountType === 'PERCENTAGE') {
        orderDiscountAmount = Math.round(subtotal * (Number(orderData.orderDiscountValue) / 100) * 100) / 100;
      } else {
        orderDiscountAmount = Math.min(Number(orderData.orderDiscountValue), subtotal);
      }
    }

    // Proportionally reduce taxable/exempt amounts by order discount
    const discountRatio = subtotal > 0 ? (subtotal - orderDiscountAmount) / subtotal : 1;
    const rawTaxable = calculatedItems
      .filter((i) => !i.isGctExempt)
      .reduce((sum, i) => sum + i.lineTotalBeforeTax, 0);
    const rawExempt = calculatedItems
      .filter((i) => i.isGctExempt)
      .reduce((sum, i) => sum + i.lineTotalBeforeTax, 0);
    const taxableAmount = Math.round(rawTaxable * discountRatio * 100) / 100;
    const exemptAmount = Math.round(rawExempt * discountRatio * 100) / 100;
    // Recalculate GCT on the discounted taxable amount (not the pre-discount sum)
    const gctAmount = Math.round(taxableAmount * defaultGctRate * 100) / 100;
    const total = Math.round((subtotal - orderDiscountAmount + gctAmount) * 100) / 100;

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Atomically increment nextOrderNumber
      const updatedSettings = await tx.posSettings.update({
        where: { companyId: companyId! },
        data: { nextOrderNumber: { increment: 1 } },
        select: { orderPrefix: true, nextOrderNumber: true },
      });

      const orderNum = updatedSettings.nextOrderNumber - 1;
      const orderNumber = `${updatedSettings.orderPrefix}-${String(orderNum).padStart(6, '0')}`;

      const newOrder = await tx.posOrder.create({
        data: {
          companyId: companyId!,
          orderNumber,
          sessionId: orderData.sessionId,
          terminalId: orderData.terminalId,
          terminalName: sessionRecord.terminal.name,
          customerId: orderData.customerId ?? null,
          customerName: orderData.customerName,
          itemCount: calculatedItems.length,
          subtotal,
          orderDiscountType: orderData.orderDiscountType ?? null,
          orderDiscountValue: orderData.orderDiscountValue ?? null,
          orderDiscountAmount,
          orderDiscountReason: orderData.orderDiscountReason ?? null,
          taxableAmount,
          exemptAmount,
          gctRate: defaultGctRate,
          gctAmount,
          total,
          amountPaid: 0,
          amountDue: total,
          changeGiven: 0,
          status: 'PENDING_PAYMENT',
          notes: orderData.notes ?? null,
          createdBy: employee!.sub,
          items: {
            create: calculatedItems,
          },
        },
        include: { items: true },
      });

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create order');
  }
}
