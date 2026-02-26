'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  ModalBody,
  ModalFooter,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { PermissionGate } from '@/components/PermissionGate';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  PlusIcon,
  TrashIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface BudgetLine {
  id: string;
  accountId: string;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  month6: number;
  month7: number;
  month8: number;
  month9: number;
  month10: number;
  month11: number;
  month12: number;
  account: {
    id: string;
    accountNumber: string;
    name: string;
    type: string;
  };
}

interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
  status: string;
  notes: string | null;
  totalBudget: number;
  lines: BudgetLine[];
  _count: { lines: number };
  createdAt: string;
}

interface GLAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: string;
}

interface ListResponse<T> {
  data: T[];
}

// ============================================
// FISCAL YEAR HELPERS (Jamaica: April 1 - March 31)
// ============================================

const FISCAL_YEAR_OPTIONS = [2025, 2026, 2027, 2028];

function getFiscalYearLabel(fy: number): string {
  // Jamaica fiscal year 2026 = April 2025 - March 2026
  return `Apr ${fy - 1} - Mar ${fy}`;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function BudgetsPage() {
  const { fc } = useCurrency();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fiscalYear: 2026,
    notes: '',
  });
  const [budgetLines, setBudgetLines] = useState<
    { accountId: string; annualAmount: number }[]
  >([]);

  // ---------- Data fetching ----------

  const { data: budgetsResponse, isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get<ListResponse<Budget>>('/api/v1/budgets'),
  });

  const { data: glAccountsResponse } = useQuery({
    queryKey: ['glAccounts'],
    queryFn: () => api.get<ListResponse<GLAccount>>('/api/v1/accounting/chart'),
  });

  const createBudget = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/api/v1/budgets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  // ---------- Derived data ----------

  const budgets: Budget[] = ((budgetsResponse as any)?.data ?? []).map(
    (b: any) => ({
      ...b,
      totalBudget: Number(b.totalBudget ?? 0),
      lines: (b.lines ?? []).map((l: any) => ({
        ...l,
        month1: Number(l.month1 ?? 0),
        month2: Number(l.month2 ?? 0),
        month3: Number(l.month3 ?? 0),
        month4: Number(l.month4 ?? 0),
        month5: Number(l.month5 ?? 0),
        month6: Number(l.month6 ?? 0),
        month7: Number(l.month7 ?? 0),
        month8: Number(l.month8 ?? 0),
        month9: Number(l.month9 ?? 0),
        month10: Number(l.month10 ?? 0),
        month11: Number(l.month11 ?? 0),
        month12: Number(l.month12 ?? 0),
      })),
    })
  );

  const glAccounts: GLAccount[] = (
    (glAccountsResponse as any)?.data ?? []
  ).map((a: any) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    name: a.name,
    type: a.type,
  }));

  const totalBudgets = budgets.length;
  const activeBudgets = budgets.filter(
    (b) => b.status === 'ACTIVE' || b.status === 'active'
  ).length;
  const totalBudgetedAmount = budgets.reduce(
    (sum, b) => sum + b.totalBudget,
    0
  );

  // ---------- Modal handlers ----------

  const handleOpenModal = () => {
    setFormData({ name: '', fiscalYear: 2026, notes: '' });
    setBudgetLines([]);
    setShowModal(true);
  };

  const handleAddLine = () => {
    setBudgetLines([...budgetLines, { accountId: '', annualAmount: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    setBudgetLines(budgetLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: 'accountId' | 'annualAmount',
    value: string | number
  ) => {
    const updated = [...budgetLines];
    if (field === 'accountId') {
      updated[index] = { ...updated[index], accountId: String(value) };
    } else {
      updated[index] = {
        ...updated[index],
        annualAmount: typeof value === 'string' ? parseFloat(value) || 0 : value,
      };
    }
    setBudgetLines(updated);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a budget name');
      return;
    }
    if (budgetLines.length === 0) {
      alert('Please add at least one budget line');
      return;
    }
    if (budgetLines.some((l) => !l.accountId)) {
      alert('Please select an account for all lines');
      return;
    }

    // Divide annual amount evenly across 12 months
    const lines = budgetLines.map((l) => {
      const monthly = Math.round((l.annualAmount / 12) * 100) / 100;
      // Put any remainder cents in month12 to avoid rounding drift
      const monthlyTotal = monthly * 11;
      const month12Amount =
        Math.round((l.annualAmount - monthlyTotal) * 100) / 100;

      return {
        accountId: l.accountId,
        month1: monthly,
        month2: monthly,
        month3: monthly,
        month4: monthly,
        month5: monthly,
        month6: monthly,
        month7: monthly,
        month8: monthly,
        month9: monthly,
        month10: monthly,
        month11: monthly,
        month12: month12Amount,
      };
    });

    try {
      await createBudget.mutateAsync({
        name: formData.name,
        fiscalYear: formData.fiscalYear,
        notes: formData.notes || undefined,
        lines,
      });
      setShowModal(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create budget';
      alert(message);
    }
  };

  const linesTotalAnnual = budgetLines.reduce(
    (sum, l) => sum + (l.annualAmount || 0),
    0
  );

  // ---------- Status badge helper ----------

  const getStatusVariant = (
    status: string
  ): 'success' | 'warning' | 'default' | 'danger' => {
    const s = status.toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'draft') return 'warning';
    if (s === 'closed' || s === 'archived') return 'default';
    return 'default';
  };

  // ---------- Render ----------

  return (
    <PermissionGate permission="gl:read" fallback={<div className="p-8 text-center text-gray-500 dark:text-gray-400">You do not have permission to view budgets.</div>}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Plan and manage your fiscal year budgets
            </p>
          </div>
          <PermissionGate permission="gl:create">
            <Button
              icon={<PlusIcon className="w-4 h-4" />}
              onClick={handleOpenModal}
            >
              Create Budget
            </Button>
          </PermissionGate>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardDocumentListIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Budgets</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalBudgets}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckBadgeIcon className="w-5 h-5 text-emerald-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Budgets</p>
              </div>
              <p className="text-2xl font-bold text-emerald-600">
                {activeBudgets}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollarIcon className="w-5 h-5 text-blue-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Budgeted</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {fc(totalBudgetedAmount)}
              </p>
            </div>
          </Card>
        </div>

        {/* Budgets Table */}
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget Name</TableHead>
                <TableHead>Fiscal Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Line Items</TableHead>
                <TableHead>Total Budget</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500 dark:text-gray-400">
                    Loading budgets...
                  </TableCell>
                </TableRow>
              ) : budgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="mb-4">No budgets found</p>
                    <PermissionGate permission="gl:create">
                      <Button onClick={handleOpenModal}>
                        Create your first budget
                      </Button>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ) : (
                budgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {budget.name}
                        </p>
                        {budget.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {budget.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          FY {budget.fiscalYear}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {getFiscalYearLabel(budget.fiscalYear)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(budget.status)}>
                        {budget.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {budget._count?.lines ?? budget.lines?.length ?? 0}
                    </TableCell>
                    <TableCell className="font-medium">
                      {fc(budget.totalBudget)}
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">
                      {formatDate(budget.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create Budget Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Budget"
          size="xl"
        >
          <ModalBody>
            <div className="space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Budget Name *"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Operating Budget 2026"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fiscal Year *
                  </label>
                  <select
                    value={formData.fiscalYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fiscalYear: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
                  >
                    {FISCAL_YEAR_OPTIONS.map((fy) => (
                      <option key={fy} value={fy}>
                        FY {fy} ({getFiscalYearLabel(fy)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Optional notes about this budget"
                />
              </div>

              {/* Budget Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Budget Lines
                  </label>
                  <Button variant="outline" size="sm" onClick={handleAddLine}>
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                {budgetLines.length === 0 ? (
                  <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">
                    <p className="mb-2">No budget lines added yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddLine}
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add your first line
                    </Button>
                  </div>
                ) : (
                  <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                            GL Account
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-40">
                            Annual Amount
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-32">
                            Monthly
                          </th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {budgetLines.map((line, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2">
                              <select
                                value={line.accountId}
                                onChange={(e) =>
                                  handleLineChange(
                                    index,
                                    'accountId',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm"
                              >
                                <option value="">Select account</option>
                                {glAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.accountNumber} - {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={line.annualAmount || ''}
                                onChange={(e) =>
                                  handleLineChange(
                                    index,
                                    'annualAmount',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm text-right"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-right">
                              {line.annualAmount
                                ? fc(
                                    Math.round(
                                      (line.annualAmount / 12) * 100
                                    ) / 100
                                  )
                                : '-'}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => handleRemoveLine(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {budgetLines.length > 0 && (
                          <tr className="bg-gray-50 dark:bg-gray-900 font-medium">
                            <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                              Total:
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">
                              {fc(linesTotalAnnual)}
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-gray-500 dark:text-gray-400">
                              {fc(
                                Math.round(
                                  (linesTotalAnnual / 12) * 100
                                ) / 100
                              )}
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createBudget.isPending ||
                !formData.name.trim() ||
                budgetLines.length === 0
              }
            >
              {createBudget.isPending ? 'Creating...' : 'Create Budget'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PermissionGate>
  );
}
