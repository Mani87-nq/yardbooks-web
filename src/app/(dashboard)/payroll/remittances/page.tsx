'use client';

import React, { useState } from 'react';
import {
  Card,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  BanknotesIcon,
  ArrowPathIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { PermissionGate } from '@/components/PermissionGate';

interface Remittance {
  id: string;
  remittanceType: string;
  periodMonth: string;
  amountDue: number | string;
  amountPaid: number | string;
  dueDate: string;
  status: string;
  paymentDate: string | null;
  referenceNumber: string | null;
  journalEntry: { id: string; reference: string } | null;
}

interface RemittanceSummary {
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  pending: number;
  overdue: number;
}

const REMITTANCE_TYPE_LABELS: Record<string, string> = {
  PAYE: 'PAYE (Income Tax)',
  NIS: 'NIS (National Insurance)',
  NHT: 'NHT (Housing Trust)',
  EDUCATION_TAX: 'Education Tax',
  HEART_NTA: 'HEART/NTA',
};

const REMITTANCE_TYPE_COLORS: Record<string, string> = {
  PAYE: 'bg-blue-100 text-blue-700',
  NIS: 'bg-emerald-100 text-emerald-700',
  NHT: 'bg-purple-100 text-purple-700',
  EDUCATION_TAX: 'bg-orange-100 text-orange-700',
  HEART_NTA: 'bg-cyan-100 text-cyan-700',
};

export default function RemittancesPage() {
  const { fc } = useCurrency();
  const queryClient = useQueryClient();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear().toString());
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    year: now.getFullYear().toString(),
    month: (now.getMonth() + 1).toString(),
  });
  const [generateError, setGenerateError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['remittances', filterYear],
    queryFn: () =>
      api.get<{ data: Remittance[]; summary: RemittanceSummary }>(
        `/api/v1/payroll/remittances?year=${filterYear}`
      ),
  });

  const remittances: Remittance[] = (data as any)?.data ?? [];
  const summary: RemittanceSummary = (data as any)?.summary ?? {
    totalDue: 0,
    totalPaid: 0,
    outstanding: 0,
    pending: 0,
    overdue: 0,
  };

  const generateMutation = useMutation({
    mutationFn: (payload: { year: number; month: number }) =>
      api.post('/api/v1/payroll/remittances', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittances'] });
      setShowGenerateModal(false);
      setGenerateError('');
    },
    onError: (err: Error) => {
      setGenerateError(err.message);
    },
  });

  const handleGenerate = () => {
    setGenerateError('');
    const year = parseInt(generateForm.year);
    const month = parseInt(generateForm.month);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      setGenerateError('Please enter a valid year and month');
      return;
    }
    generateMutation.mutate({ year, month });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
      case 'OVERDUE':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <ClockIcon className="w-4 h-4 text-amber-500" />;
    }
  };

  const statusVariant = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'OVERDUE':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-JM', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Statutory Remittances
          </h1>
          <p className="text-gray-500">
            Track PAYE, NIS, NHT, Education Tax &amp; HEART payments to
            government agencies
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Year:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <PermissionGate permission="payroll:create">
            <Button
              icon={<PlusIcon className="w-4 h-4" />}
              onClick={() => setShowGenerateModal(true)}
            >
              Generate Remittances
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Due</p>
            <p className="text-xl font-bold text-gray-900">
              {isLoading ? '-' : fc(summary.totalDue)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600">
              {isLoading ? '-' : fc(summary.totalPaid)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className="text-xl font-bold text-amber-600">
              {isLoading ? '-' : fc(summary.outstanding)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-blue-600">
              {isLoading ? '-' : summary.pending}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-2xl font-bold text-red-600">
              {isLoading ? '-' : summary.overdue}
            </p>
          </div>
        </Card>
      </div>

      {/* Due Date Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Remittance Due Dates</p>
        <p className="text-amber-600">
          All statutory deductions (PAYE, NIS, NHT, Education Tax, HEART/NTA)
          must be remitted to the relevant government agencies by the{' '}
          <span className="font-semibold">14th of the following month</span>.
          Late payments attract penalties and interest.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            Failed to load remittances.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500">Loading remittances...</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remittances.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-gray-500"
                  >
                    <BanknotesIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="mb-2">No remittances found for {filterYear}</p>
                    <p className="text-xs text-gray-400 mb-4">
                      Generate remittances from approved payroll runs
                    </p>
                    <Button onClick={() => setShowGenerateModal(true)}>
                      Generate Remittances
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                remittances.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          REMITTANCE_TYPE_COLORS[r.remittanceType] ??
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {REMITTANCE_TYPE_LABELS[r.remittanceType] ??
                          r.remittanceType}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatPeriod(r.periodMonth)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {fc(Number(r.amountDue))}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600">
                      {Number(r.amountPaid) > 0
                        ? fc(Number(r.amountPaid))
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(r.dueDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {statusIcon(r.status)}
                        <Badge variant={statusVariant(r.status)}>
                          {r.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-xs font-mono">
                      {r.referenceNumber || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Remittance Records"
      >
        <ModalBody>
          <div className="space-y-4">
            {generateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {generateError}
              </div>
            )}
            <p className="text-sm text-gray-600">
              This will aggregate all statutory deductions from approved payroll
              runs for the selected month and create remittance records.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={generateForm.year}
                  onChange={(e) =>
                    setGenerateForm({ ...generateForm, year: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month
                </label>
                <select
                  value={generateForm.month}
                  onChange={(e) =>
                    setGenerateForm({ ...generateForm, month: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December',
                  ].map((name, i) => (
                    <option key={i} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowGenerateModal(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? 'Generating...'
              : 'Generate Remittances'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
