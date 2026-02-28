/**
 * GET /api/employee/schedule?weeks=2
 * Return the authenticated terminal employee's scheduled shifts.
 * Uses terminal JWT auth (PIN-based session).
 *
 * Same logic as /api/employee/me/schedule but using terminal auth.
 * Only returns shifts from published schedules.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const weeksParam = request.nextUrl.searchParams.get('weeks') || '2';
    const weeks = Math.min(Math.max(parseInt(weeksParam, 10) || 2, 1), 8);

    // Calculate date range
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + weeks * 7);

    const scheduledShifts = await prisma.scheduledShift.findMany({
      where: {
        employeeProfileId: employee!.sub,
        companyId: companyId!,
        shiftDate: {
          gte: weekStart,
          lt: weekEnd,
        },
        schedule: {
          isPublished: true,
        },
      },
      select: {
        id: true,
        shiftDate: true,
        startTime: true,
        endTime: true,
        role: true,
        notes: true,
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

    return NextResponse.json({
      data: scheduledShifts,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weeks,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get schedule');
  }
}
