/**
 * PUT/DELETE /api/time-off/[id]
 * Approve/deny (manager) or cancel (employee) time-off requests.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, forbidden, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ── PUT: Approve or deny (manager only) ─────────────────────────
const updateTimeOffSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  reviewNotes: z.string().max(500).optional(),
  reviewerProfileId: z.string().min(1),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = updateTimeOffSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { status, reviewNotes, reviewerProfileId } = parsed.data;

    // Find the time-off request
    const existing = await prisma.timeOffRequest.findFirst({
      where: { id, companyId: companyId! },
    });

    if (!existing) return notFound('Time-off request not found');

    if (existing.status !== 'PENDING') {
      return badRequest('Only pending requests can be reviewed');
    }

    // Verify reviewer is a manager
    const reviewer = await prisma.employeeProfile.findFirst({
      where: {
        id: reviewerProfileId,
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!reviewer || !['SHIFT_MANAGER', 'STORE_MANAGER'].includes(reviewer.role)) {
      return forbidden('Only managers can approve or deny time-off requests');
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewerProfileId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
      include: {
        employeeProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update time-off request');
  }
}

// ── DELETE: Cancel (employee, if still pending) ─────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.timeOffRequest.findFirst({
      where: { id, companyId: companyId! },
    });

    if (!existing) return notFound('Time-off request not found');

    if (existing.status !== 'PENDING') {
      return badRequest('Only pending requests can be cancelled');
    }

    await prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to cancel time-off request');
  }
}
