/**
 * POST /api/sync/push/actions
 *
 * Receives offline POS actions (audit log entries) from the client.
 * Actions represent voids, refunds, discounts, cash drawer events, etc.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:create');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const { actions } = body;

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json(
        { error: 'Missing required field: actions (array)' },
        { status: 400 }
      );
    }

    let synced = 0;
    const errors: Array<{ offlineId: string; reason: string }> = [];

    for (const action of actions) {
      try {
        // Idempotency: skip if already synced (offlineId field planned for schema)
        const existing = await (prisma.pOSAction as any).findFirst({
          where: { companyId: companyId!, description: `offline:${action.offlineId}` },
        });

        if (existing) {
          synced++;
          continue;
        }

        await prisma.pOSAction.create({
          data: {
            companyId: companyId!,
            employeeProfileId: action.employeeId,
            actionType: action.actionType,
            description: `offline:${action.offlineId}`,
            metadata: (action.details || {}) as any,
          },
        });
        synced++;
      } catch (err) {
        errors.push({
          offlineId: action.offlineId,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      synced,
      errors,
      total: actions.length,
    });
  } catch (error) {
    console.error('[SYNC] Actions push error:', error);
    return NextResponse.json(
      { error: 'Failed to sync actions' },
      { status: 500 }
    );
  }
}
