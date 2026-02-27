/**
 * PUT /api/modules/restaurant/tables/layout — Save floor plan layout (batch update positions)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

const layoutItemSchema = z.object({
  id: z.string(),
  posX: z.number().min(0).max(100),
  posY: z.number().min(0).max(100),
  width: z.number().min(1).max(100).optional(),
  height: z.number().min(1).max(100).optional(),
});

const layoutSchema = z.object({
  tables: z.array(layoutItemSchema).min(1),
});

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'restaurant:tables:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    await (prisma as any).$transaction(
      parsed.data.tables.map((t) =>
        (prisma as any).restaurantTable.updateMany({
          where: { id: t.id, companyId: companyId! },
          data: {
            posX: t.posX,
            posY: t.posY,
            ...(t.width !== undefined ? { width: t.width } : {}),
            ...(t.height !== undefined ? { height: t.height } : {}),
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Layout saved' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to save layout');
  }
}
