/**
 * GET  /api/v1/customers — List customers (paginated, company-scoped)
 * POST /api/v1/customers — Create a new customer
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'customers:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const search = searchParams.get('search') ?? undefined;
    const type = searchParams.get('type') as 'CUSTOMER' | 'VENDOR' | 'BOTH' | undefined;

    const where = {
      companyId: companyId!,
      deletedAt: null,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { companyName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(type ? { type } : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = customers.length > limit;
    const data = hasMore ? customers.slice(0, limit) : customers;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({
      data,
      pagination: { nextCursor, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list customers');
  }
}

// ---- POST (Create) ----

const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['customer', 'vendor', 'both']).default('customer'),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  trnNumber: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    parish: z.string().optional(),
    country: z.string().default('Jamaica'),
    postalCode: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'customers:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { address, ...rest } = parsed.data;

    const customer = await prisma.customer.create({
      data: {
        ...rest,
        email: rest.email || null,
        companyId: companyId!,
        createdBy: user!.sub,
        ...(address ? {
          addressStreet: address.street,
          addressCity: address.city,
          addressParish: address.parish as any,
          addressCountry: address.country,
          addressPostal: address.postalCode,
        } : {}),
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create customer');
  }
}
