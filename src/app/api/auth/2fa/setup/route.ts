/**
 * POST /api/auth/2fa/setup
 * Initialize 2FA setup - generates TOTP secret and backup codes.
 * Returns QR code URL and secret for authenticator app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Secret, TOTP } from 'otpauth';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const userId = user!.sub;

    // Check if 2FA is already enabled
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, email: true },
    });

    if (!dbUser) return badRequest('User not found');
    if (dbUser.twoFactorEnabled) {
      return badRequest('2FA is already enabled. Disable it first to reconfigure.');
    }

    // Generate TOTP secret
    const secret = new Secret({ size: 20 });

    const totp = new TOTP({
      issuer: 'YaadBooks',
      label: dbUser.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    // Generate 10 backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store the secret and backup codes temporarily (pending verification)
    // Hash backup codes before storing
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex')
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorBackupCodes: hashedBackupCodes,
        // Not enabling yet — user must verify first
      },
    });

    return NextResponse.json({
      secret: secret.base32,
      otpauthUrl: totp.toString(),
      backupCodes, // Show plain-text backup codes ONCE
      message: 'Scan the QR code with your authenticator app, then verify with a code to complete setup.',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : '2FA setup failed');
  }
}
