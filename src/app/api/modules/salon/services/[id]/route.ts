/**
 * GET    /api/modules/salon/services/[id] — Get a single service
 * PUT    /api/modules/salon/services/[id] — Update a service
 * DELETE /api/modules/salon/services/[id] — Delete a service
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
    const { user, error: authError } = await requirePermission(request, 'salon:services:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const service = await (prisma as any).salonService.findFirst({
      where: { id, companyId: companyId! },
      include: {
        category: true,
        stylistServices: {
          include: { stylist: true },
        },
      },
    });

    if (!service) return notFound('Service not found');

    return NextResponse.json(service);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get service');
  }
}

// ---- PUT ----

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  categoryId: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  duration: z.number().int().min(5).max(480).optional(),
  bufferTime: z.number().int().min(0).max(60).optional(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:services:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).salonService.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Service not found');

    const body = await request.json();
    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // If changing category, verify new category belongs to company
    if (parsed.data.categoryId) {
      const category = await (prisma as any).salonServiceCategory.findFirst({
        where: { id: parsed.data.categoryId, companyId: companyId! },
      });
      if (!category) {
        return badRequest('Category not found');
      }
    }

    const service = await (prisma as any).salonService.update({
      where: { id },
      data: parsed.data,
      include: { category: true },
    });

    return NextResponse.json(service);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update service');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:services:delete');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await (prisma as any).salonService.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Service not found');

    // Check for active appointments using this service
    const activeAppointments = await (prisma as any).appointmentService.count({
      where: {
        serviceId: id,
        appointment: {
          status: { in: ['BOOKED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
      },
    });

    if (activeAppointments > 0) {
      return badRequest(
        'Cannot delete service with active appointments. Deactivate it instead.'
      );
    }

    await (prisma as any).salonService.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete service');
  }
}
