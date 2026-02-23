'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

// ============================================
// Types matching API responses
// ============================================

export interface StockCountItemAPI {
  id: string;
  stockCountId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  uomCode: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  varianceValue: number | null;
  varianceReason: string | null;
  countedAt: string | null;
  countedBy: string | null;
  location: string | null;
  notes: string | null;
  product?: { id: string; name: string; sku: string };
}

export interface StockCountAPI {
  id: string;
  companyId: string;
  countNumber: string;
  name: string;
  type: string;
  status: string;
  warehouseId: string | null;
  warehouseName: string | null;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  countedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number;
  totalVarianceValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: StockCountItemAPI[];
  _count?: { items: number };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

// ============================================
// Hooks
// ============================================

export function useStockCounts(params?: { status?: string; type?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['stock-counts', params],
    queryFn: () => api.get<PaginatedResponse<StockCountAPI>>(`/api/v1/stock-counts${qs ? `?${qs}` : ''}`),
  });
}

export function useStockCount(id: string) {
  return useQuery({
    queryKey: ['stock-counts', id],
    queryFn: () => api.get<StockCountAPI>(`/api/v1/stock-counts/${id}`),
    enabled: !!id,
  });
}

export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      type: string;
      scheduledDate: string;
      warehouseId?: string;
      warehouseName?: string;
      categoryIds?: string[];
      notes?: string;
    }) => api.post<StockCountAPI>('/api/v1/stock-counts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-counts'] }); },
  });
}

export function useUpdateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<StockCountAPI>(`/api/v1/stock-counts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
      qc.invalidateQueries({ queryKey: ['stock-counts', vars.id] });
    },
  });
}

export function useStockCountItems(stockCountId: string) {
  return useQuery({
    queryKey: ['stock-counts', stockCountId, 'items'],
    queryFn: () => api.get<PaginatedResponse<StockCountItemAPI>>(
      `/api/v1/stock-counts/${stockCountId}/items?limit=200`
    ),
    enabled: !!stockCountId,
  });
}

export function useAddStockCountItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stockCountId, items }: {
      stockCountId: string;
      items: Array<{
        productId: string;
        productName: string;
        sku: string;
        barcode?: string;
        uomCode: string;
        expectedQuantity: number;
        countedQuantity?: number;
        location?: string;
        notes?: string;
      }>;
    }) => api.post<{ created: number }>(`/api/v1/stock-counts/${stockCountId}/items`, { items }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
      qc.invalidateQueries({ queryKey: ['stock-counts', vars.stockCountId] });
      qc.invalidateQueries({ queryKey: ['stock-counts', vars.stockCountId, 'items'] });
    },
  });
}

export function useUpdateStockCountItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stockCountId, itemId, data }: {
      stockCountId: string;
      itemId: string;
      data: {
        countedQuantity?: number;
        varianceReason?: string;
        location?: string;
        notes?: string;
      };
    }) => api.put<StockCountItemAPI>(
      `/api/v1/stock-counts/${stockCountId}/items/${itemId}`, data
    ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['stock-counts', vars.stockCountId] });
      qc.invalidateQueries({ queryKey: ['stock-counts', vars.stockCountId, 'items'] });
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
    },
  });
}
