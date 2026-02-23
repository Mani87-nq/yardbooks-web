/**
 * POST /api/auth/reset-password
 * Complete password reset by validating the token and updating the password.
 *
 * Security:
 * - Token is hashed with SHA-256 and matched against stored hash
 * - Token must not be expired or already used
 * - Password validated with same rules as registration
 * - New password hashed with Argon2id
 * - All existing sessions for the user are invalidated
 * - Used token is deleted
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { badRequest, internalError } from '@/lib/api-error';
import { createRateLimiter } from '@/lib/rate-limit';
import { getClientIP } from '@/lib/rate-limit';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
});

// Rate limit: 5 attempts per 15 minutes per IP
const resetPasswordLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP
    const ip = getClientIP(request);
    const limit = resetPasswordLimiter.check(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          type: 'rate_limit',
          title: 'Too many attempts',
          status: 429,
          detail: 'Please try again later.',
        },
        { status: 429, headers: resetPasswordLimiter.headers(limit) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Token and password are required');
    }

    const { token, password } = parsed.data;

    // Validate password strength
    const passwordIssues = validatePasswordStrength(password);
    if (passwordIssues.length > 0) {
      return badRequest('Password does not meet requirements', {
        password: passwordIssues,
      });
    }

    // Hash the incoming token and look it up
    const hashedToken = hashToken(token);

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!verificationToken) {
      return badRequest(
        'Invalid or expired reset link. Please request a new password reset.'
      );
    }

    // Check this is a password_reset token
    if (verificationToken.type !== 'password_reset') {
      return badRequest(
        'Invalid or expired reset link. Please request a new password reset.'
      );
    }

    // Check expiry
    if (verificationToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });
      return badRequest(
        'This reset link has expired. Please request a new password reset.'
      );
    }

    // Check if already used
    if (verificationToken.usedAt) {
      return badRequest(
        'This reset link has already been used. Please request a new password reset.'
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.email },
      select: { id: true },
    });

    if (!user) {
      // User no longer exists — clean up token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });
      return badRequest(
        'Invalid or expired reset link. Please request a new password reset.'
      );
    }

    // Hash the new password with Argon2id
    const newPasswordHash = await hashPassword(password);

    // Perform all mutations in a transaction
    await prisma.$transaction([
      // Update user's password
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          // Reset lockout on password change
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),

      // Delete the used token
      prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      }),

      // Invalidate all existing sessions for the user
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({
      message:
        'Your password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('[reset-password] Error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to reset password'
    );
  }
}
