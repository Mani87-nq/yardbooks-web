/**
 * GET /api/employee/shift/active
 * Get the authenticated terminal employee's currently active shift.
 * Uses terminal JWT auth (PIN-based session).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeProfileId: employee!.sub,
        companyId: companyId!,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        breaks: {
          where: { endAt: null },
          take: 1,
        },
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (!activeShift) {
      return NextResponse.json({ shift: null });
    }

    return NextResponse.json({
      shift: {
        id: activeShift.id,
        clockInAt: activeShift.clockInAt,
        status: activeShift.status,
        terminalId: activeShift.terminalId,
        openingCash: activeShift.openingCash ? Number(activeShift.openingCash) : null,
        totalSales: Number(activeShift.totalSales),
        totalRefunds: Number(activeShift.totalRefunds),
        totalTips: Number(activeShift.totalTips),
        transactionCount: activeShift.transactionCount,
        breakMinutes: activeShift.breakMinutes,
        isOnBreak: activeShift.breaks.length > 0,
        notes: activeShift.notes,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get active shift');
  }
}
