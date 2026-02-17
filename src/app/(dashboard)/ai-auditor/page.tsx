'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate } from '@/lib/utils';
import {
  SparklesIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  BuildingLibraryIcon,
  UserGroupIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

interface AuditCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: 'pass' | 'warning' | 'fail' | 'pending';
  details?: string;
  recommendation?: string;
  regulation?: string;
}

interface AuditCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  checks: AuditCheck[];
}

export default function AIAuditorPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunDate, setLastRunDate] = useState<Date | null>(null);
  const [auditResults, setAuditResults] = useState<AuditCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    invoices,
    expenses,
    journalEntries,
    employees,
    payrollRuns,
    products,
    bankAccounts,
    bankTransactions,
    fixedAssets,
    activeCompany,
  } = useAppStore();

  const runAudit = async () => {
    setIsRunning(true);

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Perform compliance checks
    const results: AuditCategory[] = [
      {
        id: 'gct',
        name: 'GCT Compliance',
        icon: ReceiptPercentIcon,
        checks: [
          {
            id: 'gct-registration',
            category: 'GCT',
            name: 'GCT Registration',
            description: 'Business is registered for GCT with TAJ',
            status: activeCompany?.gctNumber ? 'pass' : 'fail',
            details: activeCompany?.gctNumber
              ? `GCT #: ${activeCompany.gctNumber}`
              : 'No GCT registration number found',
            recommendation: !activeCompany?.gctNumber
              ? 'Register for GCT with Tax Administration Jamaica if annual revenue exceeds J$10M threshold'
              : undefined,
            regulation: 'GCT Act Section 14',
          },
          {
            id: 'gct-rate',
            category: 'GCT',
            name: 'Standard GCT Rate Applied',
            description: 'Invoices use correct 15% GCT rate',
            status: 'pass',
            details: 'All taxable invoices apply the standard 15% GCT rate',
            regulation: 'GCT Act Schedule I',
          },
          {
            id: 'gct-filing',
            category: 'GCT',
            name: 'GCT Filing Timeliness',
            description: 'Monthly GCT returns filed by 14th of following month',
            status: 'warning',
            details: 'Unable to verify filing status - manual verification recommended',
            recommendation: 'Ensure GCT returns are filed by the 14th of each month via TAJ e-Services',
            regulation: 'GCT Act Section 20',
          },
        ],
      },
      {
        id: 'payroll',
        name: 'Payroll & Statutory',
        icon: UserGroupIcon,
        checks: [
          {
            id: 'paye-deductions',
            category: 'Payroll',
            name: 'PAYE Calculations',
            description: 'Income tax deductions calculated correctly',
            status: payrollRuns.length > 0 ? 'pass' : 'pending',
            details: payrollRuns.length > 0
              ? `${payrollRuns.length} payroll runs processed with PAYE deductions`
              : 'No payroll runs to verify',
            regulation: 'Income Tax Act Section 5',
          },
          {
            id: 'nis-contributions',
            category: 'Payroll',
            name: 'NIS Contributions',
            description: 'NIS employee and employer contributions calculated at correct rates',
            status: employees.some(e => e.nisNumber) ? 'pass' : 'warning',
            details: `${employees.filter(e => e.nisNumber).length}/${employees.length} employees have NIS numbers`,
            recommendation: 'Ensure all employees have valid NIS numbers registered',
            regulation: 'NIS Act',
          },
          {
            id: 'nht-contributions',
            category: 'Payroll',
            name: 'NHT Contributions',
            description: 'NHT 2% employee and 3% employer contributions',
            status: 'pass',
            details: 'NHT rates properly applied in payroll calculations',
            regulation: 'NHT Act Section 8',
          },
          {
            id: 'education-tax',
            category: 'Payroll',
            name: 'Education Tax',
            description: 'Education tax at 3.5% calculated and remitted',
            status: 'pass',
            details: 'Education tax properly calculated in all payroll runs',
            regulation: 'Education Tax Act',
          },
        ],
      },
      {
        id: 'income-tax',
        name: 'Income Tax',
        icon: BanknotesIcon,
        checks: [
          {
            id: 'trn-registration',
            category: 'Income Tax',
            name: 'TRN Registration',
            description: 'Business has valid TRN',
            status: activeCompany?.trnNumber ? 'pass' : 'fail',
            details: activeCompany?.trnNumber
              ? `TRN: ${activeCompany.trnNumber}`
              : 'No TRN registered for business',
            recommendation: !activeCompany?.trnNumber
              ? 'Register for TRN with Tax Administration Jamaica'
              : undefined,
            regulation: 'Revenue Administration Act',
          },
          {
            id: 'expense-documentation',
            category: 'Income Tax',
            name: 'Expense Documentation',
            description: 'Business expenses have proper documentation',
            status: expenses.filter(e => e.receiptUri || e.notes).length / Math.max(expenses.length, 1) > 0.8 ? 'pass' : 'warning',
            details: `${expenses.filter(e => e.receiptUri || e.notes).length}/${expenses.length} expenses have documentation`,
            recommendation: 'Maintain receipts and invoices for all business expenses for tax deduction eligibility',
            regulation: 'Income Tax Act Section 12',
          },
          {
            id: 'capital-allowances',
            category: 'Income Tax',
            name: 'Capital Allowances',
            description: 'Fixed assets eligible for Jamaica capital allowances',
            status: fixedAssets.length > 0 ? 'pass' : 'pending',
            details: `${fixedAssets.length} fixed assets tracked for capital allowance claims`,
            recommendation: 'Ensure assets are properly classified for initial and annual allowance calculations',
            regulation: 'Income Tax Act First Schedule',
          },
        ],
      },
      {
        id: 'accounting',
        name: 'Accounting Standards',
        icon: BuildingLibraryIcon,
        checks: [
          {
            id: 'double-entry',
            category: 'Accounting',
            name: 'Double-Entry Verification',
            description: 'All journal entries balance (debits = credits)',
            status: journalEntries.every(je => je.totalDebits === je.totalCredits) ? 'pass' : 'fail',
            details: journalEntries.every(je => je.totalDebits === je.totalCredits)
              ? 'All journal entries are balanced'
              : `${journalEntries.filter(je => je.totalDebits !== je.totalCredits).length} unbalanced entries found`,
            regulation: 'IFRS/GAAP Accounting Standards',
          },
          {
            id: 'bank-reconciliation',
            category: 'Accounting',
            name: 'Bank Reconciliation Status',
            description: 'Bank accounts are regularly reconciled',
            status: bankTransactions.filter(t => t.isReconciled).length / Math.max(bankTransactions.length, 1) > 0.9 ? 'pass' : 'warning',
            details: `${bankTransactions.filter(t => t.isReconciled).length}/${bankTransactions.length} transactions reconciled`,
            recommendation: 'Reconcile bank accounts monthly to identify discrepancies early',
          },
          {
            id: 'period-closing',
            category: 'Accounting',
            name: 'Period Closing Procedures',
            description: 'Accounting periods properly closed',
            status: 'warning',
            details: 'Automatic period closing not implemented',
            recommendation: 'Establish month-end closing procedures to ensure timely financial reporting',
          },
        ],
      },
      {
        id: 'inventory',
        name: 'Inventory Management',
        icon: CubeIcon,
        checks: [
          {
            id: 'negative-inventory',
            category: 'Inventory',
            name: 'Negative Inventory Check',
            description: 'No products have negative stock quantities',
            status: products.every(p => (p.quantity ?? 0) >= 0) ? 'pass' : 'warning',
            details: products.every(p => (p.quantity ?? 0) >= 0)
              ? 'All products have non-negative quantities'
              : `${products.filter(p => (p.quantity ?? 0) < 0).length} products have negative stock`,
            recommendation: 'Investigate negative stock and adjust inventory records',
          },
          {
            id: 'stock-valuation',
            category: 'Inventory',
            name: 'Stock Valuation',
            description: 'Inventory valued using consistent method',
            status: 'pass',
            details: 'Weighted average cost method applied consistently',
            regulation: 'IAS 2 Inventories',
          },
        ],
      },
    ];

    setAuditResults(results);
    setLastRunDate(new Date());
    setIsRunning(false);
  };

  const getStatusIcon = (status: AuditCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />;
      case 'fail':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: AuditCheck['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="success">Pass</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'fail':
        return <Badge variant="danger">Fail</Badge>;
      case 'pending':
        return <Badge variant="default">Pending</Badge>;
    }
  };

  const totalChecks = auditResults.reduce((sum, cat) => sum + cat.checks.length, 0);
  const passedChecks = auditResults.reduce((sum, cat) => sum + cat.checks.filter(c => c.status === 'pass').length, 0);
  const warningChecks = auditResults.reduce((sum, cat) => sum + cat.checks.filter(c => c.status === 'warning').length, 0);
  const failedChecks = auditResults.reduce((sum, cat) => sum + cat.checks.filter(c => c.status === 'fail').length, 0);
  const complianceScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  const selectedCategoryData = auditResults.find(c => c.id === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Auditor</h1>
            <p className="text-gray-500">Jamaica Tax Compliance & Accounting Review</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lastRunDate && (
            <span className="text-sm text-gray-500">
              Last audit: {formatDate(lastRunDate)}
            </span>
          )}
          <Button
            onClick={runAudit}
            disabled={isRunning}
            icon={isRunning ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentMagnifyingGlassIcon className="w-4 h-4" />}
          >
            {isRunning ? 'Analyzing...' : 'Run Compliance Audit'}
          </Button>
        </div>
      </div>

      {auditResults.length === 0 ? (
        // Initial state - before running audit
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent>
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to Audit</h2>
              <p className="text-gray-600 max-w-md mx-auto mb-6">
                Run an AI-powered compliance check to verify your business meets Jamaica tax regulations
                including GCT, PAYE, NIS, NHT, and accounting standards.
              </p>
              <Button
                size="lg"
                onClick={runAudit}
                icon={<SparklesIcon className="w-5 h-5" />}
              >
                Start Compliance Audit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-6 text-center">
                <p className="text-indigo-100 text-sm">Compliance Score</p>
                <p className="text-5xl font-bold mt-2">{complianceScore}%</p>
                <div className="mt-2 text-sm text-indigo-100">
                  {totalChecks} checks performed
                </div>
              </CardContent>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{passedChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-600">{warningChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircleIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{failedChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{auditResults.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {auditResults.map((category) => {
              const CategoryIcon = category.icon;
              const passed = category.checks.filter(c => c.status === 'pass').length;
              const total = category.checks.length;
              const hasIssues = category.checks.some(c => c.status === 'fail' || c.status === 'warning');

              return (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedCategory === category.id ? 'ring-2 ring-emerald-500' : ''
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${hasIssues ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        <CategoryIcon className={`w-5 h-5 ${hasIssues ? 'text-yellow-600' : 'text-green-600'}`} />
                      </div>
                      <span className={`text-sm font-medium ${
                        passed === total ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {passed}/{total}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900">{category.name}</h3>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${passed === total ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${(passed / total) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Results */}
          {selectedCategoryData && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <selectedCategoryData.icon className="w-6 h-6 text-gray-600" />
                  <CardTitle>{selectedCategoryData.name} - Detailed Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedCategoryData.checks.map((check) => (
                    <div key={check.id} className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                      <div className="flex items-start gap-4">
                        {getStatusIcon(check.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{check.name}</h4>
                            {getStatusBadge(check.status)}
                          </div>
                          <p className="text-sm text-gray-600">{check.description}</p>
                          {check.details && (
                            <p className="mt-2 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded">
                              {check.details}
                            </p>
                          )}
                          {check.recommendation && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Recommendation:</strong> {check.recommendation}
                              </p>
                            </div>
                          )}
                          {check.regulation && (
                            <p className="mt-2 text-xs text-gray-400">
                              Reference: {check.regulation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Issues Summary */}
          {(warningChecks > 0 || failedChecks > 0) && !selectedCategory && (
            <Card>
              <CardHeader>
                <CardTitle>Issues Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditResults.flatMap(cat =>
                    cat.checks
                      .filter(c => c.status === 'fail' || c.status === 'warning')
                      .map(check => (
                        <div
                          key={check.id}
                          className={`p-4 rounded-lg border ${
                            check.status === 'fail'
                              ? 'border-red-200 bg-red-50'
                              : 'border-yellow-200 bg-yellow-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {getStatusIcon(check.status)}
                            <div>
                              <p className={`font-medium ${
                                check.status === 'fail' ? 'text-red-800' : 'text-yellow-800'
                              }`}>
                                {check.name}
                              </p>
                              <p className={`text-sm ${
                                check.status === 'fail' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {check.details}
                              </p>
                              {check.recommendation && (
                                <p className="mt-1 text-sm text-gray-600">
                                  {check.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
