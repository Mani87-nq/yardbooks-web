'use client';

/**
 * DashboardLayoutClient — Wraps all dashboard pages.
 *
 * INVESTIGATION: Testing DashboardLayout + useDataHydration moved
 * to a separate non-blocking component to prevent scheduler starvation.
 *
 * The key insight: useDataHydration triggers 15+ API calls and then
 * a large Zustand setState. If these updates schedule work on the
 * same lanes as hydration, they can expire and block all transitions.
 *
 * Solution: Run hydration in a separate component that doesn't gate
 * the rendering of {children}. The children always render immediately.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QueryProvider } from '@/providers/QueryProvider';
import { useDataHydration } from '@/hooks/useDataHydration';
import { useAppStore } from '@/store/appStore';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourAutoLauncher } from '@/components/tour/TourAutoLauncher';

/**
 * Separate component for data hydration + onboarding enforcement.
 * This prevents the hydration state changes from affecting the
 * rendering of {children} in the parent layout.
 */
function DataHydrationManager() {
  const { isHydrated } = useDataHydration();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarded = useAppStore((s) => s.isOnboarded);

  // Onboarding enforcement
  useEffect(() => {
    if (isHydrated && !isOnboarded && !pathname.startsWith('/onboarding')) {
      router.replace('/onboarding');
    }
  }, [isHydrated, isOnboarded, pathname, router]);

  return null; // Renders nothing — only runs side effects
}

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── ALWAYS render the full layout tree with {children} ─────────
  // DataHydrationManager runs as a sibling, populating the Zustand
  // store in the background. Pages use TanStack Query for their own
  // data, so they don't depend on hydration to render.
  return (
    <QueryProvider>
      <TourProvider>
        <DashboardLayout>{children}</DashboardLayout>
        <DataHydrationManager />
        <TourAutoLauncher />
      </TourProvider>
    </QueryProvider>
  );
}
