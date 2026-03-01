'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Module-level guard — survives component unmount/remount cycles.
 * useRef resets on every mount, so it can't prevent duplicate registrations
 * when React Strict Mode or layout re-renders remount this component.
 */
let swRegistered = false;

/**
 * Registers the service worker and handles background sync.
 * Renders nothing — just side effects.
 */
export function ServiceWorkerRegistration() {
  const addNotification = useAppStore((s) => s.addNotification);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === 'MUTATION_QUEUED') {
        addNotification?.({
          id: `sw-queued-${event.data.mutation.id}`,
          companyId: '',
          title: 'Saved offline',
          message: `Your ${event.data.mutation.method} action has been queued and will sync when you reconnect.`,
          type: 'SYSTEM',
          priority: 'LOW',
          isRead: false,
          isArchived: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (event.data?.type === 'SYNC_COMPLETE') {
        const { results, remaining } = event.data;
        const synced = results.filter((r: { success: boolean }) => r.success).length;
        if (synced > 0) {
          addNotification?.({
            id: `sw-synced-${Date.now()}`,
            companyId: '',
            title: 'Changes synced',
            message: `${synced} offline action${synced !== 1 ? 's' : ''} synced successfully.${
              remaining > 0 ? ` ${remaining} still pending.` : ''
            }`,
            type: 'SYSTEM',
            priority: 'LOW',
            isRead: false,
            isArchived: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    },
    [addNotification]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Module-level guard — prevents duplicate registrations across remounts
    if (swRegistered) {
      return;
    }
    swRegistered = true;

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[App] SW registered:', registration.scope);

        // Check for updates periodically (every 60 minutes)
        const updateInterval = setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle updates — when a new SW is installed, activate it and reload
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — activate it
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // When a new SW takes over, reload the page to ensure fresh assets
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Only auto-reload if the page is visible and not in the middle of something
          if (document.visibilityState === 'visible') {
            window.location.reload();
          }
        });

        // Store interval ref for cleanup
        (window as unknown as Record<string, unknown>).__swUpdateInterval = updateInterval;
      })
      .catch((error) => {
        console.warn('[App] SW registration failed:', error);
      });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Tell SW when we're back online
    const handleOnline = () => {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: 'ONLINE' });

        if ('sync' in registration) {
          (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync
            .register('yaadbooks-sync')
            .catch(() => {
              // Background Sync not supported
            });
        }
      });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
      const interval = (window as unknown as Record<string, unknown>).__swUpdateInterval;
      if (interval) clearInterval(interval as ReturnType<typeof setInterval>);
    };
  }, [handleMessage]);

  return null;
}
