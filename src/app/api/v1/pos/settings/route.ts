/**
 * GET /api/v1/pos/settings — Get POS settings (create default if none)
 * PUT /api/v1/pos/settings — Update POS settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
const POS_PAYMENT_METHODS = [
  'CASH', 'JAM_DEX', 'LYNK_WALLET', 'WIPAY',
  'CARD_VISA', 'CARD_MASTERCARD', 'CARD_OTHER',
  'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER',
] as const;

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    let settings = await prisma.posSettings.findUnique({
      where: { companyId: companyId! },
    });

    // Create default settings if none exist
    if (!settings) {
      const company = await prisma.company.findUnique({
        where: { id: companyId! },
        select: { businessName: true },
      });

      settings = await prisma.posSettings.create({
        data: {
          companyId: companyId!,
          orderPrefix: 'POS',
          nextOrderNumber: 1,
          gctRate: 0.15,
          businessName: company?.businessName ?? 'My Business',
          enabledPaymentMethods: ['CASH'],
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get POS settings');
  }
}

const updateSettingsSchema = z.object({
  orderPrefix: z.string().min(1).max(10).optional(),
  nextOrderNumber: z.number().int().min(1).optional(),
  gctRate: z.number().min(0).max(1).optional(),
  gctRegistrationNumber: z.string().max(50).optional().nullable(),
  taxIncludedInPrice: z.boolean().optional(),
  businessName: z.string().min(1).max(200).optional(),
  businessAddress: z.string().max(500).optional().nullable(),
  businessPhone: z.string().max(50).optional().nullable(),
  businessTRN: z.string().max(50).optional().nullable(),
  businessLogo: z.string().max(500).optional().nullable(),
  receiptFooter: z.string().max(500).optional().nullable(),
  showLogo: z.boolean().optional(),
  requireOpenSession: z.boolean().optional(),
  allowOfflineSales: z.boolean().optional(),
  autoDeductInventory: z.boolean().optional(),
  autoPostToGL: z.boolean().optional(),
  defaultToWalkIn: z.boolean().optional(),
  enabledPaymentMethods: z.array(z.enum(POS_PAYMENT_METHODS)).optional(),
  glCashOnHand: z.string().max(50).optional().nullable(),
  glBankAccount: z.string().max(50).optional().nullable(),
  glAccountsReceivable: z.string().max(50).optional().nullable(),
  glGctPayable: z.string().max(50).optional().nullable(),
  glSalesRevenue: z.string().max(50).optional().nullable(),
  glSalesDiscounts: z.string().max(50).optional().nullable(),
  glCostOfGoodsSold: z.string().max(50).optional().nullable(),
  glInventory: z.string().max(50).optional().nullable(),
  lynkMerchantId: z.string().max(100).optional().nullable(),
  wipayMerchantId: z.string().max(100).optional().nullable(),
  wipayApiKey: z.string().max(200).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'pos:settings');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const settings = await prisma.posSettings.upsert({
      where: { companyId: companyId! },
      update: parsed.data,
      create: {
        companyId: companyId!,
        orderPrefix: parsed.data.orderPrefix ?? 'POS',
        nextOrderNumber: parsed.data.nextOrderNumber ?? 1,
        gctRate: parsed.data.gctRate ?? 0.15,
        businessName: parsed.data.businessName ?? 'My Business',
        enabledPaymentMethods: parsed.data.enabledPaymentMethods ?? ['CASH'],
        ...parsed.data,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update POS settings');
  }
}
