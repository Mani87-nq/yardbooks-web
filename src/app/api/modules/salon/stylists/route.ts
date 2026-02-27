/**
 * GET  /api/modules/salon/stylists — List stylists
 * POST /api/modules/salon/stylists — Create a new stylist
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const search = searchParams.get('search') ?? undefined;

    const where: any = {
      companyId: companyId!,
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const stylists = await (prisma as any).stylist.findMany({
      where,
      include: {
        services: {
          include: { service: true },
        },
        _count: {
          select: {
            appointments: {
              where: {
                date: new Date().toISOString().split('T')[0],
                status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    return NextResponse.json({ data: stylists });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list stylists');
  }
}

// ---- POST (Create) ----

const createStylistSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  avatarColor: z.string().max(20).optional(),
  bio: z.string().max(2000).nullable().optional(),
  specialties: z.array(z.string()).optional(),
  defaultCommissionType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  defaultCommissionRate: z.number().min(0).max(100).optional(),
  workingDays: z
    .object({
      MON: z.boolean().optional(),
      TUE: z.boolean().optional(),
      WED: z.boolean().optional(),
      THU: z.boolean().optional(),
      FRI: z.boolean().optional(),
      SAT: z.boolean().optional(),
      SUN: z.boolean().optional(),
    })
    .optional(),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = createStylistSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { serviceIds, ...stylistData } = parsed.data;

    const stylist = await (prisma as any).stylist.create({
      data: {
        ...stylistData,
        companyId: companyId!,
        ...(serviceIds && serviceIds.length > 0
          ? {
              services: {
                create: serviceIds.map((serviceId: string) => ({
                  serviceId,
                })),
              },
            }
          : {}),
      },
      include: {
        services: { include: { service: true } },
      },
    });

    return NextResponse.json(stylist, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create stylist');
  }
}
