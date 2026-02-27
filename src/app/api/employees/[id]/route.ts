/**
 * GET/PUT/DELETE /api/employees/[id]
 * Individual employee profile management.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ── GET: Get employee details ───────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const employee = await prisma.employeeProfile.findFirst({
      where: { id, companyId: companyId!, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        avatarColor: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        failedPinAttempts: true,
        lockedUntil: true,
        employeeId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        shifts: {
          take: 10,
          orderBy: { clockInAt: 'desc' },
          select: {
            id: true,
            clockInAt: true,
            clockOutAt: true,
            status: true,
            totalSales: true,
            totalTips: true,
          },
        },
      },
    });

    if (!employee) return notFound('Employee not found');
    return NextResponse.json(employee);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get employee');
  }
}

// ── PUT: Update employee ────────────────────────────────────────
const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(20).optional().nullable(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  role: z.enum(['POS_CASHIER', 'POS_SERVER', 'SHIFT_MANAGER', 'STORE_MANAGER']).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
  userId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const body = await request.json();
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const updateData: Record<string, unknown> = { ...parsed.data };
    // Normalize empty email to null
    if (updateData.email === '') updateData.email = null;

    const employee = await prisma.employeeProfile.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        avatarColor: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update employee');
  }
}

// ── DELETE: Soft-delete (deactivate) ────────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    await prisma.employeeProfile.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete employee');
  }
}
