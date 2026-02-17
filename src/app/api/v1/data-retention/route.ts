/**
 * GET  /api/v1/data-retention — Check data retention status (find expired records)
 * POST /api/v1/data-retention — Run cleanup or export user data
 *
 * Requires 'settings:update' permission (ADMIN or OWNER).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import {
  RETENTION_PERIODS,
  findExpiredRecords,
  cleanupExpiredData,
  exportUserData,
} from '@/lib/data-retention';

// ─── GET (Check retention status) ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const status = await findExpiredRecords(companyId!);

    return NextResponse.json({
      retentionPolicies: RETENTION_PERIODS,
      ...status,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to check data retention status');
  }
}

// ─── POST (Run action) ────────────────────────────────────────────

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cleanup'),
  }),
  z.object({
    action: z.literal('export_user_data'),
    userId: z.string().min(1),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const data = parsed.data;

    if (data.action === 'cleanup') {
      const result = await cleanupExpiredData(companyId!);
      return NextResponse.json({
        message: 'Cleanup completed successfully',
        ...result,
      });
    }

    if (data.action === 'export_user_data') {
      const exportData = await exportUserData(data.userId);
      return NextResponse.json({
        message: 'User data exported successfully',
        exportedAt: new Date().toISOString(),
        data: exportData,
      });
    }

    return badRequest('Unknown action');
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to execute data retention action');
  }
}
