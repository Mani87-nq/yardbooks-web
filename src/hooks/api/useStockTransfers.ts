'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

// ---- Warehouse ----

export interface ApiWarehouse {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string | null;
  parish: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { outgoingTransfers: number; incomingTransfers: number };
}

export function useWarehouses(params?: { isActive?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['warehouses', params],
    queryFn: () =>
      api.get<{ data: ApiWarehouse[] }>(
        `/api/v1/warehouses${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      code: string;
      address?: string;
      parish?: string;
      phone?: string;
      email?: string;
      manager?: string;
      isDefault?: boolean;
    }) => api.post<ApiWarehouse>('/api/v1/warehouses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.put<ApiWarehouse>(`/api/v1/warehouses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

// ---- Stock Transfers ----

export interface ApiStockTransfer {
  id: string;
  companyId: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: string;
  notes: string | null;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  shippedBy: string | null;
  shippedAt: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
  fromWarehouse?: { id: string; name: string; code: string; address?: string | null };
  toWarehouse?: { id: string; name: string; code: string; address?: string | null };
  items?: ApiStockTransferItem[];
  _count?: { items: number };
}

export interface ApiStockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  productName: string;
  sku: string;
  quantityRequested: number;
  quantityShipped: number | null;
  quantityReceived: number | null;
  unitCost: number;
  uomCode: string;
  notes: string | null;
  product?: { quantity: number; unitPrice: number };
}

export function useStockTransfers(params?: {
  status?: string;
  warehouseId?: string;
  limit?: number;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.warehouseId) searchParams.set('warehouseId', params.warehouseId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['stock-transfers', params],
    queryFn: () =>
      api.get<PaginatedResponse<ApiStockTransfer>>(
        `/api/v1/stock-transfers${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useStockTransfer(id: string | null) {
  return useQuery({
    queryKey: ['stock-transfer', id],
    queryFn: () => api.get<ApiStockTransfer>(`/api/v1/stock-transfers/${id}`),
    enabled: !!id,
  });
}

export function useCreateStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fromWarehouseId: string;
      toWarehouseId: string;
      items: Array<{
        productId: string;
        productName: string;
        sku: string;
        quantityRequested: number;
        unitCost: number;
        uomCode?: string;
        notes?: string;
      }>;
      notes?: string;
      status?: 'DRAFT' | 'PENDING';
    }) => api.post<ApiStockTransfer>('/api/v1/stock-transfers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });
}

export function useApproveStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<ApiStockTransfer>(`/api/v1/stock-transfers/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['stock-transfer'] });
    },
  });
}

export function useShipStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items?: Array<{ id: string; quantityShipped: number }> }) =>
      api.post<ApiStockTransfer>(`/api/v1/stock-transfers/${id}/ship`, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['stock-transfer'] });
    },
  });
}

export function useReceiveStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items?: Array<{ id: string; quantityReceived: number; notes?: string }> }) =>
      api.post<ApiStockTransfer>(`/api/v1/stock-transfers/${id}/receive`, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['stock-transfer'] });
    },
  });
}
