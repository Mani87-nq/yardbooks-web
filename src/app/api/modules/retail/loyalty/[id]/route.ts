/**
 * GET    /api/modules/retail/loyalty/[id] — Get a loyalty program by ID
 * PUT    /api/modules/retail/loyalty/[id] — Update a loyalty program
 * DELETE /api/modules/retail/loyalty/[id] — Delete a loyalty program
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ---- GET ----

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:loyalty:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const { id } = await context.params;

    const program = await (prisma as any).loyaltyProgram.findFirst({
      where: { id, companyId: companyId! },
      include: {
        rewards: { where: { isActive: true }, orderBy: { pointsCost: 'asc' } },
        _count: {
          select: { members: true, transactions: true },
        },
      },
    });

    if (!program) return notFound('Loyalty program not found');

    return NextResponse.json(program);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get loyalty program');
  }
}

// ---- PUT ----

const updateProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  pointsPerDollar: z.number().min(0).max(1000).optional(),
  pointsRounding: z.enum(['FLOOR', 'ROUND', 'CEIL']).optional(),
  rewardThreshold: z.int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:loyalty:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const { id } = await context.params;

    // Verify program exists and belongs to company
    const existing = await (prisma as any).loyaltyProgram.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Loyalty program not found');

    const body = await request.json();
    const parsed = updateProgramSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const program = await (prisma as any).loyaltyProgram.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(program);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update loyalty program');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:loyalty:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr3 } = await requireModule(companyId!, 'retail');
    if (modErr3) return modErr3;

    const { id } = await context.params;

    const existing = await (prisma as any).loyaltyProgram.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Loyalty program not found');

    await (prisma as any).loyaltyProgram.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete loyalty program');
  }
}
