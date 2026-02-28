/**
 * GET /api/employee/modules
 * Return the active modules for the authenticated employee's company.
 * Uses terminal JWT auth (PIN-based session).
 *
 * The kiosk workstation calls this endpoint on startup to discover
 * which modules (salon, restaurant, retail, etc.) are enabled for
 * the company so it can render the correct navigation and features.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    // Fetch active modules and company info in parallel
    const [activeModules, company] = await Promise.all([
      prisma.companyModule.findMany({
        where: {
          companyId: companyId!,
          isActive: true,
          deactivatedAt: null,
        },
        select: { moduleId: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId! },
        select: {
          businessName: true,
          tradingName: true,
          primaryColor: true,
        },
      }),
    ]);

    return NextResponse.json({
      modules: activeModules.map((m) => m.moduleId),
      company: {
        name: company?.tradingName ?? company?.businessName ?? '',
        primaryColor: company?.primaryColor ?? '#1976D2',
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get active modules');
  }
}
