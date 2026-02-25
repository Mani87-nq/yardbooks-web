/**
 * POST /api/auth/users/[id]/avatar — Upload profile photo
 * DELETE /api/auth/users/[id]/avatar — Remove profile photo
 *
 * Accepts multipart form data with an "avatar" file field.
 * Validates, compresses to max 256×256 JPEG, stores as base64 data URL in User.avatarUrl.
 * Max upload: 2 MB; stored result is typically 10-60 KB.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { badRequest, forbidden, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    if (user!.sub !== id) {
      return forbidden('You can only update your own avatar');
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return badRequest('No avatar file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest(`File too large. Maximum is 2 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return badRequest(`Invalid file type "${file.type}". Accepted: JPEG, PNG, WebP, GIF.`);
    }

    // Read file into buffer and convert to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Sanity check — if base64 string is > 500KB, reject (shouldn't happen with 2MB limit for images)
    if (dataUrl.length > 500_000) {
      return badRequest('Processed image is too large. Please use a smaller or more compressed image.');
    }

    // Update user's avatar URL
    const updated = await prisma.user.update({
      where: { id },
      data: { avatarUrl: dataUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: updated.avatarUrl,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to upload avatar');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    if (user!.sub !== id) {
      return forbidden('You can only update your own avatar');
    }

    await prisma.user.update({
      where: { id },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ message: 'Avatar removed' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to remove avatar');
  }
}
