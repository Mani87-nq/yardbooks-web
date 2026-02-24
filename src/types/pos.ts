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
  | 'partially_refunded' // Some items returned, others still kept
  | 'refunded'; // Fully refunded

export interface PosOrderItem {
  id: string;
  lineNumber: number;
  productId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  quantity: number;
  quantityReturned: number; // Track how many have been returned
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

// ============================================
// RETURN/REFUND TYPES
// ============================================

export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export interface ReturnLineItem {
  id: string;
  originalItemId: string; // Reference to the PosOrderItem.id
  productId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  quantityReturned: number;
  unitPrice: number;
  refundAmount: number;
  restockToInventory: boolean;
  condition: 'resellable' | 'damaged' | 'defective';
}

export interface ReturnTransaction {
  id: string;
  returnNumber: string; // e.g., "RTN-2024-001"
  originalOrderId: string;
  originalOrderNumber: string;
  originalInvoiceNumber?: string;
  originalCustomerPONumber?: string;
  customerId?: string;
  customerName: string;
  items: ReturnLineItem[];
  subtotal: number;
  gctAmount: number;
  totalRefund: number;
  refundMethod: PaymentMethodType;
  reason: string;
  reasonCategory: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other';
  notes?: string;
  status: ReturnStatus;
  processedBy: string;
  approvedBy?: string;
  createdAt: Date;
  completedAt?: Date;
  // For receipt printing
  receiptPrinted: boolean;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  sessionId?: string;
  terminalId?: string;
  terminalName?: string;
  cashierName?: string;
  cashierEmployeeNumber?: string;
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

// Alternative naming (CashierSession) - same as PosSession
export interface CashierSession {
  id: string;
  userId: string; // cashierId
  startTime: Date; // openedAt
  endTime?: Date; // closedAt
  openingBalance: number; // openingCash
  closingBalance?: number; // closingCash
  expectedBalance?: number; // expectedCash
  variance?: number; // cashVariance
  status: 'active' | 'closed'; // maps to PosSessionStatus
  transactions: string[]; // orderIds
}

export interface PosSession {
  id: string;
  terminalId: string;
  terminalName: string;
  cashierName: string;
  cashierId?: string;
  cashierEmployeeNumber?: string;
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

// ============================================
// GRID CUSTOMIZATION TYPES
// ============================================

export interface ProductShortcut {
  productId: string;
  position: number;
  color?: string;  // Hex color or preset name like 'red', 'blue'
  customLabel?: string;  // Optional override label
  icon?: string;  // Preset icon name or 'image' to use product image
  customImageUrl?: string;  // Custom image URL if icon is 'custom'
}

// Preset icons for shortcuts (emoji-based for simplicity)
export const SHORTCUT_ICON_PRESETS: { [key: string]: { emoji: string; label: string } } = {
  tools: { emoji: '🛠️', label: 'Tools' },
  hammer: { emoji: '🔨', label: 'Hammer' },
  wrench: { emoji: '🔧', label: 'Wrench' },
  screw: { emoji: '🪛', label: 'Screwdriver' },
  nail: { emoji: '📌', label: 'Nail/Pin' },
  paint: { emoji: '🎨', label: 'Paint' },
  bucket: { emoji: '🪣', label: 'Bucket' },
  lightbulb: { emoji: '💡', label: 'Electrical' },
  plug: { emoji: '🔌', label: 'Plug' },
  battery: { emoji: '🔋', label: 'Battery' },
  lock: { emoji: '🔒', label: 'Lock' },
  key: { emoji: '🔑', label: 'Key' },
  fire: { emoji: '🔥', label: 'Hot/Fire' },
  water: { emoji: '💧', label: 'Water/Plumbing' },
  wood: { emoji: '🪵', label: 'Wood/Lumber' },
  brick: { emoji: '🧱', label: 'Brick/Masonry' },
  home: { emoji: '🏠', label: 'Home' },
  garden: { emoji: '🌱', label: 'Garden' },
  tree: { emoji: '🌳', label: 'Tree/Outdoor' },
  star: { emoji: '⭐', label: 'Star/Featured' },
  cart: { emoji: '🛒', label: 'Cart' },
  box: { emoji: '📦', label: 'Box/Package' },
  tag: { emoji: '🏷️', label: 'Tag/Sale' },
  dollar: { emoji: '💰', label: 'Money/Value' },
  phone: { emoji: '📱', label: 'Phone/Mobile' },
  card: { emoji: '💳', label: 'Card/Credit' },
};

export interface PosGridSettings {
  // Density
  columnsDesktop: number;  // 4-12, default 6
  columnsMobile: number;   // 2-4, default 3
  tileSize: 'compact' | 'normal' | 'large';

  // Accessibility
  fontWeight: 'normal' | 'medium' | 'bold';
  fontSize: 'small' | 'normal' | 'large';
  showPrice: boolean;
  showStock: boolean;

  // Shortcut arrangement (pinned products)
  shortcuts: ProductShortcut[];
  showShortcutsFirst: boolean;  // Show shortcuts before browsable grid
}

// Default color presets for shortcuts
export const SHORTCUT_COLOR_PRESETS: { [key: string]: string } = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
  blue: '#3B82F6',
  purple: '#A855F7',
  pink: '#EC4899',
  gray: '#6B7280',
};

export const DEFAULT_GRID_SETTINGS: PosGridSettings = {
  columnsDesktop: 6,
  columnsMobile: 3,
  tileSize: 'normal',
  fontWeight: 'normal',
  fontSize: 'normal',
  showPrice: true,
  showStock: true,
  shortcuts: [],
  showShortcutsFirst: true,
};

// ============================================
// POS SETTINGS
// ============================================

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
  returnPolicy?: string;
  thankYouMessage?: string;
  receiptTermsAndConditions?: string;
  gridSettings?: PosGridSettings;
  updatedAt: Date;

  // ============================================
  // SUPERVISOR AUTHORIZATION SETTINGS
  // ============================================
  // These settings control when supervisor PIN approval is required
  requireSupervisorForReturns?: boolean;       // Require supervisor PIN to process returns
  requireSupervisorForVoids?: boolean;         // Require supervisor PIN to void orders
  requireSupervisorForDiscounts?: boolean;     // Require supervisor PIN for large discounts
  discountApprovalThreshold?: number;          // Discount % above which approval is needed (e.g., 20)
  returnApprovalThreshold?: number;            // Return amount above which approval is needed (JMD)
  voidApprovalThreshold?: number;              // Void amount above which approval is needed (JMD)
}

// ============================================
// SUPERVISOR APPROVAL TYPES
// ============================================
export interface SupervisorApproval {
  approved: boolean;
  supervisorId: string;
  supervisorName: string;
  supervisorEmployeeNumber?: string;
  approvedAt: Date;
  action: 'return' | 'void' | 'discount' | 'price_override';
  reason?: string;
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
  cashierEmployeeNumber?: string;
  openingCash: number;
}

export interface CloseSessionData {
  sessionId: string;
  closingCash: number;
  closingNotes?: string;
}
