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

// Map human-readable parish names to Prisma enum values
const PARISH_NAME_TO_ENUM: Record<string, string> = {
  'Kingston': 'KINGSTON', 'St. Andrew': 'ST_ANDREW', 'St. Thomas': 'ST_THOMAS',
  'Portland': 'PORTLAND', 'St. Mary': 'ST_MARY', 'St. Ann': 'ST_ANN',
  'Trelawny': 'TRELAWNY', 'St. James': 'ST_JAMES', 'Hanover': 'HANOVER',
  'Westmoreland': 'WESTMORELAND', 'St. Elizabeth': 'ST_ELIZABETH',
  'Manchester': 'MANCHESTER', 'Clarendon': 'CLARENDON', 'St. Catherine': 'ST_CATHERINE',
};

function toParishEnum(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (Object.values(PARISH_NAME_TO_ENUM).includes(value)) return value;
  return PARISH_NAME_TO_ENUM[value] ?? undefined;
}

const updateCompanySchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  tradingName: z.string().max(200).nullable().optional(),
  trnNumber: z.string().max(20).nullable().optional(),
  gctNumber: z.string().max(20).nullable().optional(),
  gctRegistered: z.boolean().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  website: z.string().max(200).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  parish: z.string().max(50).nullable().optional(),
  fiscalYearEnd: z.number().int().min(1).max(12).optional(),
  // Invoice settings
  invoicePrefix: z.string().max(20).optional(),
  invoiceNextNum: z.number().int().min(1).optional(),
  invoiceTerms: z.string().max(5000).nullable().optional(),
  invoiceNotes: z.string().max(5000).nullable().optional(),
  invoiceShowLogo: z.boolean().optional(),
  invoiceTemplate: z.string().max(50).optional(),
  primaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  invoiceFooter: z.string().max(2000).nullable().optional(),
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

    const { address, parish, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };

    // Map flat address/parish to DB columns
    if (address !== undefined) data.addressStreet = address || null;
    if (parish !== undefined) data.addressParish = toParishEnum(parish) as any;
    // Normalize empty strings to null for optional fields
    if (rest.email === '') data.email = null;

    const company = await prisma.company.update({ where: { id }, data });
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
