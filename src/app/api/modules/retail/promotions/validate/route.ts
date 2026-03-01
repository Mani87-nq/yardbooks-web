/**
 * POST /api/modules/retail/promotions/validate — Validate a promo code against a cart
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { requireModule } from '@/modules/middleware';
import { badRequest, notFound, internalError } from '@/lib/api-error';

const validateSchema = z.object({
  promoCode: z.string().min(1, 'Promo code is required'),
  cartTotal: z.number().min(0, 'Cart total must be non-negative'),
  cartItems: z
    .array(
      z.object({
        productId: z.string(),
        categoryId: z.string().nullable().optional(),
        quantity: z.number().min(1),
        price: z.number().min(0),
      })
    )
    .optional()
    .default([]),
  customerId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'retail:promotions:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;
    const { error: modErr } = await requireModule(companyId!, 'retail');
    if (modErr) return modErr;

    const body = await request.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { promoCode, cartTotal, cartItems, customerId } = parsed.data;
    const now = new Date();

    // Find the promotion by promo code
    const promotion = await (prisma as any).promotion.findFirst({
      where: {
        companyId: companyId!,
        promoCode: { equals: promoCode, mode: 'insensitive' },
        requiresCode: true,
        isActive: true,
      },
    });

    if (!promotion) {
      return NextResponse.json({
        valid: false,
        reason: 'Invalid promo code',
      });
    }

    // Check if promotion has started
    if (promotion.startDate > now) {
      return NextResponse.json({
        valid: false,
        reason: 'This promotion has not started yet',
      });
    }

    // Check if promotion has expired
    if (promotion.endDate && promotion.endDate < now) {
      return NextResponse.json({
        valid: false,
        reason: 'This promotion has expired',
      });
    }

    // Check global usage limit
    if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
      return NextResponse.json({
        valid: false,
        reason: 'This promotion has reached its maximum usage limit',
      });
    }

    // Check minimum order amount
    if (promotion.minOrderAmount && cartTotal < Number(promotion.minOrderAmount)) {
      return NextResponse.json({
        valid: false,
        reason: `Minimum order amount of $${Number(promotion.minOrderAmount).toLocaleString()} required`,
        minOrderAmount: Number(promotion.minOrderAmount),
      });
    }

    // Calculate discount based on type
    let discountAmount = 0;
    const promotionValue = Number(promotion.value);

    switch (promotion.type) {
      case 'PERCENTAGE':
        discountAmount = cartTotal * (promotionValue / 100);
        break;
      case 'FIXED_AMOUNT':
        discountAmount = Math.min(promotionValue, cartTotal);
        break;
      case 'BUY_X_GET_Y':
        // Simplified: value represents the discount on qualifying items
        discountAmount = promotionValue;
        break;
      case 'BUNDLE':
        discountAmount = promotionValue;
        break;
    }

    // Apply max discount cap
    if (promotion.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(promotion.maxDiscount));
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Increment usage counter
    await (prisma as any).promotion.update({
      where: { id: promotion.id },
      data: { currentUses: { increment: 1 } },
    });

    return NextResponse.json({
      valid: true,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        value: promotionValue,
        promoCode: promotion.promoCode,
      },
      discountAmount,
      cartTotal,
      newTotal: Math.max(0, cartTotal - discountAmount),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to validate promotion');
  }
}
