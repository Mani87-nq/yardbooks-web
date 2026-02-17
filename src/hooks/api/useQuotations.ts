'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customer: { id: string; name: string };
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  status: string;
  validUntil: string;
  items: QuotationItem[];
  createdAt: string;
}

interface QuotationItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

export function useQuotations(params?: { status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['quotations', params],
    queryFn: () => api.get<PaginatedResponse<Quotation>>(`/api/v1/quotations${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Quotation>('/api/v1/quotations', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); },
  });
}
