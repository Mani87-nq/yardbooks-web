/**
 * GET/PUT/DELETE /api/v1/companies/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { notFound, badRequest, forbidden, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const membership = await prisma.companyMember.findFirst({
      where: { userId: user!.sub, companyId: id },
      include: { company: true },
    });
    if (!membership) return notFound('Company not found');
    return NextResponse.json({ ...membership.company, role: membership.role });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get company');
  }
}

const updateCompanySchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  tradingName: z.string().max(200).optional(),
  trnNumber: z.string().max(20).optional(),
  gctNumber: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const membership = await prisma.companyMember.findFirst({
      where: { userId: user!.sub, companyId: id },
    });
    if (!membership) return notFound('Company not found');
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return forbidden('Only OWNER or ADMIN can update company');
    }

    const body = await request.json();
    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const company = await prisma.company.update({ where: { id }, data: parsed.data });
    return NextResponse.json(company);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update company');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const membership = await prisma.companyMember.findFirst({
      where: { userId: user!.sub, companyId: id },
    });
    if (!membership) return notFound('Company not found');
    if (membership.role !== 'OWNER') {
      return forbidden('Only OWNER can delete a company');
    }

    await prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete company');
  }
}
