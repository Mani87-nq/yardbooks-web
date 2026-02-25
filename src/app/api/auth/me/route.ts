/**
 * GET /api/auth/me
 * Get the current authenticated user's profile and company memberships.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = await requireAuth(request);
    if (error) return error;

    const user = await prisma.user.findUnique({
      where: { id: authUser!.sub },
      include: {
        companyMemberships: {
          include: { company: true },
        },
      },
    });

    if (!user) {
      return new NextResponse(null, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        activeCompanyId: user.activeCompanyId,
        createdAt: user.createdAt,
        passwordChangedAt: user.passwordChangedAt,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      companies: user.companyMemberships.map((m) => ({
        id: m.company.id,
        businessName: m.company.businessName,
        tradingName: m.company.tradingName,
        role: m.role,
      })),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to fetch profile');
  }
}
