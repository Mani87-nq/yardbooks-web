/**
 * POST /api/v1/referrals/validate — Validate a referral code (public, no auth required).
 * Used during signup to check if a referral code is valid before submission.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { badRequest, notFound, internalError } from '@/lib/api-error';

const validateSchema = z.object({
  code: z.string().min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = validateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Referral code is required');
    }

    // 2. Normalize: case-insensitive lookup
    const code = parsed.data.code.toUpperCase().trim();

    // 3. Look up the code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code },
    });

    if (!referralCode) {
      return notFound('Invalid referral code');
    }

    // 4. Check if active
    if (!referralCode.isActive) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'This referral code is no longer active.',
        },
        { status: 200 }
      );
    }

    // 5. Check if expired
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'This referral code has expired.',
        },
        { status: 200 }
      );
    }

    // 6. Check if max uses reached
    if (referralCode.maxUses !== null && referralCode.currentUses >= referralCode.maxUses) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'This referral code has reached its maximum number of uses.',
        },
        { status: 200 }
      );
    }

    // 7. Valid!
    return NextResponse.json({
      valid: true,
      code: referralCode.code,
      discountType: referralCode.discountType,
      discountValue: Number(referralCode.discountValue),
      trialExtendDays: referralCode.trialExtendDays,
      description: referralCode.description,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to validate referral code');
  }
}
