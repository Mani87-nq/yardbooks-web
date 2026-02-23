/**
 * GET  /api/v1/customer-pos — List customer purchase orders (paginated, company-scoped)
 * POST /api/v1/customer-pos — Create a new customer purchase order with items
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    const statusParam = searchParams.get('status');
    const validStatuses = ['DRAFT', 'OPEN', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'CLOSED', 'CANCELLED'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid customer PO status');
    }

    const customerId = searchParams.get('customerId') ?? undefined;

    const where = {
      companyId: companyId!,
      ...(status ? { status: status as any } : {}),
      ...(customerId ? { customerId } : {}),
    };

    const customerPOs = await prisma.customerPurchaseOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        items: true,
        _count: { select: { invoices: true } },
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = customerPOs.length > limit;
    const data = hasMore ? customerPOs.slice(0, limit) : customerPOs;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list customer purchase orders');
  }
}

const customerPOItemSchema = z.object({
  lineNumber: z.number().int().min(0).optional(),
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  orderedQuantity: z.number().positive(),
  uomShortCode: z.string().min(1).max(20),
  agreedUnitPrice: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

const createCustomerPOSchema = z.object({
  customerId: z.string().min(1),
  poNumber: z.string().min(1).max(100),
  internalReference: z.string().max(100).optional(),
  orderDate: z.coerce.date().optional(),
  requestedDeliveryDate: z.coerce.date().optional(),
  customerReference: z.string().max(200).optional(),
  shippingStreet: z.string().max(500).optional(),
  shippingCity: z.string().max(200).optional(),
  shippingParish: z.enum([
    'KINGSTON', 'ST_ANDREW', 'ST_THOMAS', 'PORTLAND', 'ST_MARY', 'ST_ANN',
    'TRELAWNY', 'ST_JAMES', 'HANOVER', 'WESTMORELAND', 'ST_ELIZABETH',
    'MANCHESTER', 'CLARENDON', 'ST_CATHERINE',
  ]).optional(),
  shippingCountry: z.string().max(100).optional(),
  shippingPostal: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'OPEN']).default('DRAFT'),
  items: z.array(customerPOItemSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createCustomerPOSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Verify customer exists and belongs to company
    const customer = await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, companyId: companyId! },
    });
    if (!customer) return badRequest('Customer not found');

    // Check for duplicate PO number within company
    const existingPO = await prisma.customerPurchaseOrder.findFirst({
      where: { companyId: companyId!, poNumber: parsed.data.poNumber },
    });
    if (existingPO) return badRequest('A customer PO with this number already exists');

    const { items, ...poData } = parsed.data;

    // Calculate totals
    const totalOrderedQuantity = items.reduce((sum, item) => sum + item.orderedQuantity, 0);

    const customerPO = await prisma.customerPurchaseOrder.create({
      data: {
        ...poData,
        companyId: companyId!,
        createdBy: user!.sub,
        orderDate: poData.orderDate ?? new Date(),
        requestedDeliveryDate: poData.requestedDeliveryDate || null,
        customerReference: poData.customerReference || null,
        internalReference: poData.internalReference || null,
        shippingStreet: poData.shippingStreet || null,
        shippingCity: poData.shippingCity || null,
        shippingParish: poData.shippingParish || null,
        shippingCountry: poData.shippingCountry || null,
        shippingPostal: poData.shippingPostal || null,
        notes: poData.notes || null,
        internalNotes: poData.internalNotes || null,
        totalOrderedQuantity,
        totalInvoicedQuantity: 0,
        totalRemainingQuantity: totalOrderedQuantity,
        items: {
          create: items.map((item, idx) => ({
            lineNumber: item.lineNumber ?? idx + 1,
            productId: item.productId || null,
            description: item.description,
            orderedQuantity: item.orderedQuantity,
            invoicedQuantity: 0,
            remainingQuantity: item.orderedQuantity,
            uomShortCode: item.uomShortCode,
            agreedUnitPrice: item.agreedUnitPrice ?? null,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(customerPO, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create customer purchase order');
  }
}
