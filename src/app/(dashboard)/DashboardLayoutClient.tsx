'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QueryProvider } from '@/providers/QueryProvider';
import { useDataHydration } from '@/hooks/useDataHydration';
import { useAppStore } from '@/store/appStore';

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, error, isHydrated } = useDataHydration();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarded = useAppStore((s) => s.isOnboarded);

  // ── Onboarding enforcement ─────────────────────────────────────────
  // If the user has not completed onboarding and is NOT already on the
  // onboarding page, redirect them there.
  useEffect(() => {
    if (isHydrated && !isOnboarded && !pathname.startsWith('/onboarding')) {
      router.replace('/onboarding');
    }
  }, [isHydrated, isOnboarded, pathname, router]);

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading && !isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error && !isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="mx-4 w-full max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Unable to load dashboard
          </h2>
          <p className="mb-6 text-sm text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Hydrated — render the full dashboard ───────────────────────────
  return (
    <QueryProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </QueryProvider>
  );
}
