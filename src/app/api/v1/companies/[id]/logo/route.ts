/**
 * POST /api/v1/companies/[id]/logo — Upload company logo
 * DELETE /api/v1/companies/[id]/logo — Remove company logo
 *
 * Accepts multipart form data with a "logo" file field.
 * Validates type/size, stores as base64 data URL in Company.logoUrl.
 * Max upload: 2 MB.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { badRequest, forbidden, notFound, internalError } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    // Verify membership + role
    const membership = await prisma.companyMember.findFirst({
      where: { userId: user!.sub, companyId: id },
    });
    if (!membership) return notFound('Company not found');
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return forbidden('Only OWNER or ADMIN can update the company logo');
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return badRequest('No logo file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequest(`File too large. Maximum is 2 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return badRequest(`Invalid file type "${file.type}". Accepted: JPEG, PNG, WebP, SVG, GIF.`);
    }

    // Read file and convert to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Safety limit — reject if encoded data is excessively large
    if (dataUrl.length > 750_000) {
      return badRequest('Processed image is too large. Please use a smaller or more compressed image.');
    }

    // Update company logo
    const updated = await prisma.company.update({
      where: { id },
      data: { logoUrl: dataUrl },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    return NextResponse.json({
      message: 'Logo uploaded successfully',
      logoUrl: updated.logoUrl,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to upload logo');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const membership = await prisma.companyMember.findFirst({
      where: { userId: user!.sub, companyId: id },
    });
    if (!membership) return notFound('Company not found');
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return forbidden('Only OWNER or ADMIN can update the company logo');
    }

    await prisma.company.update({
      where: { id },
      data: { logoUrl: null },
    });

    return NextResponse.json({ message: 'Logo removed' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to remove logo');
  }
}
