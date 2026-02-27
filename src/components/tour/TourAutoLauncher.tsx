'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useTourStore } from '@/store/tourStore';
import { useTourContext } from './TourProvider';

/**
 * Auto-launches the welcome tour for newly onboarded users.
 *
 * Conditions for auto-launch:
 * 1. User is on the /dashboard page
 * 2. User has completed onboarding
 * 3. Welcome tour has NOT been completed before
 * 4. There's a `startTour=welcome` flag in sessionStorage (set by onboarding page)
 *    OR this is a freshly onboarded user detected by the flag
 *
 * Mounts inside TourProvider, so it has access to tour context.
 */
export function TourAutoLauncher() {
  const pathname = usePathname();
  const isOnboarded = useAppStore((s) => s.isOnboarded);
  const { startTour, isActive, isTourCompleted } = useTourContext();
  const { initialized } = useTourStore();
  const launched = useRef(false);

  useEffect(() => {
    // Only auto-launch once per session, on the dashboard
    if (
      launched.current ||
      !initialized ||
      isActive ||
      pathname !== '/dashboard' ||
      !isOnboarded
    ) {
      return;
    }

    // Check if the welcome tour should be launched
    const shouldLaunch = typeof window !== 'undefined' &&
      sessionStorage.getItem('yb-start-tour') === 'welcome';

    if (shouldLaunch && !isTourCompleted('welcome')) {
      launched.current = true;
      sessionStorage.removeItem('yb-start-tour');

      // Delay to let the dashboard fully render
      const timer = setTimeout(() => {
        startTour('welcome');
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [pathname, isOnboarded, initialized, isActive, isTourCompleted, startTour]);

  return null;
}
