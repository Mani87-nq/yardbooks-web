'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import type { PosSettings, PaymentMethodType } from '@/types/pos';

// ---- API response shapes ----

interface PaginatedResponse<T> {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
}

// API uses UPPERCASE enums; these interfaces reflect the raw API shape.
export interface ApiPosOrderItem {
  id: string;
  lineNumber: number;
  productId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  quantity: number;
  uomCode: string;
  unitPrice: number;
  lineSubtotal: number;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  lineTotalBeforeTax: number;
  isGctExempt: boolean;
  gctRate: number;
  gctAmount: number;
  lineTotal: number;
  warehouseId: string | null;
  notes: string | null;
}

export interface ApiPosPayment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  status: string;
  reference: string | null;
  amountTendered: number | null;
  changeGiven: number | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPosOrder {
  id: string;
  orderNumber: string;
  sessionId: string | null;
  terminalId: string | null;
  terminalName: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  items: ApiPosOrderItem[];
  payments: ApiPosPayment[];
  itemCount: number;
  subtotal: number;
  orderDiscountType: string | null;
  orderDiscountValue: number | null;
  orderDiscountAmount: number;
  orderDiscountReason: string | null;
  taxableAmount: number;
  exemptAmount: number;
  gctRate: number;
  gctAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  changeGiven: number;
  status: string;
  heldReason: string | null;
  voidReason: string | null;
  receiptPrinted: boolean;
  isOfflineOrder: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  createdBy: string;
  notes: string | null;
}

export interface ApiPosTerminal {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  isActive: boolean;
  isOnline: boolean;
  lastSeen: string | null;
  defaultPaymentMethods: string[];
  allowNegativeInventory: boolean;
  requireCustomer: boolean;
  allowDiscounts: boolean;
  maxDiscountPercent: number;
  barcodeScanner: boolean;
  currentSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPosSession {
  id: string;
  terminalId: string;
  terminalName: string;
  cashierName: string;
  cashierId: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number;
  closingCash: number | null;
  cashVariance: number | null;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  status: string;
  closingNotes: string | null;
  createdAt: string;
  updatedAt: string;
  terminal?: { id: string; name: string; location: string | null };
  _count?: { orders: number };
  cashMovements?: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string | null;
    performedBy: string;
    performedAt: string;
  }>;
}

export interface ApiPosSettings {
  id: string;
  companyId: string;
  orderPrefix: string;
  nextOrderNumber: number;
  gctRate: number;
  gctRegistrationNumber: string | null;
  taxIncludedInPrice: boolean;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessTRN: string | null;
  businessLogo: string | null;
  receiptFooter: string | null;
  showLogo: boolean;
  requireOpenSession: boolean;
  allowOfflineSales: boolean;
  autoDeductInventory: boolean;
  autoPostToGL: boolean;
  defaultToWalkIn: boolean;
  enabledPaymentMethods: string[];
  lynkMerchantId: string | null;
  wipayMerchantId: string | null;
  wipayApiKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Helpers: case conversion between API (UPPERCASE) and frontend (lowercase) ----

export function apiStatusToFrontend(status: string): string {
  return status.toLowerCase();
}

export function frontendStatusToApi(status: string): string {
  return status.toUpperCase();
}

export function apiMethodToFrontend(method: string): PaymentMethodType {
  return method.toLowerCase() as PaymentMethodType;
}

export function frontendMethodToApi(method: string): string {
  return method.toUpperCase();
}

// ---- Settings ----

export function usePosSettings() {
  return useQuery({
    queryKey: ['pos-settings'],
    queryFn: () => api.get<ApiPosSettings>('/api/v1/pos/settings'),
  });
}

export function useUpdatePosSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<ApiPosSettings>('/api/v1/pos/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-settings'] });
    },
  });
}

// ---- Terminals ----

