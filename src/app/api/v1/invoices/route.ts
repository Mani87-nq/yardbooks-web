/**
 * GET  /api/v1/invoices — List invoices (paginated, company-scoped)
 * POST /api/v1/invoices — Create a new invoice
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
    const validStatuses = ['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam : undefined;
    if (statusParam && !status) {
      return badRequest('Invalid invoice status');
    }
    const customerId = searchParams.get('customerId') ?? undefined;

    const where = {
      companyId: companyId!,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
    };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, items: true },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = invoices.length > limit;
    const data = hasMore ? invoices.slice(0, limit) : invoices;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list invoices');
  }
}

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gctRate: z.enum(['STANDARD', 'TELECOM', 'TOURISM', 'ZERO_RATED', 'EXEMPT']).default('STANDARD'),
  gctAmount: z.number().min(0),
  total: z.number().min(0),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  invoiceNumber: z.string().max(50).optional(),
  items: z.array(invoiceItemSchema).min(1),
  subtotal: z.number().min(0),
  gctAmount: z.number().min(0),
  discount: z.number().min(0).default(0),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
  total: z.number().min(0),
  dueDate: z.coerce.date(),
  issueDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'SENT']).default('DRAFT'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { items, ...invoiceData } = parsed.data;

    // Generate invoice number if not provided
    const invoiceNumber = invoiceData.invoiceNumber ?? await generateInvoiceNumber(companyId!);

    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        invoiceNumber,
        companyId: companyId!,
        balance: invoiceData.total,
        createdBy: user!.sub,
        items: {
          create: items.map((item) => ({
            ...item,
            productId: item.productId || null,
          })),
        },
      },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create invoice');
  }
}

async function generateInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoice.count({
    where: { companyId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
}
