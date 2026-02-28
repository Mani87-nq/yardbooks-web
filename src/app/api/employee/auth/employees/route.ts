/**
 * GET /api/employee/auth/employees?code=YB4K9M
 * Return employee list for kiosk avatar grid login screen.
 * PUBLIC endpoint — no JWT required, only needs valid company code.
 * Returns only non-sensitive data: names, avatar colors, roles.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { badRequest, notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    if (!code || code.length < 1 || code.length > 10) {
      return badRequest('Company code is required.');
    }

    // Find company by terminal code
    const company = await prisma.company.findFirst({
      where: {
        terminalCode: code.toUpperCase(),
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        businessName: true,
        tradingName: true,
      },
    });

    if (!company) {
      return notFound('Invalid company code. Please check with your manager.');
    }

    // Fetch active employees
    const employees = await prisma.employeeProfile.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarColor: true,
        role: true,
        // Check if currently clocked in
        shifts: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    // Transform — add isClockedIn flag, strip shift details
    const result = employees.map((emp) => ({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      displayName: emp.displayName,
      avatarColor: emp.avatarColor,
      role: emp.role,
      isClockedIn: emp.shifts.length > 0,
    }));

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.tradingName || company.businessName,
      },
      data: result,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list employees');
  }
}
