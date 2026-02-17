/**
 * GET/POST /api/v1/quotations
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'quotations:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const status = searchParams.get('status') ?? undefined;

    const quotations = await prisma.quotation.findMany({
      where: {
        companyId: companyId!,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: { customer: { select: { id: true, name: true } }, items: true },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = quotations.length > limit;
    const data = hasMore ? quotations.slice(0, limit) : quotations;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list quotations');
  }
}

const quotationItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(quotationItemSchema).min(1),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  validUntil: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'quotations:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createQuotationSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items, ...quotationData } = parsed.data;
    const count = await prisma.quotation.count({ where: { companyId: companyId! } });
    const quotationNumber = `QUO-${String(count + 1).padStart(4, '0')}`;

    const quotation = await prisma.quotation.create({
      data: {
        ...quotationData,
        quotationNumber,
        companyId: companyId!,
        createdBy: user!.sub,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
          })),
        },
      },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create quotation');
  }
}
