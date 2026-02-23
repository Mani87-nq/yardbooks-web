/**
 * GET  /api/v1/pos/terminals — List terminals (paginated, company-scoped)
 * POST /api/v1/pos/terminals — Create a new terminal
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

const POS_PAYMENT_METHODS = [
  'CASH', 'JAM_DEX', 'LYNK_WALLET', 'WIPAY',
  'CARD_VISA', 'CARD_MASTERCARD', 'CARD_OTHER',
  'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER',
] as const;

export async function GET(request: NextRequest) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const where = {
      companyId: companyId!,
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const terminals = await prisma.posTerminal.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = terminals.length > limit;
    const data = hasMore ? terminals.slice(0, limit) : terminals;

    return NextResponse.json({
      data,
      pagination: { nextCursor: hasMore ? data[data.length - 1].id : null, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list terminals');
  }
}

const createTerminalSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
  defaultWarehouseId: z.string().optional(),
  defaultPaymentMethods: z.array(z.enum(POS_PAYMENT_METHODS)).default(['CASH']),
  allowNegativeInventory: z.boolean().default(false),
  requireCustomer: z.boolean().default(false),
  allowDiscounts: z.boolean().default(true),
  maxDiscountPercent: z.number().min(0).max(100).default(100),
  receiptPrinterType: z.string().max(50).optional(),
  receiptPrinterName: z.string().max(200).optional(),
  receiptPrinterAddress: z.string().max(200).optional(),
  receiptPaperWidth: z.number().int().optional(),
  cashDrawerType: z.string().max(50).optional(),
  cashDrawerOpenOnPayment: z.boolean().default(true),
  cashDrawerRequireClose: z.boolean().default(true),
  barcodeScanner: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { user, error: authError } = await requirePermission(request, 'pos:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createTerminalSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const terminal = await prisma.posTerminal.create({
      data: {
        ...parsed.data,
        companyId: companyId!,
      },
    });

    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create terminal');
  }
}
