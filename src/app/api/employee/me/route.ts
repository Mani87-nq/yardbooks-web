/**
 * GET /api/employee/me
 * Get own employee profile (limited data for employee view).
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        avatarColor: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!profile) return notFound('Employee profile not found for this user');

    return NextResponse.json(profile);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get profile');
  }
}
