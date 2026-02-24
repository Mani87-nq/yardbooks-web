// Day Management & Store Hours Type Definitions
// Handles store open/close times, day operations, and end-of-day reporting

// ============================================
// STORE HOURS TYPES
// ============================================

export interface DaySchedule {
  open: string;    // Time in 24hr format "HH:MM" e.g., "08:00"
  close: string;   // Time in 24hr format "HH:MM" e.g., "18:00"
  isClosed: boolean;
}

export interface StoreHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface SpecialHours {
  id: string;
  date: string;        // ISO date string "YYYY-MM-DD"
  open: string;
  close: string;
  isClosed: boolean;
  reason?: string;     // e.g., "Public Holiday - Heroes Day", "Early Close - Staff Meeting"
  createdAt: Date;
}

// ============================================
// DAY STATUS TYPES
// ============================================

export type DayStatus =
  | 'scheduled'      // Not yet opened
  | 'open'           // Business is open
  | 'closing_soon'   // Within 30 mins of closing
  | 'closed'         // Day has ended
  | 'force_closed';  // Closed early by manager

export interface BusinessDay {
  id: string;
  date: string;                    // ISO date string "YYYY-MM-DD"
  status: DayStatus;
  scheduledOpen: string;           // What time was supposed to open
  scheduledClose: string;          // What time was supposed to close
  actualOpenTime?: Date;           // When actually opened
  actualCloseTime?: Date;          // When actually closed
  openedBy?: string;               // User who opened
  closedBy?: string;               // User who closed

  // Session tracking
  sessionIds: string[];            // All POS sessions for this day
  activeSessionCount: number;      // Currently active sessions

  // Daily totals (aggregated from all sessions)
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  totalTransactions: number;
  totalCustomersServed: number;

  // Cash tracking
  totalCashOpening: number;        // Sum of all opening cash
  totalCashExpected: number;       // Sum of all expected cash
  totalCashActual: number;         // Sum of all counted cash
  totalCashVariance: number;       // Overall variance

  // Payment breakdown
  paymentSummary: {
    method: string;
    methodLabel: string;
    transactionCount: number;
    total: number;
  }[];

  // Tax summary
  totalTaxable: number;
  totalExempt: number;
  totalGctCollected: number;

  // Notes and issues
  openingNotes?: string;
  closingNotes?: string;
  issues?: DayIssue[];

  // Flags
  hasVariance: boolean;
  varianceApproved: boolean;
  varianceApprovedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface DayIssue {
  id: string;
  type: 'variance' | 'void' | 'refund' | 'override' | 'system' | 'other';
  severity: 'low' | 'medium' | 'high';
  description: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
}

// ============================================
// END OF DAY REPORT TYPES
// ============================================

export interface EndOfDayReport {
  id: string;
  reportNumber: string;            // e.g., "EOD-2024-01-15"
  date: string;                    // ISO date string
  businessDayId: string;

  // Store info
  storeName: string;
  storeLocation?: string;

  // Time summary
  scheduledOpenTime: string;
  scheduledCloseTime: string;
  actualOpenTime?: Date;
  actualCloseTime?: Date;
  totalOperatingHours: number;     // In minutes

  // Staff summary
  staffOnDuty: {
    userId: string;
    name: string;
    role: string;
    hoursWorked: number;
    sessionCount: number;
    salesTotal: number;
    transactionCount: number;
    avgTransactionValue: number;
    cashVariance: number;
  }[];

  // Sales summary
  grossSales: number;
  discountsGiven: number;
  refundsIssued: number;
  voidsProcessed: number;
  netSales: number;

  // Transaction summary
  totalTransactions: number;
  completedTransactions: number;
  voidedTransactions: number;
  refundedTransactions: number;
  avgTransactionValue: number;
  peakHour: string;                // e.g., "14:00-15:00"
  peakHourTransactions: number;

  // Payment summary
  paymentBreakdown: {
    method: string;
    methodLabel: string;
    transactionCount: number;
    total: number;
    percentage: number;
  }[];

  // Cash reconciliation
  cashReconciliation: {
    openingFloat: number;
    cashSales: number;
    cashRefunds: number;
    cashPayouts: number;
    cashDrops: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
    variancePercentage: number;
    status: 'balanced' | 'over' | 'short';
  };

  // Tax summary (Jamaica GCT)
  taxSummary: {
    taxableAmount: number;
    exemptAmount: number;
    gctRate: number;
    gctCollected: number;
    gctOwed: number;               // For accounting
  };

  // Inventory impact (optional)
  inventorySummary?: {
    itemsSold: number;
    uniqueProductsSold: number;
    topSellingProducts: {
      productId: string;
      name: string;
      quantitySold: number;
      revenue: number;
    }[];
    lowStockAlerts: number;
    outOfStockItems: number;
  };

  // Session details
  sessions: {
    sessionId: string;
    terminalName: string;
    cashierName: string;
    openedAt: Date;
    closedAt?: Date;
    netSales: number;
    transactionCount: number;
    cashVariance: number;
    zReportId?: string;
  }[];

  // Issues and notes
  varianceExplanation?: string;
  managerNotes?: string;

  // Approval
  preparedBy: string;
  preparedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;

  // Email tracking
  emailSentTo?: string[];
  emailSentAt?: Date;

  generatedAt: Date;
}

// ============================================
// EMAIL NOTIFICATION TYPES
// ============================================

export interface EmailRecipient {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'manager' | 'accountant' | 'custom';
  notifyOn: {
    dayOpen: boolean;
    dayClose: boolean;
    eodReport: boolean;
    varianceAlert: boolean;
    lowStockAlert: boolean;
  };
  isActive: boolean;
}

export interface NotificationSettings {
  enableEmailNotifications: boolean;
  recipients: EmailRecipient[];

