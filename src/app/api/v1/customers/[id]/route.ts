/**
 * GET    /api/v1/customers/[id] — Get a single customer
 * PUT    /api/v1/customers/[id] — Update a customer
 * DELETE /api/v1/customers/[id] — Soft-delete a customer
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ---- GET ----

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      include: {
        invoices: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) return notFound('Customer not found');

    return NextResponse.json(customer);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get customer');
  }
}

// ---- Parish mapping (human-readable ↔ Prisma enum) ----

const PARISH_NAME_TO_ENUM: Record<string, string> = {
  'Kingston': 'KINGSTON',
  'St. Andrew': 'ST_ANDREW',
  'St. Thomas': 'ST_THOMAS',
  'Portland': 'PORTLAND',
  'St. Mary': 'ST_MARY',
  'St. Ann': 'ST_ANN',
  'Trelawny': 'TRELAWNY',
  'St. James': 'ST_JAMES',
  'Hanover': 'HANOVER',
  'Westmoreland': 'WESTMORELAND',
  'St. Elizabeth': 'ST_ELIZABETH',
  'Manchester': 'MANCHESTER',
  'Clarendon': 'CLARENDON',
  'St. Catherine': 'ST_CATHERINE',
};

function toParishEnum(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (Object.values(PARISH_NAME_TO_ENUM).includes(value)) return value;
  return PARISH_NAME_TO_ENUM[value] ?? undefined;
}

// ---- PUT ----

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['customer', 'vendor', 'both']).optional(),
  companyName: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().max(20).nullable().optional(),
  trnNumber: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  address: z.object({
    street: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    parish: z.string().nullable().optional(),
    country: z.string().default('Jamaica'),
    postalCode: z.string().nullable().optional(),
  }).nullable().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Ensure customer belongs to company
    const existing = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!existing) return notFound('Customer not found');

    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed');
    }

    const { address, ...rest } = parsed.data;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...rest,
        companyName: rest.companyName || null,
        email: rest.email || null,
        phone: rest.phone || null,
        trnNumber: rest.trnNumber || null,
        notes: rest.notes || null,
        ...(address !== undefined ? {
          addressStreet: address?.street || null,
          addressCity: address?.city || null,
          addressParish: toParishEnum(address?.parish) as any,
          addressCountry: address?.country ?? 'Jamaica',
          addressPostal: address?.postalCode || null,
        } : {}),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update customer');
  }
}

// ---- DELETE (soft) ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'customers:delete');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.customer.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!existing) return notFound('Customer not found');

    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete customer');
  }
}
