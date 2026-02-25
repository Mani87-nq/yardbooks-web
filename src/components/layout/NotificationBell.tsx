'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  BellIcon,
  CheckIcon,
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
  ShieldExclamationIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { useAppStore, useUnreadNotificationCount } from '@/store/appStore';
import { api } from '@/lib/api-client';
import type { Notification, NotificationType } from '@/types/notifications';

// ── Icon map keyed by Prisma enum values ─────────────────────────────

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
  TAX_DEADLINE: CalendarIcon,
  SECURITY_ALERT: ShieldExclamationIcon,
  SYSTEM: CogIcon,
  REMINDER: BellIcon,
};

// ── Polling interval (ms) ────────────────────────────────────────────

const POLL_INTERVAL = 60_000; // 60 seconds

// ── Component ────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Zustand selectors
  const notifications = useAppStore((s) => s.notifications);
  const activeCompanyId = useAppStore((s) => s.activeCompany?.id);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const hydrated = useAppStore((s) => s.hydrated);

  const unreadCount = useUnreadNotificationCount();

  // The 10 most recent notifications for the active company
  const recentNotifications = React.useMemo(() => {
    return [...notifications]
      .filter((n) => n.companyId === activeCompanyId && !n.isArchived)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);
  }, [notifications, activeCompanyId]);

  // ── Polling for unread notifications ────────────────────────────────

  const pollNotifications = useCallback(async () => {
    if (!hydrated) return;
    try {
      const res = await api.get<{
        data: Notification[];
        unreadCount: number;
      }>('/api/v1/notifications?limit=10&unreadOnly=true');
      // Merge: replace unread ones, keep others from the store
      const unreadIds = new Set(res.data.map((n) => n.id));
      const existing = notifications.filter(
        (n) => !unreadIds.has(n.id),
      );
      setNotifications([...res.data, ...existing]);
    } catch {
      // Silently ignore polling errors
    }
  }, [hydrated, notifications, setNotifications]);

  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(pollNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [hydrated, pollNotifications]);

  // ── Click outside to close ──────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleNotificationClick = async (notification: Notification) => {
    // Optimistic mark-as-read
    if (!notification.isRead) {
      markNotificationRead(notification.id);
      api
        .post('/api/v1/notifications', { notificationIds: [notification.id] })
        .catch(() => {});
    }

    // Navigate if a link is present
    const link = notification.link || notification.actionUrl;
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllRead = async () => {
    markAllNotificationsRead();
    api.post('/api/v1/notifications', { markAllRead: true }).catch(() => {});
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-white rounded-xl shadow-lg border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {recentNotifications.length === 0 ? (
              <div className="py-10 text-center">
                <BellIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || BellIcon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      !n.isRead ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Unread indicator + icon */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          !n.isRead ? 'bg-emerald-100' : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            !n.isRead
                              ? 'text-emerald-600'
                              : 'text-gray-400'
                          }`}
                        />
                      </div>
                      {!n.isRead && (
                        <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          !n.isRead
                            ? 'font-semibold text-gray-900'
                            : 'font-medium text-gray-700'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/notifications');
              }}
              className="w-full text-center text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
