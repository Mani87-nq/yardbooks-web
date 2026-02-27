/**
 * GET/POST /api/time-off
 * Time-off request management.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ── GET: List time-off requests ─────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const employeeProfileId = url.searchParams.get('employeeProfileId');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const where: Record<string, unknown> = {
      companyId: companyId!,
    };

    // If an employeeProfileId is specified, filter to that employee
    // Otherwise, check if the user is a manager — managers see all, employees see own
    if (employeeProfileId) {
      where.employeeProfileId = employeeProfileId;
    } else {
      // Try to find the user's own employee profile
      const myProfile = await prisma.employeeProfile.findFirst({
        where: { companyId: companyId!, userId: user!.sub, deletedAt: null },
      });

      // If user has an employee profile and is NOT a manager, scope to their requests
      if (myProfile && !['SHIFT_MANAGER', 'STORE_MANAGER'].includes(myProfile.role)) {
        where.employeeProfileId = myProfile.id;
      }
      // If user is a manager or has no profile (admin/owner), they see all
    }

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.timeOffRequest.findMany({
        where,
        include: {
          employeeProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarColor: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.timeOffRequest.count({ where }),
    ]);

    return NextResponse.json({ data: requests, total, limit, offset });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list time-off requests');
  }
}

// ── POST: Create time-off request ───────────────────────────────
const createTimeOffSchema = z.object({
  employeeProfileId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(500).optional(),
  leaveType: z.enum(['VACATION', 'SICK', 'PERSONAL', 'OTHER']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createTimeOffSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { employeeProfileId, startDate, endDate, reason, leaveType } = parsed.data;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return badRequest('End date must be after start date');
    }

    if (start < new Date()) {
      return badRequest('Start date cannot be in the past');
    }

    // Verify employee exists
    const employee = await prisma.employeeProfile.findFirst({
      where: {
        id: employeeProfileId,
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!employee) return badRequest('Employee not found or inactive');

    const timeOffRequest = await prisma.timeOffRequest.create({
      data: {
        companyId: companyId!,
        employeeProfileId,
        startDate: start,
        endDate: end,
        reason: reason || null,
        leaveType: leaveType || 'VACATION',
        status: 'PENDING',
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

    return NextResponse.json(timeOffRequest, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create time-off request');
  }
}
