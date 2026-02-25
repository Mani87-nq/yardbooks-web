'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

export interface InvoiceCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string | { street: string; city: string; parish?: string };
  [key: string]: unknown;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: InvoiceCustomer;
  subtotal: number;
  gctAmount: number;
  discount: number;
  discountType: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  terms?: string;
  customerPONumber?: string;
  items: InvoiceItem[];
  payments?: unknown[];
  createdAt: string;
  updatedAt?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gctRate: string;
  gctAmount: number;
  total: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export function useInvoices(params?: { search?: string; status?: string; customerId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.customerId) searchParams.set('customerId', params.customerId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.get<PaginatedResponse<Invoice>>(`/api/v1/invoices${qs ? `?${qs}` : ''}`),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<Invoice>(`/api/v1/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Invoice>('/api/v1/invoices', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Invoice>(`/api/v1/invoices/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', vars.id] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });
}
