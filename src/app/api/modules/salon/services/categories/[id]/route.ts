/**
 * PUT    /api/modules/salon/services/categories/[id] — Update a service category
 * DELETE /api/modules/salon/services/categories/[id] — Delete a service category
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

// ---- PUT (Update) ----

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:services:update');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'salon');
    if (modErr) return modErr;

    // Verify category exists and belongs to company
    const existing = await (prisma as any).salonServiceCategory.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Service category not found');

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const category = await (prisma as any).salonServiceCategory.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(category);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return badRequest('A category with this name already exists');
    }
    return internalError(error instanceof Error ? error.message : 'Failed to update category');
  }
}

// ---- DELETE ----

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'salon:services:delete');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr2 } = await requireModule(companyId!, 'salon');
    if (modErr2) return modErr2;

    // Verify category exists and belongs to company
    const existing = await (prisma as any).salonServiceCategory.findFirst({
      where: { id, companyId: companyId! },
      include: {
        services: { select: { id: true }, take: 1 },
      },
    });
    if (!existing) return notFound('Service category not found');

    // Prevent deletion if services are using this category
    if (existing.services && existing.services.length > 0) {
      return badRequest(
        'Cannot delete category that has services assigned. Remove or reassign services first.'
      );
    }

    await (prisma as any).salonServiceCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete category');
  }
}
