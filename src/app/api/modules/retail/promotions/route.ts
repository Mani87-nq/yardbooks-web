/**
 * GET  /api/modules/retail/promotions — List promotions (company-scoped, with status filtering)
 * POST /api/modules/retail/promotions — Create a new promotion
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:promotions:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // active, scheduled, expired, all
    const search = searchParams.get('search') ?? undefined;
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    const now = new Date();

    const where: Record<string, unknown> = {
      companyId: companyId!,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { promoCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Filter by effective status
    if (status === 'active') {
      where.isActive = true;
      where.startDate = { lte: now };
      where.OR = [{ endDate: null }, { endDate: { gte: now } }];
    } else if (status === 'scheduled') {
      where.isActive = true;
      where.startDate = { gt: now };
    } else if (status === 'expired') {
      where.OR = [
        { endDate: { lt: now } },
        { isActive: false },
      ];
    }
    // 'all' returns everything

    const promotions = await (prisma as any).promotion.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = promotions.length > limit;
    const data = hasMore ? promotions.slice(0, limit) : promotions;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    const total = await (prisma as any).promotion.count({
      where: { companyId: companyId! },
    });

    return NextResponse.json({
      data,
      total,
      pagination: { nextCursor, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list promotions');
  }
}

// ---- POST (Create) ----

const createPromotionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'BUNDLE']),
  value: z.number().min(0, 'Value must be non-negative'),
  minOrderAmount: z.number().min(0).nullable().optional(),
  maxDiscount: z.number().min(0).nullable().optional(),
  appliesTo: z.enum(['ALL', 'CATEGORY', 'PRODUCT', 'CUSTOMER_SEGMENT']).default('ALL'),
  targetIds: z.array(z.string()).nullable().optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .nullable()
    .optional()
    .transform((s) => (s ? new Date(s) : null)),
  isActive: z.boolean().default(true),
  maxUses: z.int().min(1).nullable().optional(),
  maxUsesPerCustomer: z.int().min(1).nullable().optional(),
  promoCode: z.string().max(50).nullable().optional(),
  requiresCode: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:promotions:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = createPromotionSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const data = parsed.data;

    // Validate percentage is not above 100
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      return badRequest('Percentage discount cannot exceed 100%');
    }

    // Validate promo code uniqueness if provided
    if (data.promoCode) {
      const existingCode = await (prisma as any).promotion.findFirst({
        where: { companyId: companyId!, promoCode: data.promoCode },
      });
      if (existingCode) {
        return badRequest('Promo code already exists for this company');
      }
    }

    const promotion = await (prisma as any).promotion.create({
      data: {
        ...data,
        companyId: companyId!,
        targetIds: data.targetIds || null,
      },
    });

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create promotion');
  }
}
