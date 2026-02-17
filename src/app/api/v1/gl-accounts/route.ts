/**
 * GET/POST /api/v1/gl-accounts
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const accounts = await prisma.gLAccount.findMany({
      where: { companyId: companyId!, isActive: true },
      orderBy: [{ accountNumber: 'asc' }],
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list GL accounts');
  }
}

const createGLAccountSchema = z.object({
  accountNumber: z.string().min(1).max(20),
  code: z.string().max(20).optional(),
  name: z.string().min(1).max(200),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  parentAccountId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'gl:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createGLAccountSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const account = await prisma.gLAccount.create({
      data: { ...parsed.data, companyId: companyId! },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create GL account');
  }
}
