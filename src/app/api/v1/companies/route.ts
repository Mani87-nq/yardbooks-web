/**
 * GET  /api/v1/companies — List user's companies
 * POST /api/v1/companies — Create a new company
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { badRequest, forbidden, internalError } from '@/lib/api-error';
import { seedDefaultAccounts } from '@/lib/accounting/engine';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const memberships = await prisma.companyMember.findMany({
      where: { userId: user!.sub },
      include: { company: true },
    });

    return NextResponse.json({
      data: memberships.map((m) => ({
        ...m.company,
        role: m.role,
      })),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list companies');
  }
}

const createCompanySchema = z.object({
  businessName: z.string().min(1).max(200),
  tradingName: z.string().max(200).optional(),
  businessType: z.enum(['SOLE_PROPRIETOR', 'PARTNERSHIP', 'LIMITED_COMPANY', 'NGO', 'OTHER']).default('SOLE_PROPRIETOR'),
  trnNumber: z.string().max(20).optional(),
  gctNumber: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  currency: z.enum(['JMD', 'USD']).default('JMD'),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    // Enforce company limit based on subscription plan
    const existingMemberships = await prisma.companyMember.findMany({
      where: { userId: user!.sub, role: 'OWNER' },
      include: { company: { select: { subscriptionPlan: true } } },
    });

    // Check company limit: Free/Starter = 1, Professional = 1, Business = 3, Enterprise = unlimited
    const ownedCompanyCount = existingMemberships.length;
    if (ownedCompanyCount >= 1) {
      const plans = existingMemberships.map((m) => m.company.subscriptionPlan?.toUpperCase());
      const hasMultiCompanyPlan = plans.some(
        (p) => p === 'BUSINESS' || p === 'ENTERPRISE'
      );
      const hasEnterprisePlan = plans.some((p) => p === 'ENTERPRISE');
      if (!hasMultiCompanyPlan) {
        return forbidden(
          'Your current plan allows only 1 company. Upgrade to Business or Enterprise for multiple companies.'
        );
      }
      if (hasMultiCompanyPlan && !hasEnterprisePlan && ownedCompanyCount >= 3) {
        return forbidden(
          'Business plan allows up to 3 companies. Upgrade to Enterprise for unlimited companies.'
        );
      }
    }

    // 14-day free trial: new companies start on STARTER plan with TRIALING status
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx: any) => {
      const company = await tx.company.create({
        data: {
          ...parsed.data,
          subscriptionPlan: 'STARTER',
          subscriptionStatus: 'TRIALING',
          subscriptionStartDate: now,
          subscriptionEndDate: trialEnd,
        },
      });
      await tx.companyMember.create({
        data: { userId: user!.sub, companyId: company.id, role: 'OWNER' },
      });

      // Seed the default Jamaica chart of accounts for the new company
      await seedDefaultAccounts(company.id, tx);

      return company;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create company');
  }
}
