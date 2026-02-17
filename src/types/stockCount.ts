// YardBooks Web - Stock Count Type Definitions

export interface StockCount {
  id: string;
  companyId: string;
  countNumber: string;
  name: string;
  type: StockCountType;
  status: StockCountStatus;
  warehouseId?: string;
  warehouseName?: string;
  categoryIds?: string[];
  scheduledDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  countedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  items: StockCountItem[];
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number;
  totalVarianceValue: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StockCountType =
  | 'full'           // Full inventory count
  | 'cycle'          // Cycle count (subset)
  | 'spot'           // Spot check
  | 'annual';        // Year-end count

export type StockCountStatus =
  | 'draft'          // Created but not started
  | 'in_progress'    // Counting in progress
  | 'pending_review' // Counting complete, awaiting review
  | 'approved'       // Approved, ready to post
  | 'posted'         // Posted to inventory
  | 'cancelled';     // Cancelled

export interface StockCountItem {
  id: string;
  stockCountId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  uomCode: string;
  expectedQuantity: number;
  countedQuantity?: number;
  variance?: number;
  varianceValue?: number;
  varianceReason?: string;
  countedAt?: Date;
  countedBy?: string;
  location?: string;
  notes?: string;
}

export interface StockCountVariance {
  productId: string;
  productName: string;
  sku: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  variancePercent: number;
  varianceValue: number;
  unitCost: number;
  reason?: string;
}

export interface StockCountReport {
  stockCountId: string;
  countNumber: string;
  countName: string;
  countDate: Date;
  warehouseName?: string;
  totalItems: number;
  itemsCounted: number;
  itemsMatched: number;
  itemsOverage: number;
  itemsShortage: number;
  totalOverageValue: number;
  totalShortageValue: number;
  netVarianceValue: number;
  accuracyRate: number;
  items: StockCountVariance[];
  generatedAt: Date;
}
