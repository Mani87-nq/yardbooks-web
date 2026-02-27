/**
 * GET /api/employee/me/schedule
 * Get own schedule for current and upcoming weeks.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Find employee profile linked to this user
    const profile = await prisma.employeeProfile.findFirst({
      where: {
        companyId: companyId!,
        userId: user!.sub,
        deletedAt: null,
      },
    });

    if (!profile) return notFound('Employee profile not found');

    const url = new URL(request.url);
    const weeksParam = url.searchParams.get('weeks') || '2';
    const weeks = Math.min(Number(weeksParam) || 2, 8);

    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // Get end date (N weeks from now)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + weeks * 7);

    const scheduledShifts = await prisma.scheduledShift.findMany({
      where: {
        companyId: companyId!,
        employeeProfileId: profile.id,
        shiftDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        schedule: {
          select: {
            id: true,
            weekStartDate: true,
            isPublished: true,
          },
        },
      },
      orderBy: { shiftDate: 'asc' },
    });

    // Only return published schedules
    const publishedShifts = scheduledShifts.filter((s) => s.schedule.isPublished);

    return NextResponse.json({
      data: publishedShifts,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weeks,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get schedule');
  }
}
