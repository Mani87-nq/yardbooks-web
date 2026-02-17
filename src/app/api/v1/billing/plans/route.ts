/**
 * GET /api/v1/billing/plans — List all available subscription plans (public, no auth)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PLANS } from '@/lib/billing/service';

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    data: PLANS.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      priceUsd: plan.priceUsd,
      maxUsers: plan.maxUsers,
      maxCompanies: plan.maxCompanies,
      features: plan.features,
      isCustomPricing: plan.price === 0,
    })),
  });
}
