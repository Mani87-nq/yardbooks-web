/**
 * Notification service for YardBooks.
 *
 * Provides helpers to create in-app notifications (stored in the
 * Notification table) and optionally send an accompanying email.
 */
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/email/service';

// ─── Types ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'INVOICE_DUE'
  | 'INVOICE_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'LOW_STOCK'
  | 'PAYROLL_DUE'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'PO_RECEIVED'
  | 'BANK_SYNC'
  | 'TAX_DEADLINE'
  | 'SECURITY_ALERT'
  | 'SYSTEM'
  | 'REMINDER';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CreateNotificationOptions {
  userId?: string;
  companyId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
  relatedType?: string;
  /** When true, also send an email notification. Requires emailTo and emailTemplate. */
  sendEmail?: boolean;
  emailTo?: string;
  emailTemplate?: { subject: string; html: string; text: string };
}

// ─── Create ──────────────────────────────────────────────────────────

/**
 * Create an in-app notification and optionally send a matching email.
 */
export async function createNotification(
  options: CreateNotificationOptions,
): Promise<{ id: string }> {
  const {
    userId,
    companyId,
    type,
    priority = 'MEDIUM',
    title,
    message,
    link,
    relatedId,
    relatedType,
  } = options;

  // Persist the in-app notification
  const notification = await prisma.notification.create({
    data: {
      userId: userId ?? null,
      companyId,
      type,
      priority,
      title,
      message,
      link: link ?? null,
      actionUrl: link ?? null,
      relatedId: relatedId ?? null,
      relatedType: relatedType ?? null,
    },
  });

  // Optionally fire an email (best-effort; failures are logged, not thrown)
  if (options.sendEmail && options.emailTo && options.emailTemplate) {
    try {
      await sendEmail({
        to: options.emailTo,
        subject: options.emailTemplate.subject,
        html: options.emailTemplate.html,
        text: options.emailTemplate.text,
      });
    } catch (err) {
      console.error(
        '[NotificationService] Failed to send email for notification',
        notification.id,
        err,
      );
    }
  }

  return { id: notification.id };
}

// ─── Read ────────────────────────────────────────────────────────────

/**
 * Retrieve notifications for a user within a company.
 * Uses cursor-based pagination.
 */
export async function getUserNotifications(
  userId: string,
  companyId: string,
  options: { limit?: number; cursor?: string; unreadOnly?: boolean } = {},
) {
  const { limit = 50, cursor, unreadOnly = false } = options;

  const where: Record<string, unknown> = {
    companyId,
    OR: [{ userId }, { userId: null }],
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

  return {
    data,
    pagination: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
      limit,
    },
  };
}

// ─── Mark Read ───────────────────────────────────────────────────────

/**
 * Mark a single notification as read for a given user.
 * Returns true if the notification was found and updated.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      OR: [{ userId }, { userId: null }],
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count > 0;
}

/**
 * Mark all unread notifications as read for a user in a company.
 */
export async function markAllNotificationsRead(
  userId: string,
  companyId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      companyId,
      OR: [{ userId }, { userId: null }],
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count;
}

// ─── Unread Count ────────────────────────────────────────────────────

/**
 * Get the count of unread notifications for a user in a company.
 */
export async function getUnreadCount(
  userId: string,
  companyId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      companyId,
      OR: [{ userId }, { userId: null }],
      isRead: false,
    },
  });
}
