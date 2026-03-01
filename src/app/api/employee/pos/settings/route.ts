/**
 * GET /api/employee/pos/settings — Get POS settings for kiosk terminal
 *
 * Terminal-auth wrapper around admin POS settings logic.
 * Read-only: kiosk employees cannot modify POS settings.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

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
