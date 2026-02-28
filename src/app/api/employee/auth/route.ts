/**
 * POST /api/employee/auth
 * PIN-based authentication for the Employee Portal / Kiosk mode.
 * PUBLIC endpoint — no user JWT required.
 *
 * Flow: Company code + Employee ID + PIN → Terminal JWT cookie
 *
 * Brute force protection (same escalation as /api/pos/auth/pin):
 * - 3 failures = 30s lockout
 * - 5 failures = 5min lockout
 * - 10 failures = permanent lock (requires admin reset)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import {
  signTerminalToken,
  TERMINAL_TOKEN_COOKIE,
  getTerminalTokenCookieOptions,
} from '@/lib/auth/terminal-jwt';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';

const authSchema = z.object({
  companyCode: z.string().min(1).max(10).trim(),
  employeeProfileId: z.string().min(1),
  pin: z.string().min(4).max(6).regex(/^\d+$/),
});

function getLockoutDuration(failedAttempts: number): number | null {
  if (failedAttempts >= 10) return null; // Permanent lock
  if (failedAttempts >= 5) return 5 * 60 * 1000; // 5 minutes
  if (failedAttempts >= 3) return 30 * 1000; // 30 seconds
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid request. Provide companyCode, employeeProfileId, and pin.');
    }

    const { companyCode, employeeProfileId, pin } = parsed.data;

    // 1. Find company by terminal code
    const company = await prisma.company.findFirst({
      where: {
        terminalCode: companyCode.toUpperCase(),
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        businessName: true,
        tradingName: true,
      },
    });

    if (!company) {
      return notFound('Invalid company code. Please check with your manager.');
    }

    // 2. Find the employee profile
    const employee = await prisma.employeeProfile.findFirst({
      where: {
        id: employeeProfileId,
        companyId: company.id,
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

    if (!employee) {
      return notFound('Employee not found.');
    }

    if (!employee.isActive) {
      return forbidden('Account is deactivated. Contact your manager.');
    }

    // 3. Check permanent lock (10+ failures)
    if (employee.failedPinAttempts >= 10) {
      await prisma.pOSAction.create({
        data: {
          companyId: company.id,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: 'Account permanently locked - too many failed attempts (terminal login)',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });
      return forbidden('Account is locked due to too many failed PIN attempts. Contact your manager to reset.');
    }

    // 4. Check temporary lockout
    if (employee.lockedUntil && new Date() < employee.lockedUntil) {
      const remainingSeconds = Math.ceil((employee.lockedUntil.getTime() - Date.now()) / 1000);
      await prisma.pOSAction.create({
        data: {
          companyId: company.id,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: `Account temporarily locked. ${remainingSeconds}s remaining. (terminal login)`,
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

    // 5. Verify PIN
    const isValid = await verifyPassword(pin, employee.pinHash);

    if (!isValid) {
      const newAttempts = employee.failedPinAttempts + 1;
      const lockoutMs = getLockoutDuration(newAttempts);

      const updateData: Record<string, unknown> = {
        failedPinAttempts: newAttempts,
      };

      if (lockoutMs === null) {
        updateData.lockedUntil = new Date('2099-12-31');
      } else if (lockoutMs > 0) {
        updateData.lockedUntil = new Date(Date.now() + lockoutMs);
      }

      await prisma.employeeProfile.update({
        where: { id: employee.id },
        data: updateData,
      });

      await prisma.pOSAction.create({
        data: {
          companyId: company.id,
          employeeProfileId: employee.id,
          actionType: 'FAILED_PIN',
          description: `Failed PIN attempt #${newAttempts} (terminal login)`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          metadata: { attempt: newAttempts },
        },
      });

      if (newAttempts >= 10) {
        return forbidden('Account locked. Too many failed PIN attempts. Contact your manager.');
      }

      const remainingAttempts = (newAttempts < 3 ? 3 : newAttempts < 5 ? 5 : 10) - newAttempts;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: `Incorrect PIN. ${remainingAttempts} attempt(s) remaining before lockout.`,
          retryAfter: lockoutMs && lockoutMs > 0 ? Math.ceil(lockoutMs / 1000) : undefined,
        },
        { status: 401 }
      );
    }

    // 6. PIN valid — reset failed attempts, update last login
    await prisma.employeeProfile.update({
      where: { id: employee.id },
      data: {
        failedPinAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // 7. Sign terminal JWT
    const token = await signTerminalToken({
      sub: employee.id,
      companyId: company.id,
      role: employee.role,
      permissions: (employee.permissions as Record<string, unknown>) || {},
      firstName: employee.firstName,
      lastName: employee.lastName,
      displayName: employee.displayName,
      avatarColor: employee.avatarColor,
    });

    // 8. Build response with terminal cookie
    const activeShift = employee.shifts[0] || null;

    const response = NextResponse.json({
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
      company: {
        id: company.id,
        name: company.tradingName || company.businessName,
      },
      activeShift,
    });

    response.cookies.set(TERMINAL_TOKEN_COOKIE, token, getTerminalTokenCookieOptions());

    return response;
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Terminal authentication failed');
  }
}
