/**
 * POST /api/auth/2fa/backup
 * Verify a backup code for 2FA (when authenticator is unavailable).
 * Each backup code can only be used once.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { badRequest, unauthorized, internalError } from '@/lib/api-error';

const backupSchema = z.object({
  code: z.string().min(6).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const body = await request.json();
    const parsed = backupSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid backup code format');

    const { code } = parsed.data;
    const userId = user!.sub;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorBackupCodes: true, twoFactorEnabled: true },
    });

    if (!dbUser?.twoFactorEnabled) {
      return badRequest('2FA is not enabled');
    }

    // Hash the provided code and check against stored hashes
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    const storedCodes = dbUser.twoFactorBackupCodes ?? [];
    const codeIndex = storedCodes.indexOf(hashedCode);

    if (codeIndex === -1) {
      return unauthorized('Invalid backup code');
    }

    // Remove the used backup code
    const updatedCodes = [...storedCodes];
    updatedCodes.splice(codeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedCodes },
    });

    return NextResponse.json({
      success: true,
      remainingBackupCodes: updatedCodes.length,
      message: `Backup code accepted. ${updatedCodes.length} backup codes remaining.`,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Backup code verification failed');
  }
}
