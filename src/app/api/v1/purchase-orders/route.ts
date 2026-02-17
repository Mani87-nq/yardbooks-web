/**
 * GET  /api/v1/purchase-orders — List purchase orders (paginated, company-scoped)
 * POST /api/v1/purchase-orders — Create a new purchase order
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'inventory:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const status = searchParams.get('status') ?? undefined;
    const vendor = searchParams.get('vendor') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status } : {}),
      ...(vendor
        ? { vendorName: { contains: vendor, mode: 'insensitive' as const } }
        : {}),
    };

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true, goodsReceivedNotes: true } },
      },
    });

    const hasMore = purchaseOrders.length > limit;
    const data = hasMore ? purchaseOrders.slice(0, limit) : purchaseOrders;

    return NextResponse.json({
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
        limit,
      },
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to list purchase orders',
    );
  }
}

const poItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  sku: z.string().max(50).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const createPOSchema = z.object({
  poNumber: z.string().min(1).max(50),
  vendorName: z.string().min(1).max(200),
  vendorId: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT']).default('DRAFT'),
  orderDate: z.string().date(),
  expectedDate: z.string().date().optional(),
  items: z.array(poItemSchema).min(1),
  taxAmount: z.number().min(0).default(0),
  currency: z
    .enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD'])
    .default('JMD'),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'inventory:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createPOSchema.safeParse(body);
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

    // Calculate totals
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const total = subtotal + rest.taxAmount;

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        ...rest,
        companyId: companyId!,
        orderDate: new Date(orderDate),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        subtotal,
        total,
        createdBy: user!.sub,
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

    return NextResponse.json(purchaseOrder, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation on poNumber
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return badRequest('A purchase order with this PO number already exists for this company');
    }
    return internalError(
      error instanceof Error ? error.message : 'Failed to create purchase order',
    );
  }
}
