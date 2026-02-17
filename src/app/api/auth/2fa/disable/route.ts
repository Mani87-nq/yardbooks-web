/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for the authenticated user.
 * Requires current password or valid TOTP code for confirmation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { TOTP, Secret } from 'otpauth';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';

const disableSchema = z.object({
  password: z.string().optional(),
  totpCode: z.string().length(6).optional(),
}).refine((data) => data.password || data.totpCode, {
  message: 'Either password or TOTP code is required',
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const body = await request.json();
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) return badRequest('Either password or TOTP code is required');

    const { password, totpCode } = parsed.data;
    const userId = user!.sub;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true, passwordHash: true, email: true },
    });

    if (!dbUser?.twoFactorEnabled) {
      return badRequest('2FA is not currently enabled');
    }

    // Verify identity
    let verified = false;

    if (password && dbUser.passwordHash) {
      verified = await verifyPassword(password, dbUser.passwordHash);
    }

    if (!verified && totpCode && dbUser.twoFactorSecret) {
      const totp = new TOTP({
        issuer: 'YardBooks',
        label: dbUser.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(dbUser.twoFactorSecret),
      });
      const delta = totp.validate({ token: totpCode, window: 1 });
      verified = delta !== null;
    }

    if (!verified) {
      return unauthorized('Invalid password or TOTP code');
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled.',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to disable 2FA');
  }
}
