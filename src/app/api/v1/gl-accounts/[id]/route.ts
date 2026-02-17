/**
 * GET/PUT/DELETE /api/v1/gl-accounts/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { notFound, badRequest, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const account = await prisma.gLAccount.findFirst({
      where: { id, companyId: companyId!, isActive: true },
      include: { journalLines: { take: 20, orderBy: { journalEntryId: 'desc' } } },
    });
    if (!account) return notFound('GL Account not found');
    return NextResponse.json(account);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to get GL account');
  }
}

const updateGLAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'gl:update');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.gLAccount.findFirst({ where: { id, companyId: companyId!, isActive: true } });
    if (!existing) return notFound('GL Account not found');

    const body = await request.json();
    const parsed = updateGLAccountSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const account = await prisma.gLAccount.update({ where: { id }, data: parsed.data });
    return NextResponse.json(account);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update GL account');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error: authError } = await requirePermission(request, 'gl:delete');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const existing = await prisma.gLAccount.findFirst({ where: { id, companyId: companyId!, isActive: true } });
    if (!existing) return notFound('GL Account not found');

    // Check for journal lines — can't delete accounts with activity
    const lineCount = await prisma.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) return badRequest('Cannot delete account with journal entries. Deactivate it instead.');

    await prisma.gLAccount.update({ where: { id }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete GL account');
  }
}
