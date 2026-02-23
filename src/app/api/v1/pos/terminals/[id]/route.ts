/**
 * GET    /api/v1/pos/terminals/[id] — Get a single terminal
 * PUT    /api/v1/pos/terminals/[id] — Update a terminal
 * DELETE /api/v1/pos/terminals/[id] — Delete a terminal
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';
import { requireFeature } from '@/lib/plan-gate.server';

const POS_PAYMENT_METHODS = [
  'CASH', 'JAM_DEX', 'LYNK_WALLET', 'WIPAY',
  'CARD_VISA', 'CARD_MASTERCARD', 'CARD_OTHER',
  'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER',
] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const terminal = await prisma.posTerminal.findFirst({
      where: { id, companyId: companyId! },
      include: {
        sessions: {
          where: { status: 'OPEN' },
          take: 1,
          orderBy: { openedAt: 'desc' },
        },
      },
    });
    if (!terminal) return notFound('Terminal not found');

    return NextResponse.json(terminal);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get terminal');
  }
}

const updateTerminalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
  defaultWarehouseId: z.string().optional().nullable(),
  defaultPaymentMethods: z.array(z.enum(POS_PAYMENT_METHODS)).optional(),
  allowNegativeInventory: z.boolean().optional(),
  requireCustomer: z.boolean().optional(),
  allowDiscounts: z.boolean().optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  receiptPrinterType: z.string().max(50).optional().nullable(),
  receiptPrinterName: z.string().max(200).optional().nullable(),
  receiptPrinterAddress: z.string().max(200).optional().nullable(),
  receiptPaperWidth: z.number().int().optional().nullable(),
  cashDrawerType: z.string().max(50).optional().nullable(),
  cashDrawerOpenOnPayment: z.boolean().optional(),
  cashDrawerRequireClose: z.boolean().optional(),
  barcodeScanner: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.posTerminal.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Terminal not found');

    const body = await request.json();
    const parsed = updateTerminalSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const terminal = await prisma.posTerminal.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(terminal);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update terminal');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { error: planError } = await requireFeature(request, 'pos');
    if (planError) return planError;

    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'pos:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.posTerminal.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Terminal not found');

    // Check for open sessions before deleting
    const openSessions = await prisma.posSession.count({
      where: { terminalId: id, status: 'OPEN' },
    });
    if (openSessions > 0) {
      return badRequest('Cannot delete terminal with open sessions. Close all sessions first.');
    }

    await prisma.posTerminal.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete terminal');
  }
}
