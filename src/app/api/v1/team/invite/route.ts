/**
 * POST /api/v1/team/invite — Invite a user to the company.
 *
 * - If the user already exists, create a CompanyMember record directly.
 * - If the user does not exist, still create the record as "pending" (the user
 *   will need to register first and the membership will be associated then).
 *
 * Security:
 * - Requires `users:create` permission (ADMIN or OWNER only).
 * - Cannot invite someone with a role higher than the inviter's own role.
 * - Enforces plan user-limit via checkPlanLimits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, conflict, forbidden, internalError } from '@/lib/api-error';
import { compareRoles, type Role } from '@/lib/auth/rbac';
import { checkPlanLimits } from '@/lib/billing/service';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'STAFF', 'READ_ONLY']),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Auth + permission check
    const { user, error: authError } = await requirePermission(request, 'users:create');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Validate body
    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { email, role } = parsed.data;

    // 4. Role hierarchy check — inviter cannot assign a role higher than their own
    const inviterRole = user!.role as Role;
    const targetRole = role as Role;

    if (compareRoles(targetRole, inviterRole) >= 0) {
      return forbidden('Cannot invite a user with a role equal to or higher than your own');
    }

    // OWNER role cannot be assigned through invites
    if (targetRole === 'OWNER') {
      return forbidden('OWNER role cannot be assigned through invitations');
    }

    // 5. Check plan limits
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionPlan: true },
    });

    const planMap: Record<string, string> = {
      STARTER: 'starter',
      BUSINESS: 'business',
      PRO: 'pro',
      ENTERPRISE: 'enterprise',
    };
    const planId = planMap[company?.subscriptionPlan ?? 'STARTER'] ?? 'starter';

    const currentMemberCount = await prisma.companyMember.count({
      where: { companyId },
    });

    const { withinLimits, userLimit } = checkPlanLimits(planId, currentMemberCount + 1, 0);
    if (!withinLimits) {
      return badRequest(
        `Your ${company?.subscriptionPlan ?? 'Starter'} plan allows a maximum of ${userLimit} user(s). Please upgrade your plan to add more team members.`
      );
    }

    // 6. Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!existingUser) {
      // User doesn't exist yet — return a note that the user needs to register.
      // In a production system we would send an invite email and store a pending invite record.
      return badRequest(
        'No account found with this email address. The user must register for a YaadBooks account first, then you can add them to your team.'
      );
    }

    // 7. Check if already a member
    const existingMember = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMember) {
      return conflict('This user is already a member of your company');
    }

    // 8. Create the membership
    const membership = await prisma.companyMember.create({
      data: {
        companyId,
        userId: existingUser.id,
        role: targetRole,
      },
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
    });

    return NextResponse.json(
      {
        data: {
          id: membership.id,
          userId: membership.user.id,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          email: membership.user.email,
          avatarUrl: membership.user.avatarUrl,
          role: membership.role,
          isActive: membership.user.isActive,
          lastLoginAt: membership.user.lastLoginAt,
          joinedAt: membership.createdAt,
        },
        message: `${existingUser.firstName} ${existingUser.lastName} has been added to your team as ${role}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to invite team member');
  }
}
