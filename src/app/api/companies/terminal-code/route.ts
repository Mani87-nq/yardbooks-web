/**
 * POST /api/companies/terminal-code
 * Generate or regenerate a terminal code for the active company.
 * Requires owner auth (full JWT session).
 *
 * GET /api/companies/terminal-code
 * Get the current terminal code for the active company.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';

/**
 * Generate a random 6-character alphanumeric code.
 * Uses uppercase letters (excluding I, O, L to avoid confusion) and digits (excluding 0, 1).
 */
function generateTerminalCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { terminalCode: true },
    });

    return NextResponse.json({
      terminalCode: company?.terminalCode || null,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get terminal code');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Generate a unique code (retry on collision)
    let code: string;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    do {
      code = generateTerminalCode();
      const existing = await prisma.company.findFirst({
        where: { terminalCode: code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < MAX_ATTEMPTS);

    if (attempts >= MAX_ATTEMPTS) {
      return internalError('Failed to generate unique terminal code. Please try again.');
    }

    // Update company with new terminal code
    const updated = await prisma.company.update({
      where: { id: companyId! },
      data: { terminalCode: code },
      select: { terminalCode: true },
    });

    return NextResponse.json({
      terminalCode: updated.terminalCode,
      message: 'Terminal code generated successfully. Share this code with your employees to access the kiosk.',
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate terminal code');
  }
}
