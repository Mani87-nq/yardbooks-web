'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import {
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, formatPrintCurrency, downloadAsCSV } from '@/lib/print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VOID'
  | 'APPROVE'
  | 'SEND'
  | 'PAYMENT'
  | 'EXPORT';

type EntityType =
  | 'Invoice'
  | 'Customer'
  | 'Product'
  | 'Expense'
  | 'Journal Entry'
  | 'Quotation'
  | 'Bank Account'
  | 'Employee'
  | 'Payroll Run'
  | 'Fixed Asset';

interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  changes?: AuditChange[];
  ipAddress?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<AuditAction, { label: string; color: string; bgColor: string }> = {
  CREATE: { label: 'Create', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  UPDATE: { label: 'Update', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  DELETE: { label: 'Delete', color: 'text-red-700', bgColor: 'bg-red-100' },
  VOID: { label: 'Void', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  APPROVE: { label: 'Approve', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  SEND: { label: 'Send', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  PAYMENT: { label: 'Payment', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  EXPORT: { label: 'Export', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const ALL_ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'VOID',
  'APPROVE',
  'SEND',
  'PAYMENT',
  'EXPORT',
];

const ALL_ENTITY_TYPES: EntityType[] = [
  'Invoice',
  'Customer',
  'Product',
  'Expense',
  'Journal Entry',
  'Quotation',
  'Bank Account',
  'Employee',
  'Payroll Run',
  'Fixed Asset',
];

// ---------------------------------------------------------------------------
// Demo data generator
// ---------------------------------------------------------------------------

function generateDemoAuditEntries(): AuditEntry[] {
  const now = new Date();

  function daysAgo(d: number, hours = 0, minutes = 0): Date {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const entries: AuditEntry[] = [
    {
      id: 'audit-001',
      timestamp: daysAgo(0, 9, 15),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: 'inv-009',
      entityLabel: 'INV-009',
      description: 'Created Invoice INV-009 for Montego Bay Resort (J$125,000.00)',
      changes: [],
    },
    {
      id: 'audit-002',
      timestamp: daysAgo(0, 10, 30),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'SEND',
      entityType: 'Invoice',
      entityId: 'inv-009',
      entityLabel: 'INV-009',
      description: 'Sent Invoice INV-009 to purchasing@mbresort.com',
      changes: [
        { field: 'Status', oldValue: 'Draft', newValue: 'Sent' },
      ],
    },
    {
      id: 'audit-003',
      timestamp: daysAgo(1, 8, 45),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: 'cust-002',
      entityLabel: 'Caribbean Supplies Ltd',
      description: "Updated Customer 'Caribbean Supplies Ltd' - email changed",
      changes: [
        { field: 'Email', oldValue: 'info@caribbeansupplies.com', newValue: 'orders@caribbeansupplies.com' },
        { field: 'Phone', oldValue: '876-555-1002', newValue: '876-555-2002' },
      ],
    },
    {
      id: 'audit-004',
      timestamp: daysAgo(1, 14, 20),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'PAYMENT',
      entityType: 'Invoice',
      entityId: 'inv-003',
      entityLabel: 'INV-003',
      description: 'Recorded payment of J$45,000.00 for Invoice INV-003 from Sandra Williams',
      changes: [
        { field: 'Amount Paid', oldValue: 'J$0.00', newValue: 'J$45,000.00' },
        { field: 'Status', oldValue: 'Sent', newValue: 'Paid' },
      ],
    },
    {
      id: 'audit-005',
      timestamp: daysAgo(2, 11, 10),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'VOID',
      entityType: 'Expense',
      entityId: 'exp-005',
      entityLabel: 'EXP-005',
      description: 'Voided Expense EXP-005 - Duplicate entry for office supplies',
      changes: [
        { field: 'Status', oldValue: 'Active', newValue: 'Voided' },
      ],
    },
    {
      id: 'audit-006',
      timestamp: daysAgo(2, 15, 45),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'APPROVE',
      entityType: 'Journal Entry',
      entityId: 'je-003',
      entityLabel: 'JE-003',
      description: 'Approved Journal Entry JE-003 - Monthly depreciation for equipment',
      changes: [
        { field: 'Status', oldValue: 'Draft', newValue: 'Posted' },
      ],
    },
    {
      id: 'audit-007',
      timestamp: daysAgo(3, 9, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Customer',
      entityId: 'cust-009',
      entityLabel: 'Negril Beach Supplies',
      description: "Created new Customer 'Negril Beach Supplies' with TRN 666-777-888",
      changes: [],
    },
    {
      id: 'audit-008',
      timestamp: daysAgo(3, 13, 30),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'DELETE',
      entityType: 'Product',
      entityId: 'prod-015',
      entityLabel: 'Expired Stock',
      description: "Deleted Product 'Expired Stock' (SKU: EXP-STOCK-01) - Discontinued item",
      changes: [],
    },
    {
      id: 'audit-009',
      timestamp: daysAgo(4, 10, 15),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Expense',
      entityId: 'exp-012',
      entityLabel: 'EXP-012',
      description: 'Created Expense EXP-012 - Office rent payment J$85,000.00',
      changes: [],
    },
    {
      id: 'audit-010',
      timestamp: daysAgo(5, 8, 30),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'UPDATE',
      entityType: 'Product',
      entityId: 'prod-001',
      entityLabel: 'Rice 5kg',
      description: "Updated Product 'Rice 5kg' - price adjustment",
      changes: [
        { field: 'Unit Price', oldValue: 'J$1,200.00', newValue: 'J$1,350.00' },
        { field: 'Cost Price', oldValue: 'J$900.00', newValue: 'J$1,050.00' },
      ],
    },
    {
      id: 'audit-011',
      timestamp: daysAgo(6, 16, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'EXPORT',
      entityType: 'Invoice',
      entityId: 'inv-batch',
      entityLabel: 'Invoice Report',
      description: 'Exported Invoice Aging Report for Jan 2025 - Feb 2025',
      changes: [],
    },
    {
      id: 'audit-012',
      timestamp: daysAgo(7, 11, 45),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Journal Entry',
      entityId: 'je-008',
      entityLabel: 'JE-008',
      description: 'Created Journal Entry JE-008 - Accrued utility expenses J$22,500.00',
      changes: [],
    },
    {
      id: 'audit-013',
      timestamp: daysAgo(8, 9, 20),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Quotation',
      entityId: 'quot-004',
      entityLabel: 'QT-004',
      description: 'Created Quotation QT-004 for Ocho Rios Trading Co (J$210,000.00)',
      changes: [],
    },
    {
      id: 'audit-014',
      timestamp: daysAgo(10, 14, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'UPDATE',
      entityType: 'Invoice',
      entityId: 'inv-005',
      entityLabel: 'INV-005',
      description: 'Updated Invoice INV-005 - adjusted line items and discount',
      changes: [
        { field: 'Discount', oldValue: '0%', newValue: '5%' },
        { field: 'Total', oldValue: 'J$156,000.00', newValue: 'J$148,200.00' },
      ],
    },
    {
      id: 'audit-015',
      timestamp: daysAgo(12, 10, 30),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'APPROVE',
      entityType: 'Payroll Run',
      entityId: 'pr-002',
      entityLabel: 'PR-002',
      description: 'Approved Payroll Run PR-002 for January 2025 - 5 employees, J$485,000.00',
      changes: [
        { field: 'Status', oldValue: 'Pending', newValue: 'Approved' },
      ],
    },
    {
      id: 'audit-016',
      timestamp: daysAgo(14, 8, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Employee',
      entityId: 'emp-006',
      entityLabel: 'Kevin Thompson',
      description: "Added new Employee 'Kevin Thompson' - Warehouse Associate",
      changes: [],
    },
    {
      id: 'audit-017',
      timestamp: daysAgo(16, 15, 10),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'UPDATE',
      entityType: 'Bank Account',
      entityId: 'bank-001',
      entityLabel: 'NCB Business Chequing',
      description: "Updated Bank Account 'NCB Business Chequing' - reconciled balance",
      changes: [
        { field: 'Reconciled Balance', oldValue: 'J$1,245,000.00', newValue: 'J$1,312,500.00' },
        { field: 'Last Reconciled', oldValue: '15 Dec 2024', newValue: '15 Jan 2025' },
      ],
    },
    {
      id: 'audit-018',
      timestamp: daysAgo(20, 12, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'DELETE',
      entityType: 'Quotation',
      entityId: 'quot-002',
      entityLabel: 'QT-002',
      description: 'Deleted expired Quotation QT-002 for Marcus Brown',
      changes: [],
    },
    {
      id: 'audit-019',
      timestamp: daysAgo(22, 9, 45),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Fixed Asset',
      entityId: 'fa-003',
      entityLabel: 'FA-003',
      description: 'Registered Fixed Asset FA-003 - Commercial Refrigerator (J$350,000.00)',
      changes: [],
    },
    {
      id: 'audit-020',
      timestamp: daysAgo(25, 10, 0),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'VOID',
      entityType: 'Invoice',
      entityId: 'inv-002',
      entityLabel: 'INV-002',
      description: 'Voided Invoice INV-002 for Devon Campbell - customer cancelled order',
      changes: [
        { field: 'Status', oldValue: 'Sent', newValue: 'Voided' },
        { field: 'Balance', oldValue: 'J$38,500.00', newValue: 'J$0.00' },
      ],
    },
    {
      id: 'audit-021',
      timestamp: daysAgo(27, 14, 30),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'SEND',
      entityType: 'Quotation',
      entityId: 'quot-003',
      entityLabel: 'QT-003',
      description: 'Sent Quotation QT-003 to Kingston Hardware Depot via email',
      changes: [
        { field: 'Status', oldValue: 'Draft', newValue: 'Sent' },
      ],
    },
    {
      id: 'audit-022',
      timestamp: daysAgo(28, 11, 15),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: 'emp-002',
      entityLabel: 'Simone Clarke',
      description: "Updated Employee 'Simone Clarke' - salary adjustment",
      changes: [
        { field: 'Basic Salary', oldValue: 'J$95,000.00', newValue: 'J$105,000.00' },
        { field: 'Effective Date', oldValue: '-', newValue: '01 Feb 2025' },
      ],
    },
    {
      id: 'audit-023',
      timestamp: daysAgo(29, 16, 45),
      userId: 'user-001',
      userName: 'Damany Dolphy',
      userEmail: 'demo@yaadbooks.com',
      action: 'CREATE',
      entityType: 'Expense',
      entityId: 'exp-014',
      entityLabel: 'EXP-014',
      description: 'Created Expense EXP-014 - Internet service J$12,500.00 (GraceKennedy Telecom)',
      changes: [],
    },
  ];

  // Sort by timestamp descending (most recent first)
  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-JM', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-JM', {
    day: '2-digit',
    month: 'short',
  });
}

function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString('en-JM', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function getEntityIcon(entityType: EntityType): string {
  const icons: Record<EntityType, string> = {
    Invoice: 'INV',
    Customer: 'CUS',
    Product: 'PRD',
    Expense: 'EXP',
    'Journal Entry': 'JNL',
    Quotation: 'QTN',
    'Bank Account': 'BNK',
    Employee: 'EMP',
    'Payroll Run': 'PAY',
    'Fixed Asset': 'AST',
  };
  return icons[entityType] || 'OTH';
}

function getEntityColor(entityType: EntityType): string {
  const colors: Record<EntityType, string> = {
    Invoice: 'bg-blue-50 text-blue-600 border-blue-200',
    Customer: 'bg-amber-50 text-amber-600 border-amber-200',
    Product: 'bg-violet-50 text-violet-600 border-violet-200',
    Expense: 'bg-rose-50 text-rose-600 border-rose-200',
    'Journal Entry': 'bg-teal-50 text-teal-600 border-teal-200',
    Quotation: 'bg-sky-50 text-sky-600 border-sky-200',
    'Bank Account': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    Employee: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'Payroll Run': 'bg-pink-50 text-pink-600 border-pink-200',
    'Fixed Asset': 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return colors[entityType] || 'bg-gray-50 text-gray-600 border-gray-200';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditTrailPage() {
  // Filters
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
        .toISOString()
        .split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');

  // Expanded entries for change detail
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Store
  const { activeCompany } = useAppStore();

  // -----------------------------------------------------------------------
  // Generate demo data
  // -----------------------------------------------------------------------

  const allEntries = useMemo(() => generateDemoAuditEntries(), []);

  // -----------------------------------------------------------------------
  // Filter entries
  // -----------------------------------------------------------------------

  const filteredEntries = useMemo(() => {
    const startDate = new Date(dateRange.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return allEntries.filter((entry) => {
      // Date range
      if (entry.timestamp < startDate || entry.timestamp > endDate) return false;

      // User filter
      if (selectedUser !== 'all' && entry.userId !== selectedUser) return false;

      // Entity type
      if (selectedEntityType !== 'all' && entry.entityType !== selectedEntityType) return false;

      // Action
      if (selectedAction !== 'all' && entry.action !== selectedAction) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          entry.description,
          entry.entityLabel,
          entry.entityType,
          entry.userName,
          entry.action,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }, [allEntries, dateRange, selectedUser, selectedEntityType, selectedAction, searchQuery]);

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntries = allEntries.filter((e) => e.timestamp >= today);

    // Most active user
    const userCounts = new Map<string, number>();
    for (const entry of allEntries) {
      userCounts.set(entry.userName, (userCounts.get(entry.userName) ?? 0) + 1);
    }
    let mostActiveUser = 'N/A';
    let maxCount = 0;
    userCounts.forEach((count, user) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveUser = user;
      }
    });

    // Most common action
    const actionCounts = new Map<string, number>();
    for (const entry of allEntries) {
      actionCounts.set(entry.action, (actionCounts.get(entry.action) ?? 0) + 1);
    }
    let mostCommonAction = 'N/A';
    let maxActionCount = 0;
    actionCounts.forEach((count, action) => {
      if (count > maxActionCount) {
        maxActionCount = count;
        mostCommonAction = action;
      }
    });

    return {
      totalEvents: allEntries.length,
      eventsToday: todayEntries.length,
      mostActiveUser,
      mostActiveUserCount: maxCount,
      mostCommonAction,
      mostCommonActionCount: maxActionCount,
    };
  }, [allEntries]);

  // -----------------------------------------------------------------------
  // Unique users for filter
  // -----------------------------------------------------------------------

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of allEntries) {
      map.set(entry.userId, entry.userName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allEntries]);

  // -----------------------------------------------------------------------
  // Expand / collapse
  // -----------------------------------------------------------------------

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // -----------------------------------------------------------------------
  // Group entries by date for timeline
  // -----------------------------------------------------------------------

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AuditEntry[]>();
    for (const entry of filteredEntries) {
      const dateKey = entry.timestamp.toISOString().split('T')[0];
      const list = groups.get(dateKey) ?? [];
      list.push(entry);
      groups.set(dateKey, list);
    }
    return Array.from(groups.entries()).map(([dateKey, entries]) => ({
      dateKey,
      date: new Date(dateKey),
      entries,
    }));
  }, [filteredEntries]);

  // -----------------------------------------------------------------------
  // Print
  // -----------------------------------------------------------------------

  const handlePrint = () => {
    const tableHeaders = [
      { key: 'timestamp', label: 'Date & Time' },
      { key: 'user', label: 'User' },
      { key: 'action', label: 'Action' },
      { key: 'entityType', label: 'Entity' },
      { key: 'entityLabel', label: 'Reference' },
      { key: 'description', label: 'Description' },
    ];

    const tableData = filteredEntries.map((e) => ({
      timestamp: formatTimestamp(e.timestamp),
      user: e.userName,
      action: e.action,
      entityType: e.entityType,
      entityLabel: e.entityLabel,
      description: e.description,
    }));

    const content = generateTable(tableHeaders, tableData, {});

    const summary = `
      <div style="margin-top:20px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;">
        <strong>Summary:</strong> ${filteredEntries.length} events shown
        | Period: ${formatDate(new Date(dateRange.start))} to ${formatDate(new Date(dateRange.end))}
      </div>
    `;

    printContent({
      title: 'Audit Trail Report',
      subtitle: `${formatDate(new Date(dateRange.start))} to ${formatDate(new Date(dateRange.end))}`,
      companyName: activeCompany?.businessName,
      content: content + summary,
    });
  };

  // -----------------------------------------------------------------------
  // CSV Download
  // -----------------------------------------------------------------------

  const handleDownloadCSV = () => {
    const rows = filteredEntries.map((e) => ({
      'Date & Time': formatTimestamp(e.timestamp),
      User: e.userName,
      'User Email': e.userEmail,
      Action: e.action,
      'Entity Type': e.entityType,
      Reference: e.entityLabel,
      Description: e.description,
      Changes: e.changes?.length
        ? e.changes.map((c) => `${c.field}: ${c.oldValue} -> ${c.newValue}`).join('; ')
        : '',
    }));

    downloadAsCSV(rows, `audit-trail-${dateRange.start}-to-${dateRange.end}`);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShieldCheckIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
              <p className="text-gray-500">
                Track all changes and actions across your business
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DocumentTextIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Total Events
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalEvents}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <ClockIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Events Today
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.eventsToday}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <UserCircleIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Most Active User
                </p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {stats.mostActiveUser}
                </p>
                <p className="text-xs text-gray-400">
                  {stats.mostActiveUserCount} actions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <FunnelIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Most Common Action
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      ACTION_CONFIG[stats.mostCommonAction as AuditAction]?.bgColor ?? 'bg-gray-100'
                    } ${ACTION_CONFIG[stats.mostCommonAction as AuditAction]?.color ?? 'text-gray-700'}`}
                  >
                    {stats.mostCommonAction}
                  </span>
                  <span className="text-xs text-gray-400">
                    {stats.mostCommonActionCount}x
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <Input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                  className="w-40"
                />
              </div>
              <span className="text-gray-400 mt-5">to</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                  className="w-40"
                />
              </div>
            </div>

            {/* User filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">User</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[160px]"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity type filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Entity</label>
              <select
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[160px]"
              >
                <option value="all">All Entities</option>
                {ALL_ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Action</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white min-w-[140px]"
              >
                <option value="all">All Actions</option>
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick date presets */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  start: now.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0],
                });
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                setDateRange({
                  start: weekAgo.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0],
                });
              }}
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  start: new Date(now.getFullYear(), now.getMonth(), 1)
                    .toISOString()
                    .split('T')[0],
                  end: now.toISOString().split('T')[0],
                });
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
                    .toISOString()
                    .split('T')[0],
                  end: now.toISOString().split('T')[0],
                });
              }}
            >
              Last 30 Days
            </Button>

            {/* Active filter count */}
            {(selectedUser !== 'all' ||
              selectedEntityType !== 'all' ||
              selectedAction !== 'all' ||
              searchQuery.trim()) && (
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="info" size="sm">
                  {[
                    selectedUser !== 'all' ? 1 : 0,
                    selectedEntityType !== 'all' ? 1 : 0,
                    selectedAction !== 'all' ? 1 : 0,
                    searchQuery.trim() ? 1 : 0,
                  ].reduce((a, b) => a + b, 0)}{' '}
                  filter(s) active
                </Badge>
                <button
                  onClick={() => {
                    setSelectedUser('all');
                    setSelectedEntityType('all');
                    setSelectedAction('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-700">{filteredEntries.length}</span> of{' '}
          <span className="font-semibold text-gray-700">{allEntries.length}</span> events
        </p>
      </div>

      {/* Activity Timeline */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              No audit events found
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => {
            const isToday =
              group.dateKey === new Date().toISOString().split('T')[0];
            const isYesterday = (() => {
              const y = new Date();
              y.setDate(y.getDate() - 1);
              return group.dateKey === y.toISOString().split('T')[0];
            })();

            const dateLabel = isToday
              ? 'Today'
              : isYesterday
              ? 'Yesterday'
              : formatDate(group.date);

            return (
              <div key={group.dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">
                      {dateLabel}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {group.entries.length} event{group.entries.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Timeline entries */}
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[27px] top-0 bottom-0 w-px bg-gray-200" />

                  <div className="space-y-1">
                    {group.entries.map((entry, idx) => {
                      const actionCfg = ACTION_CONFIG[entry.action];
                      const isExpanded = expandedEntries.has(entry.id);
                      const hasChanges = entry.changes && entry.changes.length > 0;

                      return (
                        <div key={entry.id} className="relative pl-14">
                          {/* Timeline dot */}
                          <div
                            className={`absolute left-[20px] top-4 w-[15px] h-[15px] rounded-full border-2 border-white shadow-sm ${actionCfg.bgColor}`}
                          />

                          {/* Entry card */}
                          <Card padding="none" className="hover:shadow-md transition-shadow">
                            <div className="p-4">
                              {/* Top row: time, action badge, entity badge */}
                              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Action badge */}
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${actionCfg.bgColor} ${actionCfg.color}`}
                                  >
                                    {entry.action}
                                  </span>

                                  {/* Entity type badge */}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getEntityColor(
                                      entry.entityType
                                    )}`}
                                  >
                                    <span className="font-mono text-[10px] opacity-70">
                                      {getEntityIcon(entry.entityType)}
                                    </span>
                                    {entry.entityType}
                                  </span>

                                  {/* Entity reference */}
                                  <span className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                    {entry.entityLabel}
                                  </span>
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                                  <ClockIcon className="w-3.5 h-3.5" />
                                  <span>{formatTimeOnly(entry.timestamp)}</span>
                                  <span className="hidden sm:inline text-gray-300">
                                    ({getRelativeTime(entry.timestamp)})
                                  </span>
                                </div>
                              </div>

                              {/* Description */}
                              <p className="text-sm text-gray-800 mb-2">
                                {entry.description}
                              </p>

                              {/* User & expand toggle row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      {entry.userName
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs font-medium text-gray-700">
                                      {entry.userName}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-1.5">
                                      {entry.userEmail}
                                    </span>
                                  </div>
                                </div>

                                {hasChanges && (
                                  <button
                                    onClick={() => toggleExpanded(entry.id)}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                        Hide changes
                                      </>
                                    ) : (
                                      <>
                                        <ChevronRightIcon className="w-3.5 h-3.5" />
                                        View changes ({entry.changes!.length})
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Expanded changes detail */}
                              {isExpanded && hasChanges && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <div className="space-y-2">
                                    {entry.changes!.map((change, cIdx) => (
                                      <div
                                        key={cIdx}
                                        className="flex items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2"
                                      >
                                        <span className="font-medium text-gray-600 min-w-[120px]">
                                          {change.field}
                                        </span>
                                        <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded line-through">
                                          {change.oldValue}
                                        </span>
                                        <span className="text-gray-400">&rarr;</span>
                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                                          {change.newValue}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-gray-400">
            The audit trail records all changes made to your business data. Events
            are logged automatically and cannot be altered or deleted. This report
            covers actions from {formatDate(new Date(dateRange.start))} to{' '}
            {formatDate(new Date(dateRange.end))}. For compliance purposes, audit
            records are retained indefinitely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
