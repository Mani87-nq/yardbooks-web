// YardBooks Web - Customer Purchase Order Types

import type { Address } from './index';

export type CustomerPOStatus =
  | 'draft'
  | 'open'
  | 'partially_invoiced'
  | 'fully_invoiced'
  | 'closed'
  | 'cancelled';

export interface CustomerPOItem {
  id: string;
  customerPOId: string;
  productId?: string;
  description: string;
  orderedQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  fulfilledQuantity?: number;
  uomId?: string;
  uomShortCode: string;
  agreedUnitPrice?: number;
  notes?: string;
  lineNumber: number;
}

export interface CustomerPOCustomerSnapshot {
  id: string;
  name: string;
  companyName?: string;
  address?: Address;
  phone?: string;
  email?: string;
}

export interface CustomerPurchaseOrder {
  id: string;
  companyId: string;
  customerId: string;
  customer?: CustomerPOCustomerSnapshot;
  poNumber: string;
  internalReference?: string;
  status: CustomerPOStatus;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  customerReference?: string;
  shippingAddress?: Address;
  items: CustomerPOItem[];
  totalOrderedQuantity: number;
  totalInvoicedQuantity: number;
  totalRemainingQuantity: number;
  notes?: string;
  internalNotes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CUSTOMER_PO_STATUS_LABELS: Record<CustomerPOStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  partially_invoiced: 'Partially Invoiced',
  fully_invoiced: 'Fully Invoiced',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const CUSTOMER_PO_STATUS_COLORS: Record<CustomerPOStatus, string> = {
  draft: '#9E9E9E',
  open: '#2196F3',
  partially_invoiced: '#FF9800',
  fully_invoiced: '#4CAF50',
  closed: '#607D8B',
  cancelled: '#F44336',
};

export function calculatePOProgress(totalOrdered: number, totalInvoiced: number): number {
  if (totalOrdered === 0) return 0;
  return Math.min(100, Math.round((totalInvoiced / totalOrdered) * 100));
}

export function canCreateInvoiceFromPO(status: CustomerPOStatus): boolean {
  return status === 'open' || status === 'partially_invoiced';
}

export function canEditPO(status: CustomerPOStatus): boolean {
  return status === 'draft';
}

export function canCancelPO(status: CustomerPOStatus): boolean {
  return status !== 'cancelled' && status !== 'closed' && status !== 'fully_invoiced';
}
