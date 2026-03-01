/**
 * GET /api/employee/pos/settings — Get POS settings for kiosk terminal
 *
 * Terminal-auth wrapper around admin POS settings logic.
 * Read-only: kiosk employees cannot modify POS settings.
 * Does NOT auto-create defaults — admin must configure POS first.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireTerminalAuth } from '@/lib/auth/terminal-middleware';
import { notFound, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { employee, companyId, error: authError } = await requireTerminalAuth(request);
    if (authError) return authError;

    const settings = await prisma.posSettings.findUnique({
      where: { companyId: companyId! },
    });

    if (!settings) {
      return notFound('POS settings not configured. Please ask your administrator to set up POS settings.');
    }

    return NextResponse.json(settings);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get POS settings');
  }
}
