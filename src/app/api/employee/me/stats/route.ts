/**
 * GET /api/employee/me/stats
 * Performance stats for the authenticated employee.
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
    const periodParam = url.searchParams.get('period') || '30'; // days
    const periodDays = Math.min(Number(periodParam) || 30, 365);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - periodDays);

    // Get completed shifts in the period
    const shifts = await prisma.shift.findMany({
      where: {
        employeeProfileId: profile.id,
        companyId: companyId!,
        status: 'COMPLETED',
        clockInAt: { gte: sinceDate },
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

    // Calculate aggregates
    const totalShifts = shifts.length;
    const totalMinutesWorked = shifts.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
    const totalBreakMinutes = shifts.reduce((sum, s) => sum + s.breakMinutes, 0);
    const netMinutesWorked = totalMinutesWorked - totalBreakMinutes;
    const totalSales = shifts.reduce((sum, s) => sum + Number(s.totalSales), 0);
    const totalRefunds = shifts.reduce((sum, s) => sum + Number(s.totalRefunds), 0);
    const totalVoids = shifts.reduce((sum, s) => sum + Number(s.totalVoids), 0);
    const totalTips = shifts.reduce((sum, s) => sum + Number(s.totalTips), 0);
    const totalTransactions = shifts.reduce((sum, s) => sum + s.transactionCount, 0);

    const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    const hoursWorked = netMinutesWorked / 60;
    const salesPerHour = hoursWorked > 0 ? totalSales / hoursWorked : 0;

    return NextResponse.json({
      period: {
        days: periodDays,
        from: sinceDate.toISOString(),
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
        avgTicket: Math.round(avgTicket * 100) / 100,
        salesPerHour: Math.round(salesPerHour * 100) / 100,
        avgShiftHours: totalShifts > 0 ? Math.round((hoursWorked / totalShifts) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get stats');
  }
}
