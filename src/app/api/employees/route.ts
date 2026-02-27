/**
 * GET/POST /api/employees
 * Employee profile management for POS/Kiosk mode.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { hashPassword } from '@/lib/auth/password';

// ── GET: List employee profiles ─────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const activeOnly = url.searchParams.get('active') !== 'false';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const where: Record<string, unknown> = {
      companyId: companyId!,
      deletedAt: null,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employeeProfile.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phone: true,
          avatarColor: true,
          role: true,
          permissions: true,
          isActive: true,
          lastLoginAt: true,
          employeeId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { firstName: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.employeeProfile.count({ where }),
    ]);

    return NextResponse.json({ data: employees, total, limit, offset });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list employees');
  }
}

// ── POST: Create employee profile ───────────────────────────────

const AVATAR_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

function generatePin(): string {
  // Generate a random 4-digit PIN (1000-9999)
  return String(Math.floor(1000 + Math.random() * 9000));
}

const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  role: z.enum(['POS_CASHIER', 'POS_SERVER', 'SHIFT_MANAGER', 'STORE_MANAGER']).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().optional(),
  employeeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Validation failed');
    }

    const data = parsed.data;

    // Generate a random 4-digit PIN
    const pin = generatePin();
    const pinHash = await hashPassword(pin);

    // Pick a random avatar color if not provided
    const avatarColor = data.avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const employee = await prisma.employeeProfile.create({
      data: {
        companyId: companyId!,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName || null,
        email: data.email || null,
        phone: data.phone || null,
        avatarColor,
        pinHash,
        role: data.role || 'POS_CASHIER',
        permissions: (data.permissions || {}) as any,
        userId: data.userId || null,
        employeeId: data.employeeId || null,
        createdBy: user!.sub,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        avatarColor: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Return the PIN in plaintext ONCE so the admin can share it
    return NextResponse.json(
      { ...employee, pin },
      { status: 201 }
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create employee');
  }
}
