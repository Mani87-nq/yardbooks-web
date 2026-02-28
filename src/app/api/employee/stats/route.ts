/**
 * GET /api/employee/stats?period=30
 * Return the authenticated terminal employee's performance stats.
 * Uses terminal JWT auth (PIN-based session).
 *
 * Same logic as /api/employee/me/stats but using terminal auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const periodParam = request.nextUrl.searchParams.get('period') || '30';
    const days = Math.min(Math.max(parseInt(periodParam, 10) || 30, 1), 365);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    const shifts = await prisma.shift.findMany({
      where: {
        employeeProfileId: employee!.sub,
        companyId: companyId!,
        status: 'COMPLETED',
        clockInAt: { gte: fromDate },
      },
      select: {
        totalMinutes: true,
        breakMinutes: true,
        totalSales: true,
        totalRefunds: true,
        totalVoids: true,
        totalTips: true,
        transactionCount: true,
      },
    });

    // Aggregate stats
    const totalShifts = shifts.length;
    let totalMinutes = 0;
    let totalBreakMinutes = 0;
    let totalSales = 0;
    let totalRefunds = 0;
    let totalVoids = 0;
    let totalTips = 0;
    let totalTransactions = 0;

    for (const s of shifts) {
      totalMinutes += s.totalMinutes || 0;
      totalBreakMinutes += s.breakMinutes || 0;
      totalSales += Number(s.totalSales);
      totalRefunds += Number(s.totalRefunds);
      totalVoids += Number(s.totalVoids);
      totalTips += Number(s.totalTips);
      totalTransactions += s.transactionCount;
    }

    const netMinutes = totalMinutes - totalBreakMinutes;
    const hoursWorked = netMinutes / 60;

    return NextResponse.json({
      period: {
        days,
        from: fromDate.toISOString(),
        to: new Date().toISOString(),
      },
      stats: {
        totalShifts,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        totalSales: Math.round(totalSales * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        totalVoids: Math.round(totalVoids * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        totalTransactions,
        avgTicket: totalTransactions > 0
          ? Math.round((totalSales / totalTransactions) * 100) / 100
          : 0,
        salesPerHour: hoursWorked > 0
          ? Math.round((totalSales / hoursWorked) * 100) / 100
          : 0,
        avgShiftHours: totalShifts > 0
          ? Math.round((hoursWorked / totalShifts) * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('NaN')) {
      return badRequest('Invalid period parameter');
    }
    return internalError(error instanceof Error ? error.message : 'Failed to get stats');
  }
}
