/**
 * POST /api/shifts/[id]/break
 * Start or end a break within a shift.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, conflict, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const breakSchema = z.object({
  action: z.enum(['start', 'end']),
  breakType: z.enum(['STANDARD', 'MEAL', 'OTHER']).optional(),
  notes: z.string().max(250).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: shiftId } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = breakSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const { action, breakType, notes } = parsed.data;

    // Find the shift
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        companyId: companyId!,
        status: { in: ['ACTIVE', 'ON_BREAK'] },
      },
    });

    if (!shift) return notFound('Active shift not found');

    if (action === 'start') {
      // Cannot start a break if already on break
      if (shift.status === 'ON_BREAK') {
        return conflict('Already on break. End current break first.');
      }

      // Create break record
      const shiftBreak = await prisma.shiftBreak.create({
        data: {
          shiftId,
          startAt: new Date(),
          breakType: breakType || 'STANDARD',
          notes: notes || null,
        },
      });

      // Update shift status
      await prisma.shift.update({
        where: { id: shiftId },
        data: { status: 'ON_BREAK' },
      });

      // Log break start
      await prisma.pOSAction.create({
        data: {
          companyId: companyId!,
          employeeProfileId: shift.employeeProfileId,
          actionType: 'BREAK_START',
          description: `Break started (${breakType || 'STANDARD'})`,
          shiftId,
        },
      });

      return NextResponse.json(shiftBreak, { status: 201 });
    }

    // End break
    if (shift.status !== 'ON_BREAK') {
      return conflict('Not currently on break.');
    }

    // Find active break
    const activeBreak = await prisma.shiftBreak.findFirst({
      where: { shiftId, endAt: null },
      orderBy: { startAt: 'desc' },
    });

    if (!activeBreak) return notFound('No active break found');

    const now = new Date();
    const duration = Math.round((now.getTime() - activeBreak.startAt.getTime()) / 60000);

    // End the break
    const updatedBreak = await prisma.shiftBreak.update({
      where: { id: activeBreak.id },
      data: { endAt: now, duration },
    });

    // Calculate total break minutes
    const allBreaks = await prisma.shiftBreak.findMany({
      where: { shiftId },
    });

    const totalBreakMinutes = allBreaks.reduce((total, b) => {
      return total + (b.duration || 0);
    }, 0);

    // Update shift
    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: 'ACTIVE',
        breakMinutes: totalBreakMinutes,
      },
    });

    // Log break end
    await prisma.pOSAction.create({
      data: {
        companyId: companyId!,
        employeeProfileId: shift.employeeProfileId,
        actionType: 'BREAK_END',
        description: `Break ended (${duration} minutes)`,
        shiftId,
        metadata: { breakDuration: duration },
      },
    });

    return NextResponse.json(updatedBreak);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to manage break');
  }
}
