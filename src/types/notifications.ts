// YaadBooks Web - Notification Types

export type NotificationType =
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_received'
  | 'low_stock'
  | 'payroll_due'
  | 'expense_approved'
  | 'expense_rejected'
  | 'po_received'
  | 'bank_sync'
  | 'system'
  | 'reminder';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  companyId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  actionUrl?: string;
  actionLabel?: string;
  relatedId?: string;
  relatedType?: 'invoice' | 'expense' | 'customer' | 'product' | 'employee' | 'po';
  createdAt: Date;
  readAt?: Date;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  invoice_due: 'Invoice Due',
  invoice_overdue: 'Invoice Overdue',
  payment_received: 'Payment Received',
  low_stock: 'Low Stock Alert',
  payroll_due: 'Payroll Due',
  expense_approved: 'Expense Approved',
  expense_rejected: 'Expense Rejected',
  po_received: 'PO Received',
  bank_sync: 'Bank Sync',
  system: 'System',
  reminder: 'Reminder',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  invoice_due: 'DocumentTextIcon',
  invoice_overdue: 'ExclamationTriangleIcon',
  payment_received: 'BanknotesIcon',
  low_stock: 'CubeIcon',
  payroll_due: 'UserGroupIcon',
  expense_approved: 'CheckCircleIcon',
  expense_rejected: 'XCircleIcon',
  po_received: 'ClipboardDocumentListIcon',
  bank_sync: 'BuildingLibraryIcon',
  system: 'CogIcon',
  reminder: 'BellIcon',
};

export const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: '#9E9E9E',
  medium: '#2196F3',
  high: '#FF9800',
  urgent: '#F44336',
};
