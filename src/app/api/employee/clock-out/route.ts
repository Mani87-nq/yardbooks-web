/**
 * POST /api/employee/clock-out
 * Clock out the authenticated terminal employee, close their shift, calculate totals.
 * Uses terminal JWT auth (PIN-based session).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

const clockOutSchema = z.object({
  shiftId: z.string().min(1),
  closingCash: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = clockOutSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { shiftId, closingCash, notes } = parsed.data;

    // Find the active shift (must belong to this employee)
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        companyId: companyId!,
        employeeProfileId: employee!.sub,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        breaks: { where: { endAt: null } },
      },
    });

    if (!shift) return notFound('Active shift not found');

    const now = new Date();

    // End any active breaks
    if (shift.breaks.length > 0) {
      for (const breakRecord of shift.breaks) {
        const breakDuration = Math.round((now.getTime() - breakRecord.startAt.getTime()) / 60000);
        await prisma.shiftBreak.update({
          where: { id: breakRecord.id },
          data: { endAt: now, duration: breakDuration },
        });
      }
    }

    // Calculate total break time
    const allBreaks = await prisma.shiftBreak.findMany({
      where: { shiftId },
    });

    const breakMinutes = allBreaks.reduce((total, b) => {
      if (b.duration) return total + b.duration;
      if (b.endAt) {
        return total + Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);
      }
      return total;
    }, 0);

    // Calculate total shift minutes
    const totalMinutes = Math.round((now.getTime() - shift.clockInAt.getTime()) / 60000);

    // Calculate cash variance
    let cashVariance: number | null = null;
    let expectedCash: number | null = null;

    if (closingCash !== undefined && shift.openingCash !== null) {
      expectedCash = Number(shift.openingCash) + Number(shift.totalSales) - Number(shift.totalRefunds);
      cashVariance = closingCash - expectedCash;
    }

    // Update the shift
    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        clockOutAt: now,
        status: 'COMPLETED',
        totalMinutes,
        breakMinutes,
        closingCash: closingCash ?? null,
        expectedCash,
        cashVariance,
        notes: notes ? (shift.notes ? `${shift.notes}\n${notes}` : notes) : shift.notes,
      },
    });

    // Create closing cash event if provided
    if (closingCash !== undefined) {
      await prisma.cashDrawerEvent.create({
        data: {
          companyId: companyId!,
          shiftId,
          employeeProfileId: shift.employeeProfileId,
          eventType: 'CLOSING_COUNT',
          amount: closingCash,
          expectedAmount: expectedCash,
          variance: cashVariance,
        },
      });
    }

    // Log the clock-out action
    await prisma.pOSAction.create({
      data: {
        companyId: companyId!,
        employeeProfileId: shift.employeeProfileId,
        actionType: 'CLOCK_OUT',
        description: `Clocked out via employee portal after ${totalMinutes} minutes`,
        shiftId,
        terminalId: shift.terminalId,
        metadata: {
          totalMinutes,
          breakMinutes,
          totalSales: Number(shift.totalSales),
          totalRefunds: Number(shift.totalRefunds),
          cashVariance,
          source: 'employee_portal',
        },
      },
    });

    // Build shift summary
    return NextResponse.json({
      shift: updatedShift,
      summary: {
        hoursWorked: ((totalMinutes - breakMinutes) / 60).toFixed(2),
        totalMinutes,
        breakMinutes,
        totalSales: Number(shift.totalSales),
        totalRefunds: Number(shift.totalRefunds),
        totalVoids: Number(shift.totalVoids),
        totalTips: Number(shift.totalTips),
        transactionCount: shift.transactionCount,
        cashVariance,
        expectedCash,
        closingCash: closingCash ?? null,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to clock out');
  }
}
