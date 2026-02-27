/**
 * GET    /api/modules/salon/stylists/[id] — Get a single stylist
 * PUT    /api/modules/salon/stylists/[id] — Update a stylist
 * DELETE /api/modules/salon/stylists/[id] — Delete a stylist
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
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const stylist = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
      include: {
        services: {
          include: { service: { include: { category: true } } },
        },
        schedules: {
          where: {
            date: { gte: new Date() },
          },
          orderBy: { date: 'asc' },
          take: 30,
        },
        appointments: {
          where: {
            status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
          },
          include: {
            services: { include: { service: true } },
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!stylist) return notFound('Stylist not found');

    return NextResponse.json(stylist);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get stylist');
  }
}

// ---- PUT ----

const updateStylistSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
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
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Stylist not found');

    const body = await request.json();
    const parsed = updateStylistSchema.safeParse(body);
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

    // Update stylist and optionally replace service links
    const updateData: any = { ...stylistData };

    if (serviceIds !== undefined) {
      // Delete existing links and recreate
      await (prisma as any).stylistService.deleteMany({
        where: { stylistId: id },
      });
    }

    const stylist = await (prisma as any).stylist.update({
      where: { id },
      data: {
        ...updateData,
        ...(serviceIds !== undefined
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

    return NextResponse.json(stylist);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update stylist');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:delete');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Stylist not found');

    // Check for future active appointments
    const futureAppointments = await (prisma as any).appointment.count({
      where: {
        stylistId: id,
        date: { gte: new Date() },
        status: { in: ['BOOKED', 'CONFIRMED'] },
      },
    });

    if (futureAppointments > 0) {
      return badRequest(
        `Stylist has ${futureAppointments} upcoming appointment(s). Reassign or cancel them first.`
      );
    }

    // Soft delete - deactivate instead of hard delete
    await (prisma as any).stylist.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete stylist');
  }
}
