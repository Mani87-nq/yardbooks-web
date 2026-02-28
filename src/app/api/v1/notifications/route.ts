/**
 * GET    /api/v1/notifications — List notifications for the current user
 * POST   /api/v1/notifications — Mark notification(s) as read
 * DELETE /api/v1/notifications — Delete a single notification or bulk-delete all
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── GET (List notifications) ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, unknown> = {
      companyId: companyId!,
      OR: [{ userId: user!.sub }, { userId: null }],
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = notifications.length > limit;
    const data = hasMore ? notifications.slice(0, limit) : notifications;

    // Include unread count in the response for convenience
    const unreadCount = await prisma.notification.count({
      where: {
        companyId: companyId!,
        OR: [{ userId: user!.sub }, { userId: null }],
        isRead: false,
      },
    });

    return NextResponse.json({
      data,
      unreadCount,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
        limit,
      },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list notifications');
  }
}

// ─── POST (Mark as read) ────────────────────────────────────────────

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1).optional(),
  markAllRead: z.boolean().optional(),
}).refine(
  (data) => data.notificationIds || data.markAllRead,
  { message: 'Provide either notificationIds or markAllRead: true' },
);

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { notificationIds, markAllRead } = parsed.data;
    const now = new Date();

    if (markAllRead) {
      const result = await prisma.notification.updateMany({
        where: {
          companyId: companyId!,
          OR: [{ userId: user!.sub }, { userId: null }],
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      });

      return NextResponse.json({
        message: 'All notifications marked as read',
        count: result.count,
      });
    }

    // Mark specific notifications as read
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds! },
        companyId: companyId!,
        OR: [{ userId: user!.sub }, { userId: null }],
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    return NextResponse.json({
      message: 'Notifications marked as read',
      count: result.count,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update notifications');
  }
}

// ─── DELETE (Archive / delete notification) ──────────────────────────

const deleteSchema = z.object({
  notificationId: z.string().min(1).optional(),
  deleteAll: z.boolean().optional(),
}).refine(
  (data) => data.notificationId || data.deleteAll,
  { message: 'Provide either notificationId or deleteAll: true' },
);

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }

    // Bulk delete all notifications for this company/user
    if (parsed.data.deleteAll) {
      const result = await prisma.notification.deleteMany({
        where: {
          companyId: companyId!,
          OR: [{ userId: user!.sub }, { userId: null }],
        },
      });

      return NextResponse.json({
        message: 'All notifications deleted',
        count: result.count,
      });
    }

    // Delete a single notification
    const notification = await prisma.notification.findFirst({
      where: {
        id: parsed.data.notificationId!,
        companyId: companyId!,
        OR: [{ userId: user!.sub }, { userId: null }],
      },
    });

    if (!notification) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    await prisma.notification.delete({
      where: { id: parsed.data.notificationId! },
    });

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete notification');
  }
}
