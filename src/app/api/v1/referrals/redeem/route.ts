/**
 * POST /api/v1/referrals/redeem — Redeem a referral code for the active company.
 * Requires authentication. Extends the company's trial period and records the redemption.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, notFound, conflict, internalError } from '@/lib/api-error';

const redeemSchema = z.object({
  code: z.string().min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // 2. Require active company
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = redeemSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Referral code is required');
    }

    const code = parsed.data.code.toUpperCase().trim();

    // 4. Look up the code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code },
    });

    if (!referralCode) {
      return notFound('Invalid referral code');
    }

    // 5. Validate code is usable
    if (!referralCode.isActive) {
      return badRequest('This referral code is no longer active.');
    }

    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return badRequest('This referral code has expired.');
    }

    if (referralCode.maxUses !== null && referralCode.currentUses >= referralCode.maxUses) {
      return badRequest('This referral code has reached its maximum number of uses.');
    }

    // 6. Check if this company already redeemed this code
    const existingRedemption = await prisma.referralRedemption.findFirst({
      where: {
        referralCodeId: referralCode.id,
        redeemedByCompanyId: companyId,
      },
    });

    if (existingRedemption) {
      return conflict('This referral code has already been redeemed for this company.');
    }

    // 7. Prevent self-referral: code owner's company should not redeem their own code
    if (referralCode.companyId === companyId) {
      return badRequest('You cannot redeem your own referral code.');
    }

    // 8. Apply the referral in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get the current company subscription info
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          subscriptionStatus: true,
          subscriptionEndDate: true,
          referredByCode: true,
        },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Calculate new trial end date
      let trialDaysAdded = referralCode.trialExtendDays;
      let newEndDate: Date | null = null;

      if (trialDaysAdded > 0) {
        const baseDate = company.subscriptionEndDate ?? new Date();
        newEndDate = new Date(baseDate.getTime() + trialDaysAdded * 24 * 60 * 60 * 1000);
      }

      // Update company: extend trial + record referral code
      const companyUpdate: Record<string, unknown> = {};
      if (newEndDate) {
        companyUpdate.subscriptionEndDate = newEndDate;
      }
      if (!company.referredByCode) {
        companyUpdate.referredByCode = referralCode.code;
      }

      if (Object.keys(companyUpdate).length > 0) {
        await tx.company.update({
          where: { id: companyId },
          data: companyUpdate,
        });
      }

      // Increment usage counter
      await tx.referralCode.update({
        where: { id: referralCode.id },
        data: { currentUses: { increment: 1 } },
      });

      // Record the redemption
      const redemption = await tx.referralRedemption.create({
        data: {
          referralCodeId: referralCode.id,
          redeemedByUserId: user!.sub,
          redeemedByCompanyId: companyId,
          discountApplied: referralCode.discountValue,
          trialDaysAdded,
        },
      });

      return {
        redemption,
        newEndDate,
        trialDaysAdded,
        discountApplied: Number(referralCode.discountValue),
      };
    });

    return NextResponse.json({
      data: {
        redemptionId: result.redemption.id,
        code: referralCode.code,
        discountType: referralCode.discountType,
        discountApplied: result.discountApplied,
        trialDaysAdded: result.trialDaysAdded,
        newSubscriptionEndDate: result.newEndDate,
      },
      message: result.trialDaysAdded > 0
        ? `Referral code applied! Your trial has been extended by ${result.trialDaysAdded} days.`
        : 'Referral code applied!',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to redeem referral code');
  }
}
