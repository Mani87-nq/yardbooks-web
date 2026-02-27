/**
 * POST /api/pos/actions/override
 * Manager override: validate manager PIN, authorize action, log everything.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';
import { verifyPassword } from '@/lib/auth/password';

const overrideSchema = z.object({
  managerProfileId: z.string().min(1),
  managerPin: z.string().min(4).max(6).regex(/^\d+$/),
  requestingEmployeeId: z.string().min(1),
  actionType: z.enum([
    'VOID', 'REFUND', 'DISCOUNT', 'PRICE_OVERRIDE',
    'CASH_DRAWER_OPEN', 'NO_SALE',
  ]),
  reason: z.string().min(1).max(500),
  orderId: z.string().optional(),
  shiftId: z.string().optional(),
  terminalId: z.string().optional(),
  amount: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const {
      managerProfileId,
      managerPin,
      requestingEmployeeId,
      actionType,
      reason,
      orderId,
      shiftId,
      terminalId,
      amount,
      metadata,
    } = parsed.data;

    // Find the manager profile
    const manager = await prisma.employeeProfile.findFirst({
      where: {
        id: managerProfileId,
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!manager) return notFound('Manager not found');

    // Verify manager role (must be SHIFT_MANAGER or STORE_MANAGER)
    if (!['SHIFT_MANAGER', 'STORE_MANAGER'].includes(manager.role)) {
      // Log the unauthorized attempt
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: requestingEmployeeId,
          actionType: 'MANAGER_OVERRIDE',
          description: `Override denied: ${managerProfileId} is not a manager`,
          metadata: { denied: true, reason: 'Not a manager role' },
        },
      });

      return forbidden('Employee does not have manager privileges');
    }

    // Check if manager is locked
    if (manager.lockedUntil && new Date() < manager.lockedUntil) {
      return forbidden('Manager account is temporarily locked');
    }

    if (manager.failedPinAttempts >= 10) {
      return forbidden('Manager account is locked. Contact administrator.');
    }

    // Verify manager PIN
    const isValid = await verifyPassword(managerPin, manager.pinHash);

    if (!isValid) {
      // Increment failed attempts for manager
      const newAttempts = manager.failedPinAttempts + 1;
      const updateData: Record<string, unknown> = {
        failedPinAttempts: newAttempts,
      };

      if (newAttempts >= 10) {
        updateData.lockedUntil = new Date('2099-12-31');
      } else if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      } else if (newAttempts >= 3) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 1000);
      }

      await prisma.employeeProfile.update({
        where: { id: manager.id },
        data: updateData,
      });

      // Log failed override attempt
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: requestingEmployeeId,
          actionType: 'MANAGER_OVERRIDE',
          description: `Override failed: invalid manager PIN for ${manager.firstName} ${manager.lastName}`,
          orderId: orderId || null,
          shiftId: shiftId || null,
          terminalId: terminalId || null,
          metadata: { denied: true, managerProfileId, reason: 'Invalid PIN' },
        },
      });

      return badRequest('Invalid manager PIN');
    }

    // PIN is valid - reset manager's failed attempts
    await prisma.employeeProfile.update({
      where: { id: manager.id },
      data: { failedPinAttempts: 0, lockedUntil: null },
    });

    // Log the successful override
    const action = await prisma.pOSAction.create({
      data: {
        companyId: companyId!,
        employeeProfileId: requestingEmployeeId,
        actionType: 'MANAGER_OVERRIDE',
        description: `Manager override by ${manager.firstName} ${manager.lastName}: ${actionType}`,
        orderId: orderId || null,
        shiftId: shiftId || null,
        terminalId: terminalId || null,
        amount: amount ?? null,
        overrideByProfileId: manager.id,
        overrideReason: reason,
        metadata: {
          ...metadata,
          authorizedAction: actionType,
          managerName: `${manager.firstName} ${manager.lastName}`,
          managerRole: manager.role,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({
      authorized: true,
      action,
      manager: {
        id: manager.id,
        firstName: manager.firstName,
        lastName: manager.lastName,
        role: manager.role,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Manager override failed');
  }
}
