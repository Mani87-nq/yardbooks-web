/**
 * GET/DELETE /api/v1/journal-entries/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId: companyId! },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) return notFound('Journal entry not found');
    return NextResponse.json(entry);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get journal entry');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'journal:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.journalEntry.findFirst({ where: { id, companyId: companyId! } });
    if (!existing) return notFound('Journal entry not found');

    if (existing.status === 'POSTED') {
      return badRequest('Posted journal entries cannot be deleted. Create a reversing entry instead.');
    }

    await prisma.journalEntry.update({ where: { id }, data: { status: 'VOID' } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete journal entry');
  }
}