  // Timing
  sendEodReportAt: 'on_close' | 'scheduled';
  scheduledReportTime?: string;   // If scheduled, e.g., "22:00"

  // Content preferences
  includeDetailedBreakdown: boolean;
  includeStaffPerformance: boolean;
  includeInventorySummary: boolean;
  includeComparisonToPreviousDay: boolean;

  // Alert thresholds
  varianceAlertThreshold: number;  // e.g., 500 (JMD)
  lowSalesAlertThreshold: number;  // e.g., 50000 (JMD) - if below, send alert
}

// ============================================
// STORE SETTINGS EXTENSION
// ============================================

export interface DayManagementSettings {
  // Store hours
  storeHours: StoreHours;
  specialHours: SpecialHours[];
  timeZone: string;                // e.g., "America/Jamaica"

  // Day management behavior
  requireManagerToOpenDay: boolean;
  requireManagerToCloseDay: boolean;
  autoCloseSessionsOnDayClose: boolean;
  forceCloseAtScheduledTime: boolean;

  // Notifications
  notifications: NotificationSettings;

  // Reminders
  openingReminderMinutes: number;   // e.g., 15 mins before scheduled open
  closingReminderMinutes: number;   // e.g., 30 mins before scheduled close

  // Variance handling
  allowCloseWithVariance: boolean;
  varianceApprovalRequired: number; // Amount above which approval required

  // Report settings
  autoGenerateEodReport: boolean;
  keepReportsForDays: number;       // Data retention

  updatedAt: Date;
}

// ============================================
// ACTION TYPES
// ============================================

export interface OpenDayData {
  date: string;
  openedBy: string;
  openingNotes?: string;
  overrideScheduledTime?: boolean;
}

export interface CloseDayData {
  date: string;
  closedBy: string;
  closingNotes?: string;
  varianceExplanation?: string;
  forceClose?: boolean;            // Close even with active sessions
}

export interface ApproveVarianceData {
  businessDayId: string;
  approvedBy: string;
  explanation: string;
}

// ============================================
// HELPER TYPES
// ============================================

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

export function isStoreOpen(
  storeHours: StoreHours,
  specialHours: SpecialHours[],
  date: Date = new Date()
): { isOpen: boolean; opensAt?: string; closesAt?: string; reason?: string } {
  const dateStr = date.toISOString().split('T')[0];
  const currentTime = date.toTimeString().slice(0, 5); // "HH:MM"

  // Check special hours first
  const special = specialHours.find(s => s.date === dateStr);
  if (special) {
    if (special.isClosed) {
      return { isOpen: false, reason: special.reason || 'Closed for special occasion' };
    }
    const isOpen = currentTime >= special.open && currentTime < special.close;
    return { isOpen, opensAt: special.open, closesAt: special.close, reason: special.reason };
  }

  // Check regular hours
  const dayOfWeek = getDayOfWeek(date);
  const schedule = storeHours[dayOfWeek];

  if (schedule.isClosed) {
    return { isOpen: false, reason: `Closed on ${dayOfWeek}s` };
  }

  const isOpen = currentTime >= schedule.open && currentTime < schedule.close;
  return { isOpen, opensAt: schedule.open, closesAt: schedule.close };
}

export function getNextOpenTime(
  storeHours: StoreHours,
  specialHours: SpecialHours[],
  fromDate: Date = new Date()
): { date: Date; opensAt: string } | null {
  const daysToCheck = 7;
  const date = new Date(fromDate);

  for (let i = 0; i < daysToCheck; i++) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = getDayOfWeek(date);

    // Check special hours
    const special = specialHours.find(s => s.date === dateStr);
    if (special && !special.isClosed) {
      return { date: new Date(date), opensAt: special.open };
    }

    // Check regular hours
    const schedule = storeHours[dayOfWeek];
    if (!schedule.isClosed) {
      return { date: new Date(date), opensAt: schedule.open };
    }

    date.setDate(date.getDate() + 1);
  }

  return null;
}

// Default store hours (typical Jamaica hardware store)
export const DEFAULT_STORE_HOURS: StoreHours = {
  monday: { open: '08:00', close: '18:00', isClosed: false },
  tuesday: { open: '08:00', close: '18:00', isClosed: false },
  wednesday: { open: '08:00', close: '18:00', isClosed: false },
  thursday: { open: '08:00', close: '18:00', isClosed: false },
  friday: { open: '08:00', close: '18:00', isClosed: false },
  saturday: { open: '08:00', close: '16:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableEmailNotifications: true,
  recipients: [],
  sendEodReportAt: 'on_close',
  includeDetailedBreakdown: true,
  includeStaffPerformance: true,
  includeInventorySummary: false,
  includeComparisonToPreviousDay: true,
  varianceAlertThreshold: 500,
  lowSalesAlertThreshold: 50000,
};

export const DEFAULT_DAY_MANAGEMENT_SETTINGS: DayManagementSettings = {
  storeHours: DEFAULT_STORE_HOURS,
  specialHours: [],
  timeZone: 'America/Jamaica',
  requireManagerToOpenDay: false,
  requireManagerToCloseDay: false,
  autoCloseSessionsOnDayClose: false,
  forceCloseAtScheduledTime: false,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  openingReminderMinutes: 15,
  closingReminderMinutes: 30,
  allowCloseWithVariance: true,
  varianceApprovalRequired: 1000,
  autoGenerateEodReport: true,
  keepReportsForDays: 365,
  updatedAt: new Date(),
};
