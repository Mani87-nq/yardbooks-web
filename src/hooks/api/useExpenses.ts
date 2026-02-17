'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface Expense {
  id: string;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  category: string;
  description: string;
  amount: number;
  gctAmount: number;
  gctClaimable: boolean;
  date: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export function useExpenses(params?: { category?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get<PaginatedResponse<Expense>>(`/api/v1/expenses${qs ? `?${qs}` : ''}`),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => api.get<Expense>(`/api/v1/expenses/${id}`),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Expense>('/api/v1/expenses', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Expense>(`/api/v1/expenses/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expenses', vars.id] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });
}
