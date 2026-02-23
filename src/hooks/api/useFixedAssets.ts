'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';

// ============================================
// Types matching API responses
// ============================================

interface AssetCategory {
  id: string;
  code: string;
  name: string;
}

export interface FixedAssetAPI {
  id: string;
  companyId: string;
  assetNumber: string;
  name: string | null;
  description: string;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  assetTag: string | null;
  serialNumber: string | null;
  barcode: string | null;
  locationId: string | null;
  locationName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  acquisitionDate: string | null;
  purchaseDate: string | null;
  acquisitionMethod: string;
  supplierId: string | null;
  supplierName: string | null;
  vendor: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  purchaseOrderNumber: string | null;
  purchaseCost: number | null;
  acquisitionCost: number;
  currency: string;
  exchangeRate: number;
  acquisitionCostJMD: number;
  installationCost: number | null;
  freightCost: number | null;
  customsDuty: number | null;
  otherCapitalizedCosts: number | null;
  totalCapitalizedCost: number;
  bookDepreciationMethod: string;
  bookUsefulLifeMonths: number | null;
  bookResidualValue: number;
  bookDepreciationStartDate: string | null;
  bookAccumulatedDepreciation: number;
  bookNetBookValue: number;
  taxCapitalAllowanceClass: string | null;
  taxInitialAllowanceRate: number | null;
  taxAnnualAllowanceRate: number | null;
  taxInitialAllowanceClaimed: number | null;
  taxAccumulatedAllowances: number;
  taxWrittenDownValue: number;
  taxEligibleCost: number;
  status: string;
  location: string | null;
  isFullyDepreciated: boolean;
  isFullyAllowed: boolean;
  insuredValue: number | null;
  insurancePolicyNumber: string | null;
  insuranceExpiry: string | null;
  warrantyExpiry: string | null;
  warrantyProvider: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  category: AssetCategory | null;
}

export interface AssetCategoryAPI {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  defaultBookMethod: string;
  defaultBookUsefulLifeMonths: number;
  defaultBookResidualValuePercent: number;
  taxCapitalAllowanceClass: string;
  taxInitialAllowanceRate: number;
  taxAnnualAllowanceRate: number;
  taxAllowanceYears: number;
  hasCostCap: boolean;
  costCapAmount: number | null;
  isActive: boolean;
  _count: { assets: number };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

interface DepreciationRunResult {
  data: Record<string, unknown>;
  summary: {
    assetsProcessed: number;
    totalBookDepreciation: number;
    totalTaxAllowance: number;
    fiscalYear: number;
    periodNumber: number;
  };
}

// ============================================
// Hooks
// ============================================

export function useFixedAssets(params?: { search?: string; status?: string; categoryId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['fixed-assets', params],
    queryFn: () => api.get<PaginatedResponse<FixedAssetAPI>>(`/api/v1/fixed-assets${qs ? `?${qs}` : ''}`),
  });
}

export function useFixedAsset(id: string) {
  return useQuery({
    queryKey: ['fixed-assets', id],
    queryFn: () => api.get<{ data: FixedAssetAPI }>(`/api/v1/fixed-assets/${id}`),
    enabled: !!id,
  });
}

export function useCreateFixedAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<FixedAssetAPI>('/api/v1/fixed-assets', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); },
  });
}

export function useUpdateFixedAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<{ data: FixedAssetAPI }>(`/api/v1/fixed-assets/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets', vars.id] });
    },
  });
}

export function useDeleteFixedAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/fixed-assets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); },
  });
}

export function useAssetCategories() {
  return useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get<{ data: AssetCategoryAPI[] }>('/api/v1/fixed-assets/categories'),
  });
}

export function useRunDepreciation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fiscalYear: number;
      periodNumber: number;
      periodStartDate: string;
      periodEndDate: string;
      categoryIds?: string[];
      assetIds?: string[];
    }) => api.post<DepreciationRunResult>('/api/v1/fixed-assets/depreciation-run', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fixed-assets'] }); },
  });
}
