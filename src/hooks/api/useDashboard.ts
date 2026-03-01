'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface DashboardLowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  reorderLevel: number;
}

interface DashboardRecentInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  issueDate: string;
  customer: { id: string; name: string } | null;
}

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  totalReceivable: number;
  overdueCount: number;
  invoiceCount: number;
  expenseCount: number;
  customerCount: number;
  lowStockCount: number;
  lowStockProducts: DashboardLowStockProduct[];
  recentInvoices: DashboardRecentInvoice[];
}

const DEFAULT_STATS: DashboardData = {
  totalRevenue: 0,
  totalExpenses: 0,
  profit: 0,
  totalReceivable: 0,
  overdueCount: 0,
  invoiceCount: 0,
  expenseCount: 0,
  customerCount: 0,
  lowStockCount: 0,
  lowStockProducts: [],
  recentInvoices: [],
};

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/api/v1/dashboard'),
    // Refresh every 60 seconds so the dashboard stays current
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Drop-in replacement for the old Zustand `useDashboardStats` selector.
 * Returns the same shape so existing UI doesn't need changes.
 */
export function useDashboardStats() {
  const { data } = useDashboardData();
  return data ?? DEFAULT_STATS;
}

/**
 * Drop-in replacement for the old Zustand `useRecentInvoices` selector.
 */
export function useRecentInvoices(limit = 5) {
  const { data } = useDashboardData();
  return (data?.recentInvoices ?? []).slice(0, limit);
}

/**
 * Drop-in replacement for the old Zustand `useLowStockProducts` selector.
 */
export function useLowStockProducts() {
  const { data } = useDashboardData();
  return data?.lowStockProducts ?? [];
}
