/**
 * PUT    /api/v1/team/[memberId] — Update a team member's role.
 * DELETE /api/v1/team/[memberId] — Remove a team member.
 *
 * Security:
 * - PUT requires `users:update`, DELETE requires `users:delete`.
 * - Cannot modify/remove yourself.
 * - Cannot modify/remove the OWNER.
 * - Cannot promote someone to a role >= your own.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';
import { compareRoles, type Role } from '@/lib/auth/rbac';

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'STAFF', 'READ_ONLY']),
});

// ============================================
// PUT — Update member role
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    // 1. Auth + permission
    const { user, error: authError } = await requirePermission(request, 'users:update');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Validate body
    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { role: newRole } = parsed.data;

    // 4. Find the target member (scoped to this company)
    const member = await prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!member) {
      return notFound('Team member not found');
    }

    // 5. Cannot change your own role
    if (member.userId === user!.sub) {
      return forbidden('You cannot change your own role');
    }

    // 6. Cannot modify OWNER
    if (member.role === 'OWNER') {
      return forbidden('The OWNER role cannot be modified');
    }

    // 7. Cannot promote to OWNER
    if (newRole === 'OWNER') {
      return forbidden('Cannot assign OWNER role. There can only be one OWNER.');
    }

    // 8. Role hierarchy — cannot promote above own role
    const actorRole = user!.role as Role;
    const targetNewRole = newRole as Role;

    if (compareRoles(targetNewRole, actorRole) >= 0) {
      return forbidden('Cannot assign a role equal to or higher than your own');
    }

    // 9. Also cannot modify someone whose current role is >= yours
    if (compareRoles(member.role as Role, actorRole) >= 0) {
      return forbidden('Cannot modify a member with a role equal to or higher than your own');
    }

    // 10. Perform the update
    const updated = await prisma.companyMember.update({
      where: { id: memberId },
      data: { role: targetNewRole },
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

    return NextResponse.json({
      data: {
        id: updated.id,
        userId: updated.user.id,
        firstName: updated.user.firstName,
        lastName: updated.user.lastName,
        email: updated.user.email,
        avatarUrl: updated.user.avatarUrl,
        role: updated.role,
        isActive: updated.user.isActive,
        lastLoginAt: updated.user.lastLoginAt,
        joinedAt: updated.createdAt,
      },
      message: `${updated.user.firstName} ${updated.user.lastName}'s role has been updated to ${newRole}.`,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update team member');
  }
}

// ============================================
// DELETE — Remove member from team
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    // 1. Auth + permission
    const { user, error: authError } = await requirePermission(request, 'users:delete');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Find the target member (scoped to this company)
    const member = await prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, activeCompanyId: true },
        },
      },
    });

    if (!member) {
      return notFound('Team member not found');
    }

    // 4. Cannot remove yourself
    if (member.userId === user!.sub) {
      return forbidden('You cannot remove yourself from the team');
    }

    // 5. Cannot remove OWNER
    if (member.role === 'OWNER') {
      return forbidden('The OWNER cannot be removed from the company');
    }

    // 6. Cannot remove someone whose role is >= yours
    const actorRole = user!.role as Role;
    if (compareRoles(member.role as Role, actorRole) >= 0) {
      return forbidden('Cannot remove a member with a role equal to or higher than your own');
    }

    // 7. Delete the membership
    await prisma.companyMember.delete({
      where: { id: memberId },
    });

    // 8. Cleanup: if this was the removed user's activeCompanyId, reset it
    if (member.user.activeCompanyId === companyId) {
      // Find another company this user belongs to
      const otherMembership = await prisma.companyMember.findFirst({
        where: { userId: member.userId },
        select: { companyId: true },
      });

      await prisma.user.update({
        where: { id: member.userId },
        data: { activeCompanyId: otherMembership?.companyId ?? null },
      });
    }

    return NextResponse.json({
      message: `${member.user.firstName} ${member.user.lastName} has been removed from the team.`,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to remove team member');
  }
}
