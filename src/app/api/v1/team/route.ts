/**
 * GET /api/v1/team — List team members for the active company.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    // 1. Auth + permission check
    const { user, error: authError } = await requirePermission(request, 'users:read');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Fetch members with user details
    const members = await prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            lastLoginAt: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Get plan info for user limits
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionPlan: true },
    });

    // Map plan enum to billing service plan id
    const planMap: Record<string, string> = {
      STARTER: 'starter',
      BUSINESS: 'business',
      PRO: 'pro',
      ENTERPRISE: 'enterprise',
    };

    const planId = planMap[company?.subscriptionPlan ?? 'STARTER'] ?? 'starter';

    // Dynamic import to avoid circular deps
    const { checkPlanLimits } = await import('@/lib/billing/service');
    const { userLimit } = checkPlanLimits(planId, members.length, 0);

    return NextResponse.json({
      data: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        isActive: m.user.isActive,
        lastLoginAt: m.user.lastLoginAt,
        joinedAt: m.createdAt,
      })),
      meta: {
        totalMembers: members.length,
        maxMembers: userLimit,
        planId,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list team members');
  }
}
