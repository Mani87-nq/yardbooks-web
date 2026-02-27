/**
 * GET /api/sync/pull/employees
 *
 * Returns the employee list with PIN hashes for offline POS authentication.
 * Only accessible by users with admin/owner permissions.
 * PIN hashes are Argon2 — they're safe to cache on device.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const where: Record<string, unknown> = {
      companyId: companyId!,
    };

    if (since) {
      const sinceDate = new Date(parseInt(since));
      where.updatedAt = { gte: sinceDate };
    }

    const employees = await prisma.employeeProfile.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        avatarColor: true,
        pinHash: true,
        role: true,
        permissions: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: { displayName: 'asc' },
    });

    // Transform permissions JSON to typed object
    const offlineEmployees = employees.map(e => {
      const perms = (e.permissions as Record<string, unknown>) || {};
      return {
        id: e.id,
        displayName: e.displayName,
        avatarColor: e.avatarColor || '#10b981',
        pinHash: e.pinHash,
        posRole: e.role,
        permissions: {
          canVoid: Boolean(perms.canVoid),
          canRefund: Boolean(perms.canRefund),
          canDiscount: Boolean(perms.canDiscount),
          maxDiscountPct: Number(perms.maxDiscountPct) || 0,
          canOpenDrawer: Boolean(perms.canOpenDrawer),
          canApplyPriceOverride: Boolean(perms.canApplyPriceOverride),
        },
        isActive: e.isActive,
        lastSynced: Date.now(),
      };
    });

    return NextResponse.json({
      employees: offlineEmployees,
      count: offlineEmployees.length,
      syncTimestamp: Date.now(),
    });
  } catch (error) {
    console.error('[SYNC] Employees pull error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees for offline cache' },
      { status: 500 }
    );
  }
}
