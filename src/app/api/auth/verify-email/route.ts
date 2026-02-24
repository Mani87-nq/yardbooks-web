/**
 * POST /api/auth/verify-email
 * Verify user email address using a verification token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { badRequest, internalError } from '@/lib/api-error';

const verifySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid token');

    const { token } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: tokenHash,
        type: 'email_verify',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return badRequest('Invalid or expired verification link');
    }

    // Mark email as verified and token as used
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { email: verificationToken.email },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Verification failed');
  }
}
