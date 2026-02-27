/**
 * GET /api/pos/employees
 * Return employee list for kiosk login screen.
 * Only returns non-sensitive data: names, avatar colors, roles.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const employees = await prisma.employeeProfile.findMany({
      where: {
        companyId: companyId!,
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
          select: { id: true, clockInAt: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    // Transform to add isClockedIn flag without exposing shift details
    const result = employees.map((emp) => ({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      displayName: emp.displayName,
      avatarColor: emp.avatarColor,
      role: emp.role,
      isClockedIn: emp.shifts.length > 0,
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list POS employees');
  }
}
