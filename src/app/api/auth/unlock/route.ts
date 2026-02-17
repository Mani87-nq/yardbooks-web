/**
 * POST /api/auth/unlock
 * Admin endpoint to unlock a locked user account.
 * Requires 'settings:write' permission.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requirePermission } from '@/lib/auth/middleware';
import { adminUnlockAccount } from '@/lib/account-lockout';
import { badRequest, internalError } from '@/lib/api-error';

const unlockSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Require admin-level permission
    const { user, error } = await requirePermission(request, 'settings:write');
    if (error) return error;

    const body = await request.json();
    const parsed = unlockSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest('Invalid request body', {
        userId: parsed.error.issues.map((i) => i.message),
      });
    }

    const { userId } = parsed.data;

    await adminUnlockAccount(userId);

    return NextResponse.json({
      message: `Account ${userId} has been unlocked successfully.`,
    });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : 'Failed to unlock account');
  }
}
