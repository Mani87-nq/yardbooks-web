/**
 * POST /api/pos/auth/pin
 * PIN-based authentication for POS/Kiosk mode.
 *
 * Brute force protection:
 * - 3 failures = 30s lockout
 * - 5 failures = 5min lockout
 * - 10 failures = account lock (requires admin reset)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';
import { verifyPassword } from '@/lib/auth/password';

const pinAuthSchema = z.object({
  employeeProfileId: z.string().min(1),
  pin: z.string().min(4).max(6).regex(/^\d+$/),
});

function getLockoutDuration(failedAttempts: number): number | null {
  if (failedAttempts >= 10) return null; // Permanent lock
  if (failedAttempts >= 5) return 5 * 60 * 1000; // 5 minutes
  if (failedAttempts >= 3) return 30 * 1000; // 30 seconds
  return 0; // No lockout
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = pinAuthSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid PIN format');

    const { employeeProfileId, pin } = parsed.data;

    // Find the employee profile
    const employee = await prisma.employeeProfile.findFirst({
      where: {
        id: employeeProfileId,
        companyId: companyId!,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarColor: true,
        role: true,
        permissions: true,
        pinHash: true,
        failedPinAttempts: true,
        lockedUntil: true,
        isActive: true,
        shifts: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: {
            id: true,
            clockInAt: true,
            status: true,
            terminalId: true,
          },
        },
      },
    });

    if (!employee) return notFound('Employee not found');

    if (!employee.isActive) {
      return forbidden('Account is deactivated. Contact your manager.');
    }

    // Check if account is permanently locked (10+ failures)
    if (employee.failedPinAttempts >= 10) {
      // Log the failed attempt
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: 'Account permanently locked - too many failed attempts',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return forbidden('Account is locked due to too many failed PIN attempts. Contact your manager to reset.');
    }

    // Check if temporarily locked
    if (employee.lockedUntil && new Date() < employee.lockedUntil) {
      const remainingSeconds = Math.ceil((employee.lockedUntil.getTime() - Date.now()) / 1000);

      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: `Account temporarily locked. ${remainingSeconds}s remaining.`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: `Account temporarily locked. Try again in ${remainingSeconds} seconds.`,
          retryAfter: remainingSeconds,
        },
        { status: 429 }
      );
    }

    // Verify PIN
    const isValid = await verifyPassword(pin, employee.pinHash);

    if (!isValid) {
      const newAttempts = employee.failedPinAttempts + 1;
      const lockoutMs = getLockoutDuration(newAttempts);

      const updateData: Record<string, unknown> = {
        failedPinAttempts: newAttempts,
      };

      if (lockoutMs === null) {
        // Permanent lock
        updateData.lockedUntil = new Date('2099-12-31');
      } else if (lockoutMs > 0) {
        updateData.lockedUntil = new Date(Date.now() + lockoutMs);
      }

      await prisma.employeeProfile.update({
        where: { id: employee.id },
        data: updateData,
      });

      // Log failed attempt
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: `Failed PIN attempt #${newAttempts}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          metadata: { attempt: newAttempts },
        },
      });

      if (newAttempts >= 10) {
        return forbidden('Account locked. Too many failed PIN attempts. Contact your manager.');
      }

      const remainingAttempts = (newAttempts < 3 ? 3 : newAttempts < 5 ? 5 : 10) - newAttempts;
      return badRequest(`Incorrect PIN. ${remainingAttempts} attempt(s) remaining before lockout.`);
    }

    // PIN is valid - reset failed attempts and update last login
    await prisma.employeeProfile.update({
      where: { id: employee.id },
      data: {
        failedPinAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Get active shift if any
    const activeShift = employee.shifts[0] || null;

    return NextResponse.json({
      authenticated: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        displayName: employee.displayName,
        avatarColor: employee.avatarColor,
        role: employee.role,
        permissions: employee.permissions,
      },
      activeShift,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'PIN authentication failed');
  }
}
