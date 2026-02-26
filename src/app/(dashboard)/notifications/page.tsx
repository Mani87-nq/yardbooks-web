'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  BellIcon,
  CheckIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CubeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  BuildingLibraryIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';
import { apiFetch } from '@/lib/api-client';
import type { NotificationType, NotificationPriority } from '@/types/notifications';
import {
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notifications';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  INVOICE_DUE: DocumentTextIcon,
  INVOICE_OVERDUE: ExclamationTriangleIcon,
  PAYMENT_RECEIVED: BanknotesIcon,
  LOW_STOCK: CubeIcon,
  PAYROLL_DUE: UserGroupIcon,
  EXPENSE_APPROVED: CheckCircleIcon,
  EXPENSE_REJECTED: XCircleIcon,
  PO_RECEIVED: ClipboardDocumentListIcon,
  BANK_SYNC: BuildingLibraryIcon,
  TAX_DEADLINE: DocumentTextIcon,
  SECURITY_ALERT: ExclamationTriangleIcon,
  SYSTEM: CogIcon,
  REMINDER: BellIcon,
};

export default function NotificationsPage() {
  const notifications = useAppStore((state) => state.notifications) || [];
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);
  const deleteNotification = useAppStore((state) => state.deleteNotification);

  const [filter, setFilter] = useState('all');

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    switch (filter) {
      case 'unread':
        result = result.filter((n) => !n.isRead && !n.isArchived);
        break;
      case 'read':
        result = result.filter((n) => n.isRead && !n.isArchived);
        break;
      case 'archived':
        result = result.filter((n) => n.isArchived);
        break;
      default:
        result = result.filter((n) => !n.isArchived);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead && !n.isArchived).length;

  const getPriorityColor = (priority: NotificationPriority) => {
    const colors: Record<NotificationPriority, string> = {
      LOW: 'text-gray-400',
      MEDIUM: 'text-blue-500',
      HIGH: 'text-orange-500',
      URGENT: 'text-red-500',
    };
    return colors[priority];
  };

  const handleMarkRead = async (id: string) => {
    // Optimistic UI update
    markNotificationRead?.(id);
    // Persist to DB
    try {
      await apiFetch('/api/v1/notifications', { method: 'POST', body: { notificationIds: [id] } });
    } catch {
      // Revert would be complex — the notification was already marked in Zustand
      // The next page load will sync from API anyway
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic UI update
    markAllNotificationsRead?.();
    // Persist to DB
    try {
      await apiFetch('/api/v1/notifications', { method: 'POST', body: { markAllRead: true } });
    } catch {
      // Same — next hydration will sync
    }
  };

  const handleArchive = async (id: string) => {
    // Optimistic UI update
    deleteNotification?.(id);
    // Persist to DB
    try {
      await apiFetch('/api/v1/notifications', { method: 'DELETE', body: { notificationId: id } });
    } catch {
      // Next hydration will sync
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BellIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-gray-500 dark:text-gray-400">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <Link
            href="/notifications/settings"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Cog6ToothIcon className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === option.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {option.label}
            {option.value === 'unread' && unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <BellIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No notifications</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'unread'
                ? "You've read all your notifications"
                : filter === 'archived'
                ? 'No archived notifications'
                : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredNotifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || BellIcon;
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !notification.isRead ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${!notification.isRead ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Icon className={`w-5 h-5 ${getPriorityColor(notification.priority)}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-medium ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{notification.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {NOTIFICATION_TYPE_LABELS[notification.type]}
                        </span>

                        {notification.actionUrl && notification.actionLabel && (
                          <Link
                            href={notification.actionUrl}
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            {notification.actionLabel}
                          </Link>
                        )}

                        <div className="flex-1" />

                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 flex items-center gap-1"
                          >
                            <CheckIcon className="w-3 h-3" />
                            Mark read
                          </button>
                        )}

                        {!notification.isArchived && (
                          <button
                            onClick={() => handleArchive(notification.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                          >
                            <ArchiveBoxIcon className="w-3 h-3" />
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
