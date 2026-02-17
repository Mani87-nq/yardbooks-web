/**
 * POST /api/v1/sod/check
 * Check whether an action would violate a Segregation of Duties rule.
 *
 * Request body:
 *   { action: string, entityType: string, entityId: string }
 *
 * Response:
 *   { allowed: boolean, conflict?: { rule, conflictingUserId, description } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { checkSoDConflict } from '@/lib/sod';

const checkSoDSchema = z.object({
  action: z.string().min(1, 'action is required'),
  entityType: z.string().min(1, 'entityType is required'),
  entityId: z.string().min(1, 'entityId is required'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = checkSoDSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { action, entityType, entityId } = parsed.data;

    const result = await checkSoDConflict({
      userId: user!.sub,
      action,
      entityType,
      entityId,
      companyId: companyId!,
    });

    return NextResponse.json(result);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to check SoD conflict');
  }
}
