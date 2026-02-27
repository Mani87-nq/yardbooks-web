/**
 * GET    /api/modules/retail/segments/[id] — Get a customer segment by ID
 * PUT    /api/modules/retail/segments/[id] — Update a customer segment
 * DELETE /api/modules/retail/segments/[id] — Delete a customer segment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ---- GET ----

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const segment = await (prisma as any).customerSegment.findFirst({
      where: { id, companyId: companyId! },
      include: {
        members: {
          include: {
            customer: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { addedAt: 'desc' },
          take: 50,
        },
        _count: { select: { members: true } },
      },
    });

    if (!segment) return notFound('Customer segment not found');

    return NextResponse.json(segment);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get customer segment');
  }
}

// ---- PUT ----

const segmentRuleSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(['MANUAL', 'AUTO']).optional(),
  rules: z.array(segmentRuleSchema).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const existing = await (prisma as any).customerSegment.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Customer segment not found');

    const body = await request.json();
    const parsed = updateSegmentSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Clean out undefined values
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Validate auto segments have rules
    const finalType = (updateData.type as string) || existing.type;
    const finalRules = updateData.rules !== undefined ? updateData.rules : existing.rules;
    if (finalType === 'AUTO' && (!finalRules || (Array.isArray(finalRules) && finalRules.length === 0))) {
      return badRequest('Auto segments require at least one rule');
    }

    const segment = await (prisma as any).customerSegment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(segment);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update customer segment');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const existing = await (prisma as any).customerSegment.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Customer segment not found');

    await (prisma as any).customerSegment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete customer segment');
  }
}
