/**
 * PATCH /api/auth/users/[id] — Update user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { badRequest, forbidden, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).nullable().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    // Users can only update their own profile
    if (user!.sub !== id) {
      return forbidden('You can only update your own profile');
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed');

    const data: Record<string, unknown> = {};
    if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName;
    if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;

    // Email change: check uniqueness
    if (parsed.data.email !== undefined && parsed.data.email !== user!.email) {
      const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (existing) return badRequest('Email already in use');
      data.email = parsed.data.email;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update profile');
  }
}
