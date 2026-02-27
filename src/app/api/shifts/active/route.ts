/**
 * GET /api/shifts/active
 * Get the active shift for the authenticated employee.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const url = new URL(request.url);
    const employeeProfileId = url.searchParams.get('employeeProfileId');

    if (!employeeProfileId) return badRequest('employeeProfileId is required');

    const shift = await prisma.shift.findFirst({
      where: {
        employeeProfileId,
        companyId: companyId!,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
      include: {
        breaks: {
          orderBy: { startAt: 'desc' },
        },
        cashDrawerEvents: {
          orderBy: { createdAt: 'desc' },
        },
        tipRecords: true,
      },
    });

    if (!shift) {
      return NextResponse.json({ shift: null });
    }

    // Calculate current duration
    const now = new Date();
    const currentMinutes = Math.round((now.getTime() - shift.clockInAt.getTime()) / 60000);

    return NextResponse.json({
      shift,
      currentMinutes,
      netMinutes: currentMinutes - shift.breakMinutes,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get active shift');
  }
}
