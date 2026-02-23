/**
 * POST /api/auth/forgot-password
 * Initiate password reset by sending a reset link to the user's email.
 *
 * Security:
 * - Rate limited: 3 requests per 15 minutes per email
 * - Always returns success (never leaks whether email exists)
 * - Token is hashed with SHA-256 before storage (DB compromise safe)
 * - Token expires in 1 hour
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/email/service';
import { passwordResetEmail } from '@/lib/email/templates';
import { badRequest, internalError } from '@/lib/api-error';
import { createRateLimiter } from '@/lib/rate-limit';

const forgotPasswordSchema = z.object({
  email: z.email(),
});

// Strict rate limit: 3 requests per 15 minutes per email
const forgotPasswordLimiter = createRateLimiter({
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Generic success message — never leak whether the email exists
const SUCCESS_MESSAGE =
  'If an account exists with this email, you will receive a password reset link shortly.';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Please provide a valid email address');
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit per email address
    const limit = forgotPasswordLimiter.check(normalizedEmail);
    if (!limit.allowed) {
      // Still return success to avoid leaking rate-limit info per email
      return NextResponse.json(
        { message: SUCCESS_MESSAGE },
        { status: 200, headers: forgotPasswordLimiter.headers(limit) }
      );
    }

    // Look up the user — but always return the same response
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, firstName: true, email: true },
    });

    if (user) {
      // Delete any existing password_reset tokens for this email
      await prisma.verificationToken.deleteMany({
        where: { email: normalizedEmail, type: 'password_reset' },
      });

      // Generate a cryptographically secure token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = hashToken(rawToken);

      // Store the hashed token
      await prisma.verificationToken.create({
        data: {
          email: normalizedEmail,
          token: hashedToken,
          type: 'password_reset',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Build reset URL with the RAW token (user receives this)
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      // Send email
      const emailContent = passwordResetEmail({
        userName: user.firstName,
        resetUrl,
      });

      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    // Always return the same success response
    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return internalError(
      error instanceof Error ? error.message : 'Failed to process request'
    );
  }
}
