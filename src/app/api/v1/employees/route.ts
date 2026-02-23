/**
 * GET/POST /api/v1/employees
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const isActive = searchParams.get('active') !== 'false';

    const employees = await prisma.employee.findMany({
      where: { companyId: companyId!, isActive, deletedAt: null },
      take: limit,
      orderBy: { lastName: 'asc' },
    });

    return NextResponse.json({ data: employees });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list employees');
  }
}

const createEmployeeSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  position: z.string().min(1).max(100),
  department: z.string().max(100).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
  paymentFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']).default('MONTHLY'),
  baseSalary: z.number().positive(),
  trnNumber: z.string().min(1).max(20),
  nisNumber: z.string().min(1).max(20),
  dateOfBirth: z.coerce.date(),
  hireDate: z.coerce.date(),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'payroll:create');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        companyId: companyId!,
        createdBy: user!.sub,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create employee');
  }
}
