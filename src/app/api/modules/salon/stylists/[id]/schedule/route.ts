/**
 * GET /api/modules/salon/stylists/[id]/schedule — Get schedule slots for a stylist
 * PUT /api/modules/salon/stylists/[id]/schedule — Update schedule slots
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
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
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Verify stylist belongs to company
    const stylist = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!stylist) return notFound('Stylist not found');

    const where: any = {
      stylistId: id,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const slots = await (prisma as any).stylistScheduleSlot.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({
      data: slots,
      stylist: {
        id: stylist.id,
        displayName: stylist.displayName,
        workingDays: stylist.workingDays,
        workingHoursStart: stylist.workingHoursStart,
        workingHoursEnd: stylist.workingHoursEnd,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get schedule');
  }
}

// ---- PUT (batch update) ----

const slotSchema = z.object({
  date: z.string(), // ISO date string
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});

const updateScheduleSchema = z.object({
  slots: z.array(slotSchema).min(1).max(100),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const stylist = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!stylist) return notFound('Stylist not found');

    const body = await request.json();
    const parsed = updateScheduleSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Upsert each slot
    const results = await Promise.all(
      parsed.data.slots.map(async (slot) => {
        const dateObj = new Date(slot.date);
        return (prisma as any).stylistScheduleSlot.upsert({
          where: {
            stylistId_date_startTime: {
              stylistId: id,
              date: dateObj,
              startTime: slot.startTime,
            },
          },
          create: {
            stylistId: id,
            date: dateObj,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: slot.isAvailable,
            notes: slot.notes ?? null,
          },
          update: {
            endTime: slot.endTime,
            isAvailable: slot.isAvailable,
            notes: slot.notes ?? null,
          },
        });
      })
    );

    return NextResponse.json({ data: results });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update schedule');
  }
}
