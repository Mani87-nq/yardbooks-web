/**
 * GET /api/modules/salon/stylists/[id]/commission — Commission report for a stylist
 * Query params: from (ISO date), to (ISO date)
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:stylists:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return badRequest('Both "from" and "to" date parameters are required');
    }

    // Verify stylist belongs to company
    const stylist = await (prisma as any).stylist.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!stylist) return notFound('Stylist not found');

    // Get completed appointments in range
    const appointments = await (prisma as any).appointment.findMany({
      where: {
        stylistId: id,
        companyId: companyId!,
        status: 'COMPLETED',
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: {
        services: {
          include: { service: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Also get completed walk-ins
    const walkIns = await (prisma as any).walkIn.findMany({
      where: {
        assignedStylistId: id,
        companyId: companyId!,
        status: 'COMPLETED',
        completedAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
    });

    // Calculate commission breakdown
    let totalRevenue = 0;
    let totalCommission = 0;
    const serviceBreakdown: Record<
      string,
      { serviceName: string; count: number; revenue: number; commission: number }
    > = {};

    for (const appt of appointments) {
      for (const apptSvc of appt.services) {
        const price = Number(apptSvc.price || 0);
        const commission = Number(apptSvc.commission || 0);
        totalRevenue += price;
        totalCommission += commission;

        const svcName = apptSvc.service?.name || 'Unknown Service';
        if (!serviceBreakdown[apptSvc.serviceId]) {
          serviceBreakdown[apptSvc.serviceId] = {
            serviceName: svcName,
            count: 0,
            revenue: 0,
            commission: 0,
          };
        }
        serviceBreakdown[apptSvc.serviceId].count += 1;
        serviceBreakdown[apptSvc.serviceId].revenue += price;
        serviceBreakdown[apptSvc.serviceId].commission += commission;
      }
    }

    // Walk-in revenue (no detailed service breakdown available)
    const walkInRevenue = walkIns.reduce(
      (sum: number, w: any) => sum + Number(w.totalPrice || 0),
      0
    );

    return NextResponse.json({
      stylist: {
        id: stylist.id,
        displayName: stylist.displayName,
        defaultCommissionType: stylist.defaultCommissionType,
        defaultCommissionRate: Number(stylist.defaultCommissionRate),
      },
      period: { from, to },
      summary: {
        totalAppointments: appointments.length,
        totalWalkIns: walkIns.length,
        totalRevenue: totalRevenue + walkInRevenue,
        appointmentRevenue: totalRevenue,
        walkInRevenue,
        totalCommission,
      },
      serviceBreakdown: Object.values(serviceBreakdown),
      appointments: appointments.map((a: any) => ({
        id: a.id,
        date: a.date,
        customerName: a.customerName,
        services: a.services.map((s: any) => ({
          name: s.service?.name,
          price: Number(s.price),
          commission: Number(s.commission),
        })),
        totalPrice: Number(a.totalPrice),
      })),
    });
  } catch (error) {
    return internalError(
      error instanceof Error ? error.message : 'Failed to generate commission report'
    );
  }
}