export function usePosTerminals(params?: { isActive?: boolean; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['pos-terminals', params],
    queryFn: () =>
      api.get<PaginatedResponse<ApiPosTerminal>>(
        `/api/v1/pos/terminals${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useCreatePosTerminal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<ApiPosTerminal>('/api/v1/pos/terminals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-terminals'] });
    },
  });
}

// ---- Sessions ----

export function usePosSessions(params?: { status?: string; terminalId?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.terminalId) searchParams.set('terminalId', params.terminalId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['pos-sessions', params],
    queryFn: () =>
      api.get<PaginatedResponse<ApiPosSession>>(
        `/api/v1/pos/sessions${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useCreatePosSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { terminalId: string; cashierName: string; openingCash: number }) =>
      api.post<ApiPosSession>('/api/v1/pos/sessions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
      qc.invalidateQueries({ queryKey: ['pos-terminals'] });
    },
  });
}

export function useClosePosSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; closingCash: number; closingNotes?: string }) =>
      api.post<ApiPosSession>(`/api/v1/pos/sessions/${id}/close`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
      qc.invalidateQueries({ queryKey: ['pos-terminals'] });
    },
  });
}

// ---- Orders ----

export function usePosOrders(params?: {
  status?: string;
  sessionId?: string;
  limit?: number;
  cursor?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.sessionId) searchParams.set('sessionId', params.sessionId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['pos-orders', params],
    queryFn: () =>
      api.get<PaginatedResponse<ApiPosOrder>>(
        `/api/v1/pos/orders${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useCreatePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<ApiPosOrder>('/api/v1/pos/orders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
    },
  });
}

export function useAddPosPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      ...data
    }: {
      orderId: string;
      method: string;
      amount: number;
      amountTendered?: number;
      reference?: string;
      status?: string;
    }) => api.post<{ payment: ApiPosPayment; order: ApiPosOrder }>(
      `/api/v1/pos/orders/${orderId}/payments`,
      data
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
    },
  });
}

export function useHoldPosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, heldReason }: { id: string; heldReason: string }) =>
      api.post<ApiPosOrder>(`/api/v1/pos/orders/${id}/hold`, { heldReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
    },
  });
}

export function useVoidPosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, voidReason }: { id: string; voidReason: string }) =>
      api.post<ApiPosOrder>(`/api/v1/pos/orders/${id}/void`, { voidReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-orders'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
    },
  });
}

// ---- Business Days ----

export interface ApiBusinessDay {
  id: string;
  date: string;
  status: string;
  scheduledOpen: string | null;
  scheduledClose: string | null;
  actualOpenTime: string | null;
  actualCloseTime: string | null;
  openedBy: string | null;
  closedBy: string | null;
  openingNotes: string | null;
  closingNotes: string | null;
  activeSessionCount: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  totalTransactions: number;
  totalCashExpected: number;
  totalCashActual: number;
  totalCashVariance: number;
  hasVariance: boolean;
  varianceApproved: boolean;
  createdAt: string;
  updatedAt: string;
  sessions?: Array<{
    id: string;
    terminalName: string;
    cashierName: string;
    status: string;
    totalSales: number;
    netSales: number;
    openedAt: string;
    closedAt: string | null;
  }>;
  eodReport?: ApiEndOfDayReport | null;
  _count?: { sessions: number };
}

export interface ApiEndOfDayReport {
  id: string;
  reportNumber: string;
  date: string;
  businessDayId: string;
  openTime: string | null;
  closeTime: string | null;
  grossSales: number;
  totalDiscounts: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  totalTransactions: number;
  gctRate: number;
  taxableAmount: number;
  exemptAmount: number;
  gctCollected: number;
  totalOpeningCash: number;
  totalCashSales: number;
  totalCashRefunds: number;
  totalPayouts: number;
  totalDrops: number;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  cashStatus: string;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  sessionCount: number;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export function useBusinessDays(params?: { status?: string; date?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.date) searchParams.set('date', params.date);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['business-days', params],
    queryFn: () =>
      api.get<PaginatedResponse<ApiBusinessDay>>(
        `/api/v1/pos/business-days${qs ? `?${qs}` : ''}`
      ),
  });
}

export function useBusinessDay(id: string | null) {
  return useQuery({
    queryKey: ['business-day', id],
    queryFn: () => api.get<ApiBusinessDay>(`/api/v1/pos/business-days/${id}`),
    enabled: !!id,
  });
}

export function useOpenBusinessDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; scheduledOpen?: string; scheduledClose?: string; openingNotes?: string }) =>
      api.post<ApiBusinessDay>('/api/v1/pos/business-days', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-days'] });
    },
  });
}

export function useCloseBusinessDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; closingNotes?: string; forceClose?: boolean }) =>
      api.post<{ day: ApiBusinessDay; eodReport: ApiEndOfDayReport | null }>(
        `/api/v1/pos/business-days/${id}/close`,
        data
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-days'] });
      qc.invalidateQueries({ queryKey: ['business-day'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
    },
  });
}

// ---- Cash Movements ----

export interface ApiCashMovement {
  id: string;
  sessionId: string;
  type: string;
  amount: number;
  orderId: string | null;
  reason: string | null;
  performedBy: string;
  performedAt: string;
}

export function useCashMovements(sessionId: string | null) {
  return useQuery({
    queryKey: ['cash-movements', sessionId],
    queryFn: () =>
      api.get<{ data: ApiCashMovement[] }>(
        `/api/v1/pos/sessions/${sessionId}/cash-movement`
      ),
    enabled: !!sessionId,
  });
}

export function useAddCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      ...data
    }: {
      sessionId: string;
      type: 'PAYOUT' | 'DROP' | 'ADJUSTMENT';
      amount: number;
      reason: string;
    }) =>
      api.post<ApiCashMovement>(
        `/api/v1/pos/sessions/${sessionId}/cash-movement`,
        data
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['cash-movements', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
    },
  });
}

// ---- Reports ----

export interface DailySalesHour {
  hour: number;
  label: string;
  orderCount: number;
  total: number;
}

export interface DailySalesProduct {
  rank: number;
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DailySalesPayment {
  method: string;
  methodLabel: string;
  count: number;
  total: number;
}

export interface DailySalesSummary {
  date: string;
  orderCount: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  gctCollected: number;
  avgTransaction: number;
}

export interface DailySalesReport {
  salesByHour: DailySalesHour[];
  topProductsByQty: DailySalesProduct[];
  topProductsByRev: DailySalesProduct[];
  paymentBreakdown: DailySalesPayment[];
  summary: DailySalesSummary;
}

export function useDailySalesReport(date: string | null) {
  const searchParams = new URLSearchParams();
  if (date) searchParams.set('date', date);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['pos-report-daily-sales', date],
    queryFn: () =>
      api.get<DailySalesReport>(
        `/api/v1/pos/reports/daily-sales${qs ? `?${qs}` : ''}`
      ),
    enabled: !!date,
  });
}

export interface ProductPerformanceItem {
  productId: string | null;
  name: string;
  quantitySold: number;
  revenue: number;
  revenueBeforeTax: number;
  totalCost: number;
  profitMargin: number | null;
}

export interface LowStockAlert {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  unitPrice: number;
  category: string | null;
  deficit: number;
}

export interface ProductPerformanceReport {
  dateRange: { from: string; to: string };
  products: ProductPerformanceItem[];
  lowStockAlerts: LowStockAlert[];
}

export function useProductPerformanceReport(params: { from: string; to: string } | null) {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['pos-report-product-performance', params],
    queryFn: () =>
      api.get<ProductPerformanceReport>(
        `/api/v1/pos/reports/product-performance${qs ? `?${qs}` : ''}`
      ),
    enabled: !!params,
  });
}
