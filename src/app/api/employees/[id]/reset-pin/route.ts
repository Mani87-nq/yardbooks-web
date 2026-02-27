/**
 * POST /api/employees/[id]/reset-pin
 * Generate a new random 4-digit PIN for an employee.
 * Returns the PIN in plaintext once (not stored).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { notFound, internalError } from '@/lib/api-error';
import { hashPassword } from '@/lib/auth/password';

type RouteContext = { params: Promise<{ id: string }> };

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.employeeProfile.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
    });
    if (!existing) return notFound('Employee not found');

    const pin = generatePin();
    const pinHash = await hashPassword(pin);

    await prisma.employeeProfile.update({
      where: { id },
      data: {
        pinHash,
        failedPinAttempts: 0,
        lockedUntil: null,
      },
    });

    return NextResponse.json({
      id,
      pin,
      message: 'PIN reset successfully. Share this PIN with the employee securely.',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to reset PIN');
  }
}
