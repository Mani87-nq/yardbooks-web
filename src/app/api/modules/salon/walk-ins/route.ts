/**
 * GET   /api/modules/salon/walk-ins — List walk-ins for today, ordered by queue position
 * POST  /api/modules/salon/walk-ins — Add a walk-in to the queue
 * PATCH /api/modules/salon/walk-ins — Update a walk-in (status, assign stylist)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

// ---- GET (List today's walk-ins) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'salon:walkins:read'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // comma-separated: WAITING,ASSIGNED,IN_SERVICE
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Default: today from midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      companyId: companyId!,
      joinedAt: { gte: today },
    };

    if (status) {
      where.status = { in: status.split(',').map((s) => s.trim()) };
    } else if (!includeCompleted) {
      // By default, exclude completed and left
      where.status = { in: ['WAITING', 'ASSIGNED', 'IN_SERVICE'] };
    }

    const walkIns = await (prisma as any).walkIn.findMany({
      where,
      orderBy: [{ queuePosition: 'asc' }],
      include: {
        assignedStylist: true,
      },
    });

    return NextResponse.json({ data: walkIns });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to list walk-ins'
    );
  }
}

// ---- POST (Add walk-in to queue) ----

const createWalkInSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(20).nullable().optional(),
  customerId: z.string().nullable().optional(),
  requestedServices: z.any().optional(), // Array of service names/IDs stored as JSON
  preferredStylistId: z.string().nullable().optional(),
  estimatedWait: z.number().int().min(0).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'salon:walkins:create'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = createWalkInSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const data = parsed.data;

    // Validate preferred stylist if provided
    if (data.preferredStylistId) {
      const stylist = await (prisma as any).stylist.findFirst({
        where: { id: data.preferredStylistId, companyId: companyId!, isActive: true },
      });
      if (!stylist) {
        return badRequest('Preferred stylist not found or inactive');
      }
    }

    // Auto-increment queue position for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastInQueue = await (prisma as any).walkIn.findFirst({
      where: {
        companyId: companyId!,
        joinedAt: { gte: today },
      },
      orderBy: { queuePosition: 'desc' },
    });

    const queuePosition = (lastInQueue?.queuePosition ?? 0) + 1;

    // Calculate estimated wait based on queue size (rough estimate: 15 min per person ahead)
    const waitingCount = await (prisma as any).walkIn.count({
      where: {
        companyId: companyId!,
        joinedAt: { gte: today },
        status: { in: ['WAITING', 'ASSIGNED'] },
      },
    });
    const estimatedWait = data.estimatedWait ?? waitingCount * 15;

    const walkIn = await (prisma as any).walkIn.create({
      data: {
        companyId: companyId!,
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        customerId: data.customerId || null,
        requestedServices: data.requestedServices || null,
        preferredStylistId: data.preferredStylistId || null,
        queuePosition,
        estimatedWait,
        status: 'WAITING',
      },
      include: {
        assignedStylist: true,
      },
    });

    return NextResponse.json(walkIn, { status: 201 });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to add walk-in'
    );
  }
}

// ---- PATCH (Update walk-in status / assign stylist) ----

const updateWalkInSchema = z.object({
  id: z.string().min(1),
  status: z
    .enum(['WAITING', 'ASSIGNED', 'IN_SERVICE', 'COMPLETED', 'LEFT'])
    .optional(),
  assignedStylistId: z.string().nullable().optional(),
  estimatedWait: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'salon:walkins:update'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = updateWalkInSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { id, ...updateData } = parsed.data;

    // Verify walk-in exists and belongs to company
    const existing = await (prisma as any).walkIn.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Walk-in not found');

    // Build update payload
    const data: any = {};

    if (updateData.status !== undefined) {
      data.status = updateData.status;

      // Auto-set timestamps based on status transitions
      if (updateData.status === 'IN_SERVICE' && !existing.startedAt) {
        data.startedAt = new Date();
      }
      if (updateData.status === 'COMPLETED' && !existing.completedAt) {
        data.completedAt = new Date();
      }
    }

    if (updateData.assignedStylistId !== undefined) {
      // Validate stylist if assigning
      if (updateData.assignedStylistId) {
        const stylist = await (prisma as any).stylist.findFirst({
          where: {
            id: updateData.assignedStylistId,
            companyId: companyId!,
            isActive: true,
          },
        });
        if (!stylist) return badRequest('Stylist not found or inactive');
      }
      data.assignedStylistId = updateData.assignedStylistId;
    }

    if (updateData.estimatedWait !== undefined) {
      data.estimatedWait = updateData.estimatedWait;
    }

    const updated = await (prisma as any).walkIn.update({
      where: { id },
      data,
      include: {
        assignedStylist: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to update walk-in'
    );
  }
}
