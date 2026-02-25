/**
 * POST /api/auth/change-password
 * Change the authenticated user's password.
 *
 * Security:
 * - Requires valid access token (Bearer)
 * - Verifies current password via Argon2id
 * - Validates new password strength (12+ chars, upper, lower, number, special)
 * - Checks password history (last 5) to prevent reuse
 * - Checks HIBP breach database via k-anonymity
 * - Hashes new password with Argon2id
 * - Invalidates all sessions except the current one
 * - Rate limited: 5 attempts per 15 minutes per IP
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { checkPasswordHistory, checkPasswordBreached } from '@/lib/password-security';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';
import { createRateLimiter, getClientIP } from '@/lib/rate-limit';

// Rate limit: 5 attempts per 15 minutes per IP
const changePasswordLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP
    const ip = getClientIP(request);
    const limit = changePasswordLimiter.check(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          type: 'rate_limit',
          title: 'Too many attempts',
          status: 429,
          detail: 'Too many password change attempts. Please try again later.',
        },
        { status: 429, headers: changePasswordLimiter.headers(limit) }
      );
    }

    // Authenticate via access token
    const auth = await getAuthUser(request);
    if (!auth) {
      return unauthorized('Authentication required');
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'password';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { currentPassword, newPassword } = parsed.data;

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: {
        id: true,
        passwordHash: true,
        passwordHistory: true,
      },
    });

    if (!user) {
      return badRequest('User not found');
    }

    // OAuth-only users have no passwordHash
    if (!user.passwordHash) {
      return badRequest('Set a password first using forgot-password flow');
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return badRequest('Current password is incorrect');
    }

    // Check password history (prevents reuse of last 5)
    const isReused = await checkPasswordHistory(user.id, newPassword);
    if (isReused) {
      return badRequest('This password has been used recently. Please choose a different password.');
    }

    // Check HIBP breach database
    const breachResult = await checkPasswordBreached(newPassword);
    if (breachResult.breached) {
      return badRequest(
        'This password has appeared in a data breach. Please choose a different password.'
      );
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(newPassword);

    // Build the updated password history (keep last 5, push old hash)
    const oldHistory: string[] = user.passwordHistory ?? [];
    const updatedHistory = [user.passwordHash, ...oldHistory].slice(0, 5);

    // Identify the current session by matching the bearer token
    const authHeader = request.headers.get('Authorization');
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Find current session
    let currentSessionId: string | null = null;
    if (currentToken) {
      const currentSession = await prisma.session.findUnique({
        where: { token: currentToken },
        select: { id: true },
      });
      currentSessionId = currentSession?.id ?? null;
    }

    // Transaction: update password + delete other sessions
    await prisma.$transaction([
      // Update user password and history
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          passwordHistory: updatedHistory,
        },
      }),
      // Delete all sessions except current
      ...(currentSessionId
        ? [
            prisma.session.deleteMany({
              where: {
                userId: user.id,
                id: { not: currentSessionId },
              },
            }),
          ]
        : [
            prisma.session.deleteMany({
              where: { userId: user.id },
            }),
          ]),
    ]);

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('[change-password] Error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to change password'
    );
  }
}
