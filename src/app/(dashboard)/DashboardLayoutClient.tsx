'use client';

/**
 * Binary-search step 1: Add DashboardLayout (sidebar + header) back.
 * Still NO useDataHydration, TourProvider, loading/error guards, or
 * onboarding enforcement — those are the suspects for stuck scheduler lanes.
 */
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QueryProvider } from '@/providers/QueryProvider';

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </QueryProvider>
  );
}
