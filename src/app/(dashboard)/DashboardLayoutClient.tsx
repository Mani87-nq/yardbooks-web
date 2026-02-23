'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
