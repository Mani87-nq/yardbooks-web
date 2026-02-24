/**
 * POST /api/v1/referrals — Create a new referral/incentive code (ADMIN+).
 * GET  /api/v1/referrals — List referral codes for the active company.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate an 8-character uppercase alphanumeric code.
 * Uses crypto.randomBytes for secure randomness.
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit O/0/I/1 to avoid confusion
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ─── POST: Create referral code ─────────────────────────────────────────────

const createSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, 'Code must be alphanumeric')
    .optional(), // If omitted, auto-generate
  description: z.string().max(500).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('PERCENTAGE'),
  discountValue: z.number().min(0).max(100_000).optional().default(100),
  trialExtendDays: z.number().int().min(0).max(365).optional().default(30),
  maxUses: z.number().int().min(1).optional().nullable(), // null = unlimited
  expiresAt: z.string().datetime().optional().nullable(), // ISO 8601
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Auth + admin permission
    const { user, error: authError } = await requirePermission(request, 'settings:write');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const parsed = createSchema.safeParse(body);
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

    // 4. Determine code (auto-generate or use provided)
    let code = data.code?.toUpperCase();
    if (!code) {
      // Auto-generate with uniqueness retry
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateReferralCode();
        const existing = await prisma.referralCode.findUnique({ where: { code: candidate } });
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return internalError('Failed to generate a unique referral code. Please try again.');
      }
    } else {
      // Check uniqueness for user-provided codes
      const existing = await prisma.referralCode.findUnique({ where: { code } });
      if (existing) {
        return badRequest('A referral code with this value already exists', {
          code: ['This code is already taken'],
        });
      }
    }

    // 5. Create referral code
    const referralCode = await prisma.referralCode.create({
      data: {
        code,
        ownerId: user!.sub,
        companyId,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        trialExtendDays: data.trialExtendDays,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: referralCode.id,
          code: referralCode.code,
          description: referralCode.description,
          discountType: referralCode.discountType,
          discountValue: Number(referralCode.discountValue),
          trialExtendDays: referralCode.trialExtendDays,
          maxUses: referralCode.maxUses,
          currentUses: referralCode.currentUses,
          expiresAt: referralCode.expiresAt,
          isActive: referralCode.isActive,
          createdAt: referralCode.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create referral code');
  }
}

// ─── GET: List referral codes ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth + permission check (settings:read is inherited by all roles)
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    // 2. Company scoping
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // 3. Query params
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    // 4. Fetch referral codes scoped to the company
    const where = {
      companyId,
      ...(activeOnly ? { isActive: true } : {}),
    };

    const [referralCodes, total] = await Promise.all([
      prisma.referralCode.findMany({
        where,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: { select: { redemptions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.referralCode.count({ where }),
    ]);

    return NextResponse.json({
      data: referralCodes.map((rc) => ({
        id: rc.id,
        code: rc.code,
        description: rc.description,
        discountType: rc.discountType,
        discountValue: Number(rc.discountValue),
        trialExtendDays: rc.trialExtendDays,
        maxUses: rc.maxUses,
        currentUses: rc.currentUses,
        totalRedemptions: rc._count.redemptions,
        expiresAt: rc.expiresAt,
        isActive: rc.isActive,
        createdAt: rc.createdAt,
        owner: rc.owner,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list referral codes');
  }
}
