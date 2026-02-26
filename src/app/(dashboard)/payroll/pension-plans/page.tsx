'use client';

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  PlusIcon,
  BuildingLibraryIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  UsersIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { printContent, downloadAsCSV, generateTable, generateStatCards } from '@/lib/print';
import { useAppStore } from '@/store/appStore';
import { PermissionGate } from '@/components/PermissionGate';

interface PensionPlan {
  id: string;
  name: string;
  providerName: string | null;
  policyNumber: string | null;
  employeeRate: number;
  employerRate: number;
  isApproved: boolean;
  isActive: boolean;
  enrolledEmployees: number;
  createdAt: string;
}

export default function PensionPlansPage() {
  const { activeCompany } = useAppStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    providerName: '',
    policyNumber: '',
    employeeRate: '',
    employerRate: '',
    isApproved: false,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pension-plans'],
    queryFn: () => api.get<{ data: PensionPlan[] }>('/api/v1/payroll/pension-plans'),
  });

  const plans: PensionPlan[] = (data as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/api/v1/payroll/pension-plans', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pension-plans'] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      providerName: '',
      policyNumber: '',
      employeeRate: '',
      employerRate: '',
      isApproved: false,
    });
    setFormError('');
  };

  const handleCreate = () => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Plan name is required');
      return;
    }
    const empRate = parseFloat(form.employeeRate) || 0;
    const erRate = parseFloat(form.employerRate) || 0;
    if (empRate < 0 || empRate > 25) {
      setFormError('Employee rate must be between 0% and 25%');
      return;
    }
    if (erRate < 0 || erRate > 25) {
      setFormError('Employer rate must be between 0% and 25%');
      return;
    }

    createMutation.mutate({
      name: form.name,
      providerName: form.providerName || undefined,
      policyNumber: form.policyNumber || undefined,
      employeeRate: empRate / 100,
      employerRate: erRate / 100,
      isApproved: form.isApproved,
    });
  };

  // Stats
  const activePlans = plans.filter((p) => p.isActive);
  const approvedPlans = plans.filter((p) => p.isApproved);
  const totalEnrolled = plans.reduce((sum, p) => sum + p.enrolledEmployees, 0);

  const handlePrint = () => {
    if (plans.length === 0) return;
    const summaryHtml = generateStatCards([
      { label: 'Total Plans', value: plans.length.toString() },
      { label: 'Active', value: activePlans.length.toString(), color: '#059669' },
      { label: 'TAJ Approved', value: approvedPlans.length.toString(), color: '#2563eb' },
      { label: 'Enrolled Employees', value: totalEnrolled.toString(), color: '#7c3aed' },
    ]);
    const tableHtml = generateTable(
      [
        { key: 'name', label: 'Plan Name' },
        { key: 'provider', label: 'Provider' },
        { key: 'employeeRate', label: 'Employee Rate', align: 'right' },
        { key: 'employerRate', label: 'Employer Rate', align: 'right' },
        { key: 'enrolled', label: 'Enrolled', align: 'right' },
        { key: 'approved', label: 'Approved' },
        { key: 'status', label: 'Status' },
      ],
      plans.map((plan) => ({
        name: plan.name,
        provider: plan.providerName || '-',
        employeeRate: `${(plan.employeeRate * 100).toFixed(1)}%`,
        employerRate: `${(plan.employerRate * 100).toFixed(1)}%`,
        enrolled: plan.enrolledEmployees,
        approved: plan.isApproved ? 'TAJ Approved' : 'Not Approved',
        status: plan.isActive ? 'Active' : 'Inactive',
      })),
    );
    printContent({
      title: 'Pension Plans',
      subtitle: `As of ${new Date().toLocaleDateString()}`,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      content: summaryHtml + tableHtml,
    });
  };

  const handleExportCSV = () => {
    if (plans.length === 0) return;
    downloadAsCSV(
      plans.map((plan) => ({
        'Plan Name': plan.name,
        Provider: plan.providerName ?? '',
        'Policy Number': plan.policyNumber ?? '',
        'Employee Rate %': (plan.employeeRate * 100).toFixed(1),
        'Employer Rate %': (plan.employerRate * 100).toFixed(1),
        'Enrolled Employees': plan.enrolledEmployees,
        'TAJ Approved': plan.isApproved ? 'Yes' : 'No',
        Status: plan.isActive ? 'Active' : 'Inactive',
        'Created At': plan.createdAt,
      })),
      'pension-plans'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pension Plans</h1>
          <p className="text-gray-500">
            Manage Jamaica-approved pension plans for tax relief
          </p>
        </div>
        <PermissionGate permission="payroll:create">
          <Button
            icon={<PlusIcon className="w-4 h-4" />}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            Add Pension Plan
          </Button>
        </PermissionGate>
      </div>

      {/* Print / Export Toolbar */}
      {plans.length > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Plans</p>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? '-' : plans.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">
              {isLoading ? '-' : activePlans.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">TAJ Approved</p>
            <p className="text-2xl font-bold text-blue-600">
              {isLoading ? '-' : approvedPlans.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Enrolled Employees</p>
            <p className="text-2xl font-bold text-purple-600">
              {isLoading ? '-' : totalEnrolled}
            </p>
          </div>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Jamaica Pension Tax Relief</p>
        <p className="text-blue-600">
          Employee contributions to TAJ-approved pension plans are deducted from
          statutory income before PAYE calculation, providing tax savings for
          employees. Employer contributions are a deductible business expense.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            Failed to load pension plans.{' '}
            {error instanceof Error ? error.message : ''}
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
            <p className="text-gray-500">Loading pension plans...</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Employee Rate</TableHead>
                <TableHead>Employer Rate</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-gray-500"
                  >
                    <BuildingLibraryIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="mb-4">No pension plans configured</p>
                    <Button
                      onClick={() => {
                        resetForm();
                        setShowModal(true);
                      }}
                    >
                      Add your first pension plan
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{plan.name}</p>
                        {plan.policyNumber && (
                          <p className="text-xs text-gray-500">
                            Policy: {plan.policyNumber}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {plan.providerName || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {(plan.employeeRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="font-medium">
                      {(plan.employerRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <UsersIcon className="w-4 h-4 text-gray-400" />
                        <span>{plan.enrolledEmployees}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.isApproved ? (
                        <Badge variant="success">
                          <CheckCircleIcon className="w-3 h-3 mr-1 inline" />
                          TAJ Approved
                        </Badge>
                      ) : (
                        <Badge variant="default">Not Approved</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.isActive ? 'success' : 'default'}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Pension Plan"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {formError}
              </div>
            )}
            <Input
              label="Plan Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. NCB Pension Plan"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Provider Name"
                value={form.providerName}
                onChange={(e) =>
                  setForm({ ...form, providerName: e.target.value })
                }
                placeholder="e.g. Sagicor Life Jamaica"
              />
              <Input
                label="Policy Number"
                value={form.policyNumber}
                onChange={(e) =>
                  setForm({ ...form, policyNumber: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Employee Contribution Rate (%)"
                type="number"
                value={form.employeeRate}
                onChange={(e) =>
                  setForm({ ...form, employeeRate: e.target.value })
                }
                placeholder="e.g. 5"
              />
              <Input
                label="Employer Contribution Rate (%)"
                type="number"
                value={form.employerRate}
                onChange={(e) =>
                  setForm({ ...form, employerRate: e.target.value })
                }
                placeholder="e.g. 5"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isApproved"
                checked={form.isApproved}
                onChange={(e) =>
                  setForm({ ...form, isApproved: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="isApproved" className="text-sm text-gray-700">
                TAJ-approved pension plan (qualifies for income tax relief)
              </label>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Plan'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
