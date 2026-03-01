/**
 * GET /api/employee/pos/managers — List available managers for override modal
 *
 * Returns active managers (SHIFT_MANAGER, STORE_MANAGER) with avatar info
 * for the ManagerOverrideModal component.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const managers = await prisma.employeeProfile.findMany({
      where: {
        companyId: companyId!,
        role: { in: ['SHIFT_MANAGER', 'STORE_MANAGER'] },
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
      },
      orderBy: { firstName: 'asc' },
    });

    return NextResponse.json({ data: managers });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list managers');
  }
}
