'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
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

  // Map category names from the API to icons and IDs
  const categoryConfig: Record<string, { id: string; icon: React.ElementType }> = {
    'GCT Compliance': { id: 'gct', icon: ReceiptPercentIcon },
    'Payroll & Statutory': { id: 'payroll', icon: UserGroupIcon },
    'Income Tax': { id: 'income-tax', icon: BanknotesIcon },
    'Accounting Standards': { id: 'accounting', icon: BuildingLibraryIcon },
    'Inventory Management': { id: 'inventory', icon: CubeIcon },
  };

  const runAudit = async () => {
    setIsRunning(true);
    setSelectedCategory(null);

    try {
      const res = await api.post<{
        findings: Array<{
          category: string;
          name: string;
          status: 'pass' | 'warning' | 'fail';
          description: string;
          details: string;
          recommendation?: string;
          impact?: string;
        }>;
        error?: string;
      }>('/api/v1/ai/audit');

      if (res.error) {
        console.error('[AI Audit]', res.error);
        setIsRunning(false);
        return;
      }

      // Group findings by category and map to AuditCategory[]
      const grouped: Record<string, AuditCheck[]> = {};
      let checkIndex = 0;

      for (const finding of res.findings) {
        const cat = finding.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: `check-${checkIndex++}`,
          category: cat,
          name: finding.name,
          description: finding.description,
          status: finding.status,
          details: finding.details,
          recommendation: finding.recommendation,
        });
      }

      const results: AuditCategory[] = Object.entries(grouped).map(([name, checks]) => {
        const config = categoryConfig[name] || { id: name.toLowerCase().replace(/\s+/g, '-'), icon: ChartBarIcon };
        return {
          id: config.id,
          name,
          icon: config.icon,
          checks,
        };
      });

      setAuditResults(results);
      setLastRunDate(new Date());
    } catch (err) {
      console.error('[AI Audit] Request failed:', err);
    } finally {
      setIsRunning(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Auditor</h1>
            <p className="text-gray-500 dark:text-gray-400">Jamaica Tax Compliance & Accounting Review</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {lastRunDate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
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
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <CardContent>
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 bg-white dark:bg-gray-700 rounded-full shadow-lg dark:shadow-none flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Audit</h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-6">
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
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Passed</p>
                  <p className="text-2xl font-bold text-green-600">{passedChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Warnings</p>
                  <p className="text-2xl font-bold text-yellow-600">{warningChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{failedChecks}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 flex items-center gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Categories</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{auditResults.length}</p>
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
                      <div className={`p-2 rounded-lg ${hasIssues ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                        <CategoryIcon className={`w-5 h-5 ${hasIssues ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`} />
                      </div>
                      <span className={`text-sm font-medium ${
                        passed === total ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {passed}/{total}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                  <selectedCategoryData.icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  <CardTitle>{selectedCategoryData.name} - Detailed Results</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedCategoryData.checks.map((check) => (
                    <div key={check.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex items-start gap-4">
                        {getStatusIcon(check.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{check.name}</h4>
                            {getStatusBadge(check.status)}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{check.description}</p>
                          {check.details && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
                              {check.details}
                            </p>
                          )}
                          {check.recommendation && (
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Recommendation:</strong> {check.recommendation}
                              </p>
                            </div>
                          )}
                          {check.regulation && (
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
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
                              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30'
                              : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {getStatusIcon(check.status)}
                            <div>
                              <p className={`font-medium ${
                                check.status === 'fail' ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'
                              }`}>
                                {check.name}
                              </p>
                              <p className={`text-sm ${
                                check.status === 'fail' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {check.details}
                              </p>
                              {check.recommendation && (
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
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
