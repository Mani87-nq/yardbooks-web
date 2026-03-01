// YaadBooks Web - Notification Types
// These match the Prisma enums (UPPERCASE)

export type NotificationType =
  | 'INVOICE_DUE'
  | 'INVOICE_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'LOW_STOCK'
  | 'PAYROLL_DUE'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'PO_RECEIVED'
  | 'BANK_SYNC'
  | 'TAX_DEADLINE'
  | 'SECURITY_ALERT'
  | 'SYSTEM'
  | 'REMINDER';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  companyId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  link?: string;
  actionUrl?: string;
  actionLabel?: string;
  relatedId?: string;
  relatedType?: 'invoice' | 'expense' | 'customer' | 'product' | 'employee' | 'po';
  createdAt: string;
  readAt?: string | null;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  INVOICE_DUE: 'Invoice Due',
  INVOICE_OVERDUE: 'Invoice Overdue',
  PAYMENT_RECEIVED: 'Payment Received',
  LOW_STOCK: 'Low Stock Alert',
  PAYROLL_DUE: 'Payroll Due',
  EXPENSE_APPROVED: 'Expense Approved',
  EXPENSE_REJECTED: 'Expense Rejected',
  PO_RECEIVED: 'PO Received',
  BANK_SYNC: 'Bank Sync',
  TAX_DEADLINE: 'Tax Deadline',
  SECURITY_ALERT: 'Security Alert',
  SYSTEM: 'System',
  REMINDER: 'Reminder',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  INVOICE_DUE: 'DocumentTextIcon',
  INVOICE_OVERDUE: 'ExclamationTriangleIcon',
  PAYMENT_RECEIVED: 'BanknotesIcon',
  LOW_STOCK: 'CubeIcon',
  PAYROLL_DUE: 'UserGroupIcon',
  EXPENSE_APPROVED: 'CheckCircleIcon',
  EXPENSE_REJECTED: 'XCircleIcon',
  PO_RECEIVED: 'ClipboardDocumentListIcon',
  BANK_SYNC: 'BuildingLibraryIcon',
  TAX_DEADLINE: 'CalendarIcon',
  SECURITY_ALERT: 'ShieldExclamationIcon',
  SYSTEM: 'CogIcon',
  REMINDER: 'BellIcon',
};

export const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  LOW: '#9E9E9E',
  MEDIUM: '#2196F3',
  HIGH: '#FF9800',
  URGENT: '#F44336',
};
