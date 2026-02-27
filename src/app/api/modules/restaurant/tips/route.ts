/**
 * GET /api/modules/restaurant/tips — List tips from closed table sessions
 *
 * Tips are derived from TableSession records where tipAmount > 0.
 * The serverId links to EmployeeProfile for server names.
 *
 * Query params:
 *  - from (ISO date string, optional)
 *  - to (ISO date string, optional)
 *  - serverId (optional - filter by specific server)
 *  - period: "today" | "week" | "month" | "all" (shortcut for date ranges)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(
      request,
      'restaurant:tips:read'
    );
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const serverId = searchParams.get('serverId');
    let from = searchParams.get('from');
    let to = searchParams.get('to');

    // Period shortcuts
    if (!from && !to) {
      const now = new Date();
      if (period === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      } else if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        from = weekAgo.toISOString();
      } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        from = monthAgo.toISOString();
      }
    }

    // Build where clause
    const where: any = {
      companyId: companyId!,
      tipAmount: { gt: 0 },
      status: 'CLOSED',
      ...(from || to
        ? {
            closedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(serverId ? { serverId } : {}),
    };

    // Fetch table sessions with tips
    const sessions = await (prisma as any).tableSession.findMany({
      where,
      select: {
        id: true,
        serverId: true,
        tableId: true,
        tipAmount: true,
        total: true,
        closedAt: true,
        guestCount: true,
        table: {
          select: {
            number: true,
            name: true,
          },
        },
      },
      orderBy: { closedAt: 'desc' },
      take: 200,
    });

    // Fetch server names for all unique serverIds
    const serverIds = [...new Set(sessions.map((s: any) => s.serverId).filter(Boolean))] as string[];
    const employees = serverIds.length > 0
      ? await prisma.employeeProfile.findMany({
          where: { id: { in: serverIds } },
          select: { id: true, firstName: true, lastName: true, displayName: true },
        })
      : [];

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Transform data
    const tips = sessions.map((session: any) => {
      const server = session.serverId ? employeeMap.get(session.serverId) : null;
      const serverName = server
        ? server.displayName || `${server.firstName} ${server.lastName}`
        : 'Unassigned';

      return {
        id: session.id,
        serverName,
        serverId: session.serverId,
        amount: Number(session.tipAmount),
        orderTotal: Number(session.total),
        tableNumber: session.table?.number || 0,
        tableName: session.table?.name || null,
        date: session.closedAt?.toISOString() || null,
        guestCount: session.guestCount,
      };
    });

    // Calculate aggregates
    const totalTips = tips.reduce((sum: number, t: any) => sum + t.amount, 0);
    const avgTip = tips.length > 0 ? totalTips / tips.length : 0;

    // Server breakdown
    const serverBreakdown: Record<string, { name: string; total: number; count: number }> = {};
    for (const tip of tips) {
      if (!serverBreakdown[tip.serverName]) {
        serverBreakdown[tip.serverName] = { name: tip.serverName, total: 0, count: 0 };
      }
      serverBreakdown[tip.serverName].total += tip.amount;
      serverBreakdown[tip.serverName].count += 1;
    }

    return NextResponse.json({
      data: tips,
      summary: {
        totalTips,
        avgTip: Math.round(avgTip * 100) / 100,
        transactionCount: tips.length,
        serverBreakdown: Object.values(serverBreakdown).sort((a, b) => b.total - a.total),
      },
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to fetch tips'
    );
  }
}
