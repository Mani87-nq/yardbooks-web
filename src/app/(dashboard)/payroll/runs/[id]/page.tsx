'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  UserGroupIcon,
  PrinterIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/api-client';
import { printContent, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PayrollRunDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const payrollRuns = useAppStore((state) => state.payrollRuns);
  const employees = useAppStore((state) => state.employees);
  const updatePayrollRun = useAppStore((state) => state.updatePayrollRun);
  const activeCompany = useAppStore((state) => state.activeCompany);

  const [approving, setApproving] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const run = payrollRuns.find((r) => r.id === id);

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <DocumentTextIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Payroll Run Not Found</h2>
        <Link href="/payroll" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Payroll
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      approved: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this payroll run? This will post it to the General Ledger.')) return;
    setApproving(true);
    try {
      await api.post(`/api/v1/payroll/${run.id}/approve`);
      updatePayrollRun?.(run.id, { status: 'approved' });
      alert('Payroll run approved successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve payroll run';
      alert(message);
    } finally {
      setApproving(false);
    }
  };

  const handleMarkPaid = () => {
    updatePayrollRun?.(run.id, { status: 'paid' });
  };

  const handleEmailPayslips = async () => {
    if (!confirm('Send payslip emails to all employees in this run?')) return;
    setEmailing(true);
    try {
      const result = await api.post<{ sent: number; failed: number; errors?: string[] }>(
        `/api/v1/payroll/${run.id}/payslips`,
      );
      const data = result as any;
      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;
      alert(`Payslips emailed: ${sent} sent, ${failed} failed`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to email payslips';
      alert(message);
    } finally {
      setEmailing(false);
    }
  };

  // Get employee name helper
  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
  };

  // Print payroll run
  const handlePrint = () => {
    const periodString = `${format(new Date(run.periodStart), 'MMM dd')} - ${format(new Date(run.periodEnd), 'MMM dd, yyyy')}`;

    const summaryContent = generateStatCards([
      { label: 'Employees', value: String(run.entries?.length || 0) },
      { label: 'Gross Pay', value: formatPrintCurrency(run.totalGross), color: '#059669' },
      { label: 'Total Deductions', value: formatPrintCurrency(run.totalDeductions), color: '#dc2626' },
      { label: 'Net Pay', value: formatPrintCurrency(run.totalNet), color: '#16a34a' },
    ]);

    const tableContent = run.entries?.length ? generateTable(
      [
        { key: 'employee', label: 'Employee' },
        { key: 'basic', label: 'Basic', align: 'right' },
        { key: 'gross', label: 'Gross Pay', align: 'right' },
        { key: 'paye', label: 'PAYE', align: 'right' },
        { key: 'nis', label: 'NIS', align: 'right' },
        { key: 'deductions', label: 'Deductions', align: 'right' },
        { key: 'net', label: 'Net Pay', align: 'right' },
      ],
      run.entries.map(entry => ({
        employee: getEmployeeName(entry.employeeId),
        basic: entry.basicSalary,
        gross: entry.grossPay,
        paye: entry.paye,
        nis: entry.nis,
        deductions: entry.totalDeductions,
        net: entry.netPay,
      })),
      {
        formatters: {
          basic: formatPrintCurrency,
          gross: formatPrintCurrency,
          paye: formatPrintCurrency,
          nis: formatPrintCurrency,
          deductions: formatPrintCurrency,
          net: formatPrintCurrency,
        },
        summaryRow: {
          employee: 'Totals',
          basic: '-',
          gross: run.totalGross,
          paye: '-',
          nis: '-',
          deductions: run.totalDeductions,
          net: run.totalNet,
        },
      }
    ) : '<p>No entries in this payroll run</p>';

    printContent({
      title: 'Payroll Run',
      subtitle: periodString + ` | Status: ${run.status.charAt(0).toUpperCase() + run.status.slice(1)}`,
      companyName: activeCompany?.businessName,
      content: summaryContent + tableContent,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/payroll" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Payroll Run</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </span>
            </div>
            <p className="text-gray-500">
              {format(new Date(run.periodStart), 'MMM dd')} - {format(new Date(run.periodEnd), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Print payroll run"
          >
            <PrinterIcon className="w-5 h-5 text-gray-600" />
          </button>
          {(run.status === 'draft' || (run.status as string) === 'DRAFT') && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {approving ? 'Approving...' : 'Approve'}
            </button>
          )}
          {(run.status === 'approved' || (run.status as string) === 'APPROVED') && (
            <>
              <button
                onClick={handleEmailPayslips}
                disabled={emailing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <EnvelopeIcon className="w-4 h-4" />
                {emailing ? 'Sending...' : 'Email Payslips'}
              </button>
              <button
                onClick={handleMarkPaid}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark as Paid
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{run.entries?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BanknotesIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Gross Pay</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(run.totalGross)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Deductions</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(run.totalDeductions)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Net Pay</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(run.totalNet)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Payroll Entries</h2>
        </div>
        {!run.entries || run.entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No entries in this payroll run</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium text-right">Basic</th>
                  <th className="px-4 py-3 font-medium text-right">Gross Pay</th>
                  <th className="px-4 py-3 font-medium text-right">PAYE</th>
                  <th className="px-4 py-3 font-medium text-right">NIS</th>
                  <th className="px-4 py-3 font-medium text-right">Deductions</th>
                  <th className="px-4 py-3 font-medium text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {run.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/payroll/employees/${entry.employeeId}`}
                        className="font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        {getEmployeeName(entry.employeeId)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(entry.basicSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(entry.grossPay)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(entry.paye)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(entry.nis)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(entry.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(entry.netPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900">Totals</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">-</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(run.totalGross)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-600">-</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-600">-</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(run.totalDeductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(run.totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Employer Contributions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Employer Contributions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Total Employer Contributions</dt>
            <dd className="text-2xl font-bold text-gray-900">{formatCurrency(run.totalEmployerContributions)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Pay Date</dt>
            <dd className="text-lg font-semibold text-gray-900">{format(new Date(run.payDate), 'MMM dd, yyyy')}</dd>
          </div>
        </div>
      </div>
    </div>
  );
}
