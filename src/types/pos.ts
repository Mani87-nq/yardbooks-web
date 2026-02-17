// YardBook Web - Point of Sale Type Definitions
// Jamaica-first POS system with JAM-DEX, GCT compliance

// ============================================
// PAYMENT TYPES
// ============================================

export type PaymentMethodType =
  | 'cash'
  | 'jam_dex'
  | 'lynk_wallet'
  | 'wipay'
  | 'card_visa'
  | 'card_mastercard'
  | 'card_other'
  | 'bank_transfer'
  | 'store_credit'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partial_refund';

export interface PosPayment {
  id: string;
  orderId: string;
  method: PaymentMethodType;
  amount: number;
  currency: 'JMD';
  reference?: string;
  providerName?: string;
  authorizationCode?: string;
  status: PaymentStatus;
  statusMessage?: string;
  processedAt?: Date;
  amountTendered?: number;
  changeGiven?: number;
  qrCodeData?: string;
  pollUrl?: string;
  expiresAt?: Date;
  processorResponse?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ORDER TYPES
// ============================================

export type PosOrderStatus =
  | 'draft'
  | 'held'
  | 'pending_payment'
  | 'partially_paid'
  | 'completed'
  | 'voided'
  | 'refunded';

export interface PosOrderItem {
  id: string;
  lineNumber: number;
  productId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  quantity: number;
  uomId?: string;
  uomCode: string;
  uomName?: string;
  unitPrice: number;
  lineSubtotal: number;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  discountAmount: number;
  lineTotalBeforeTax: number;
  isGctExempt: boolean;
  gctRate: number;
  gctAmount: number;
  lineTotal: number;
  inventoryDeducted: boolean;
  warehouseId?: string;
  notes?: string;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  sessionId?: string;
  terminalId?: string;
  terminalName?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: PosOrderItem[];
  itemCount: number;
  subtotal: number;
  orderDiscountType?: 'percent' | 'amount';
  orderDiscountValue?: number;
  orderDiscountAmount: number;
  orderDiscountReason?: string;
  taxableAmount: number;
  exemptAmount: number;
  gctRate: number;
  gctAmount: number;
  total: number;
  payments: PosPayment[];
  amountPaid: number;
  amountDue: number;
  changeGiven: number;
  status: PosOrderStatus;
  heldReason?: string;
  voidReason?: string;
  refundReason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  parkingSlipId?: string;
  glTransactionId?: string;
  customerPOId?: string;
  customerPONumber?: string;
  receiptPrinted: boolean;
  receiptEmail?: string;
  receiptSms?: string;
  isOfflineOrder: boolean;
  syncedAt?: Date;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdBy: string;
  notes?: string;
}

// ============================================
// SESSION TYPES
// ============================================

export type CashMovementType =
  | 'opening_float'
  | 'sale'
  | 'refund'
  | 'payout'
  | 'drop'
  | 'adjustment'
  | 'closing_count';

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: number;
  orderId?: string;
  reason?: string;
  performedBy: string;
  performedAt: Date;
}

export type PosSessionStatus = 'open' | 'suspended' | 'closed';

export interface PosSession {
  id: string;
  terminalId: string;
  terminalName: string;
  cashierName: string;
  cashierId?: string;
  openedAt: Date;
  closedAt?: Date;
  openingCash: number;
  cashMovements: CashMovement[];
  expectedCash: number;
  closingCash?: number;
  cashVariance?: number;
  orderIds: string[];
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  paymentBreakdown: {
    method: PaymentMethodType;
    count: number;
    total: number;
  }[];
  status: PosSessionStatus;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// TERMINAL TYPES
// ============================================

export interface PrinterConfig {
  type: 'bluetooth' | 'usb' | 'network' | 'none';
  name?: string;
  address?: string;
  paperWidth: 58 | 80;
}

export interface CashDrawerConfig {
  type: 'printer_trigger' | 'usb' | 'none';
  openOnPayment: boolean;
  requireClose: boolean;
}

export interface PosTerminal {
  id: string;
  name: string;
  description?: string;
  location?: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeen?: Date;
  defaultWarehouseId?: string;
  defaultPaymentMethods: PaymentMethodType[];
  allowNegativeInventory: boolean;
  requireCustomer: boolean;
  allowDiscounts: boolean;
  maxDiscountPercent: number;
  receiptPrinter?: PrinterConfig;
  cashDrawer?: CashDrawerConfig;
  barcodeScanner: boolean;
  currentSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface PosGLMapping {
  cashOnHand: string;
  bankAccount: string;
  accountsReceivable: string;
  gctPayable: string;
  salesRevenue: string;
  salesDiscounts: string;
  costOfGoodsSold?: string;
  inventory?: string;
}

export interface PosSettings {
  orderPrefix: string;
  nextOrderNumber: number;
  gctRate: number;
  gctRegistrationNumber?: string;
  taxIncludedInPrice: boolean;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessTRN?: string;
  businessLogo?: string;
  receiptFooter?: string;
  showLogo: boolean;
  requireOpenSession: boolean;
  allowOfflineSales: boolean;
  autoDeductInventory: boolean;
  autoPostToGL: boolean;
  defaultToWalkIn: boolean;
  enabledPaymentMethods?: PaymentMethodType[];
  glMapping?: PosGLMapping;
  lynkMerchantId?: string;
  wipayMerchantId?: string;
  wipayApiKey?: string;
  updatedAt: Date;
}

// ============================================
// REPORT TYPES
// ============================================

export interface ZReport {
  id: string;
  reportNumber: string;
  date: Date;
  terminalId: string;
  terminalName: string;
  periodStart: Date;
  periodEnd: Date;
  totalTransactions: number;
  completedTransactions: number;
  voidedTransactions: number;
  refundedTransactions: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxableAmount: number;
  exemptAmount: number;
  gctCollected: number;
  paymentBreakdown: {
    method: PaymentMethodType;
    methodLabel: string;
    transactionCount: number;
    total: number;
  }[];
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashPayouts: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  categoryBreakdown?: {
    categoryId: string;
    categoryName: string;
    itemCount: number;
    total: number;
  }[];
  generatedAt: Date;
  generatedBy: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface CartItem {
  tempId: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  uomCode: string;
  unitPrice: number;
  isGctExempt: boolean;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  notes?: string;
}

export interface PosCart {
  items: CartItem[];
  customerId?: string;
  customerName: string;
  orderDiscountType?: 'percent' | 'amount';
  orderDiscountValue?: number;
  orderDiscountReason?: string;
  notes?: string;
}

// ============================================
// ACTION TYPES
// ============================================

export interface CreateOrderData {
  cart: PosCart;
  sessionId?: string;
  terminalId?: string;
}

export interface AddPaymentData {
  orderId: string;
  method: PaymentMethodType;
  amount: number;
  amountTendered?: number;
  reference?: string;
}

export interface OpenSessionData {
  terminalId: string;
  cashierName: string;
  cashierId?: string;
  openingCash: number;
}

export interface CloseSessionData {
  sessionId: string;
  closingCash: number;
  closingNotes?: string;
}
