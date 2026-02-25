'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
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
  XMarkIcon,
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
// API response shape (from /api/v1/audit-logs)
// ---------------------------------------------------------------------------

interface AuditLogApiEntry {
  id: string;
  companyId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

interface AuditLogApiResponse {
  data: AuditLogApiEntry[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

// ---------------------------------------------------------------------------
// Map API entity type strings to display labels
// ---------------------------------------------------------------------------

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  invoice: 'Invoice',
  customer: 'Customer',
  product: 'Product',
  expense: 'Expense',
  journal_entry: 'Journal Entry',
  journalentry: 'Journal Entry',
  quotation: 'Quotation',
  bank_account: 'Bank Account',
  bankaccount: 'Bank Account',
  employee: 'Employee',
  payroll_run: 'Payroll Run',
  payrollrun: 'Payroll Run',
  fixed_asset: 'Fixed Asset',
  fixedasset: 'Fixed Asset',
};

function mapEntityType(raw: string): EntityType {
  return ENTITY_TYPE_MAP[raw.toLowerCase()] ?? (raw as EntityType);
}

// ---------------------------------------------------------------------------
// Map API action strings to AuditAction
// ---------------------------------------------------------------------------

const VALID_ACTIONS: Set<string> = new Set(ALL_ACTIONS);

function mapAction(raw: string): AuditAction {
  const upper = raw.toUpperCase();
  if (VALID_ACTIONS.has(upper)) return upper as AuditAction;
  // Map additional Prisma enum values to closest display action
  const fallback: Record<string, AuditAction> = {
    RESTORE: 'CREATE',
    LOGIN: 'EXPORT',
    LOGOUT: 'EXPORT',
    IMPORT: 'CREATE',
    REJECT: 'DELETE',
    POST: 'APPROVE',
    REVERSE: 'VOID',
    SECURITY_ALERT: 'EXPORT',
  };
  return fallback[upper] ?? 'UPDATE';
}

// ---------------------------------------------------------------------------
// Build changes array from oldValues / newValues
// ---------------------------------------------------------------------------

function buildChanges(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  changedFields: string[],
): AuditChange[] {
  if (!changedFields.length && !oldValues && !newValues) return [];

  const fields = changedFields.length
    ? changedFields
    : Array.from(new Set([
        ...Object.keys(oldValues ?? {}),
        ...Object.keys(newValues ?? {}),
      ]));

  return fields.map((field) => ({
    field,
    oldValue: oldValues?.[field] != null ? String(oldValues[field]) : '-',
    newValue: newValues?.[field] != null ? String(newValues[field]) : '-',
  }));
}

// ---------------------------------------------------------------------------
// Build a human-readable description from an audit log entry
// ---------------------------------------------------------------------------

function buildDescription(entry: AuditLogApiEntry): string {
  const action = entry.action;
  const entity = mapEntityType(entry.entityType);
  const id = entry.entityId;

  if (entry.notes) return entry.notes;
  if (entry.reason) return entry.reason;

  return `${action.charAt(0) + action.slice(1).toLowerCase()} ${entity} ${id}`;
}

// ---------------------------------------------------------------------------
// Map a raw API entry to the UI AuditEntry interface
// ---------------------------------------------------------------------------

function mapApiEntry(raw: AuditLogApiEntry, currentUser: { id: string; firstName: string; lastName: string; email: string } | null): AuditEntry {
  const isCurrentUser = currentUser && raw.userId === currentUser.id;

  return {
    id: raw.id,
    timestamp: new Date(raw.createdAt),
    userId: raw.userId ?? 'unknown',
    userName: isCurrentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : raw.userId ?? 'System',
    userEmail: isCurrentUser
      ? currentUser.email
      : '',
    action: mapAction(raw.action),
    entityType: mapEntityType(raw.entityType),
    entityId: raw.entityId,
    entityLabel: raw.entityId,
    description: buildDescription(raw),
    changes: buildChanges(raw.oldValues, raw.newValues, raw.changedFields),
    ipAddress: raw.ipAddress ?? undefined,
  };
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
  const { activeCompany, user } = useAppStore();

  // -----------------------------------------------------------------------
  // Fetch audit logs from API
  // -----------------------------------------------------------------------

  const { data: allEntries = [], isLoading: isLoadingAudit } = useQuery<AuditEntry[]>({
    queryKey: ['audit-logs', activeCompany?.id],
    queryFn: async () => {
      const res = await api.get<AuditLogApiResponse>('/api/v1/audit-logs?limit=200');
      return res.data.map((entry) =>
        mapApiEntry(entry, user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } : null)
      );
    },
    enabled: !!activeCompany?.id,
  });

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
                rightIcon={searchQuery ? (
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                ) : undefined}
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

      {/* Loading state */}
      {isLoadingAudit ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading audit trail...</p>
          </CardContent>
        </Card>
      ) : /* Activity Timeline */
      filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              No audit events found
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {allEntries.length === 0
                ? 'No audit events have been recorded yet.'
                : 'Try adjusting your filters or date range.'}
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
