/**
 * POST /api/shifts/clock-in
 * Clock in an employee and create a new shift.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, conflict, internalError } from '@/lib/api-error';

const clockInSchema = z.object({
  employeeProfileId: z.string().min(1),
  terminalId: z.string().optional(),
  posSessionId: z.string().optional(),
  openingCash: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = clockInSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { employeeProfileId, terminalId, posSessionId, openingCash, notes } = parsed.data;

    // Verify employee exists and is active
    const employee = await prisma.employeeProfile.findFirst({
      where: {
        id: employeeProfileId,
        companyId: companyId!,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!employee) return badRequest('Employee not found or inactive');

    // Check if already clocked in
    const activeShift = await prisma.shift.findFirst({
      where: {
        employeeProfileId,
        companyId: companyId!,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
    });

    if (activeShift) {
      return conflict('Employee is already clocked in. Clock out first before starting a new shift.');
    }

    // Create the shift
    const shift = await prisma.shift.create({
      data: {
        companyId: companyId!,
        employeeProfileId,
        clockInAt: new Date(),
        status: 'ACTIVE',
        openingCash: openingCash ?? null,
        terminalId: terminalId || null,
        posSessionId: posSessionId || null,
        notes: notes || null,
      },
    });

    // Log the clock-in action
    await prisma.pOSAction.create({
      data: {
        companyId: companyId!,
        employeeProfileId,
        actionType: 'CLOCK_IN',
        description: `Clocked in at ${new Date().toISOString()}`,
        shiftId: shift.id,
        terminalId: terminalId || null,
        amount: openingCash ?? null,
        metadata: { openingCash: openingCash ?? null },
      },
    });

    // If opening cash was provided, create a cash drawer event
    if (openingCash !== undefined) {
      await prisma.cashDrawerEvent.create({
        data: {
          companyId: companyId!,
          shiftId: shift.id,
          employeeProfileId,
          eventType: 'OPENING_COUNT',
          amount: openingCash,
        },
      });
    }

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to clock in');
  }
}
