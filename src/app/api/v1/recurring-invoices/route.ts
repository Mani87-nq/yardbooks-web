/**
 * GET/POST /api/v1/recurring-invoices
 * Manage recurring invoice templates.
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
    const activeOnly = searchParams.get('active') !== 'false';

    const templates = await prisma.recurringInvoice.findMany({
      where: {
        companyId: companyId!,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { nextDate: 'asc' },
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list recurring invoices');
  }
}

const lineItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gctRate: z.enum(['STANDARD', 'TELECOM', 'TOURISM', 'ZERO_RATED', 'EXEMPT']).default('STANDARD'),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'invoices:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { customerId, description, notes, terms, items, frequency, startDate, endDate } = parsed.data;

    // Verify customer belongs to company
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: companyId!, deletedAt: null },
    });
    if (!customer) return badRequest('Customer not found');

    // Calculate totals from items
    const GCT_RATES: Record<string, number> = {
      STANDARD: 0.15,
      TELECOM: 0.25,
      TOURISM: 0.10,
      ZERO_RATED: 0,
      EXEMPT: 0,
    };

    let subtotal = 0;
    let gctAmount = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      gctAmount += lineTotal * (GCT_RATES[item.gctRate] ?? 0);
    }
    const total = subtotal + gctAmount;

    const template = await prisma.recurringInvoice.create({
      data: {
        companyId: companyId!,
        customerId,
        description,
        notes,
        terms,
        items: JSON.parse(JSON.stringify(items)),
        frequency,
        startDate,
        endDate,
        nextDate: startDate,
        subtotal,
        gctAmount,
        total,
        createdBy: user!.sub,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create recurring invoice');
  }
}
