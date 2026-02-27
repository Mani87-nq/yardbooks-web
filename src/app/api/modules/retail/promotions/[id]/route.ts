/**
 * GET    /api/modules/retail/promotions/[id] — Get a promotion by ID
 * PUT    /api/modules/retail/promotions/[id] — Update a promotion
 * DELETE /api/modules/retail/promotions/[id] — Delete a promotion
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

    const promotion = await (prisma as any).promotion.findFirst({
      where: { id, companyId: companyId! },
    });

    if (!promotion) return notFound('Promotion not found');

    return NextResponse.json(promotion);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get promotion');
  }
}

// ---- PUT ----

const updatePromotionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'BUNDLE']).optional(),
  value: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).nullable().optional(),
  maxDiscount: z.number().min(0).nullable().optional(),
  appliesTo: z.enum(['ALL', 'CATEGORY', 'PRODUCT', 'CUSTOMER_SEGMENT']).optional(),
  targetIds: z.array(z.string()).nullable().optional(),
  startDate: z
    .string()
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  endDate: z
    .string()
    .nullable()
    .optional()
    .transform((s) => (s === null ? null : s ? new Date(s) : undefined)),
  isActive: z.boolean().optional(),
  maxUses: z.int().min(1).nullable().optional(),
  maxUsesPerCustomer: z.int().min(1).nullable().optional(),
  promoCode: z.string().max(50).nullable().optional(),
  requiresCode: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { id } = await context.params;

    const existing = await (prisma as any).promotion.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Promotion not found');

    const body = await request.json();
    const parsed = updatePromotionSchema.safeParse(body);

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

    // Validate percentage
    const finalType = (updateData.type as string) || existing.type;
    const finalValue = (updateData.value as number) ?? Number(existing.value);
    if (finalType === 'PERCENTAGE' && finalValue > 100) {
      return badRequest('Percentage discount cannot exceed 100%');
    }

    // Validate promo code uniqueness
    if (updateData.promoCode && updateData.promoCode !== existing.promoCode) {
      const existingCode = await (prisma as any).promotion.findFirst({
        where: {
          companyId: companyId!,
          promoCode: updateData.promoCode as string,
          id: { not: id },
        },
      });
      if (existingCode) {
        return badRequest('Promo code already exists for this company');
      }
    }

    const promotion = await (prisma as any).promotion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(promotion);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update promotion');
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

    const existing = await (prisma as any).promotion.findFirst({
      where: { id, companyId: companyId! },
    });
    if (!existing) return notFound('Promotion not found');

    await (prisma as any).promotion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete promotion');
  }
}
