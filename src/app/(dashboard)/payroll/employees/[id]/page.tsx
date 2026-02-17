'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  UserIcon,
  PencilIcon,
  BanknotesIcon,
  CalendarIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';
import { printContent, generateTable, generateStatCards, formatPrintCurrency } from '@/lib/print';
import type { PayrollEntry } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EmployeeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const employees = useAppStore((state) => state.employees);
  const payrollRuns = useAppStore((state) => state.payrollRuns);

  const employee = employees.find((e) => e.id === id);
  const activeCompany = useAppStore((state) => state.activeCompany);

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <UserIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Employee Not Found</h2>
        <Link href="/payroll" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Payroll
        </Link>
      </div>
    );
  }

  // Get employee's payroll entries from payroll runs
  const employeePayrollHistory = payrollRuns
    .filter((run) => run.entries?.some((entry) => entry.employeeId === employee.id))
    .map((run) => {
      const entry = run.entries?.find((e) => e.employeeId === employee.id);
      return { run, entry };
    })
    .filter((item) => item.entry)
    .slice(0, 10);

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  const handlePrintPayslip = (run: typeof payrollRuns[0], entry: PayrollEntry) => {
    const periodString = `${format(new Date(run.periodStart), 'MMM dd')} - ${format(new Date(run.periodEnd), 'MMM dd, yyyy')}`;

    const employeeInfo = `
      <table style="width:100%;margin-bottom:20px;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#6b7280;">Employee Name</td><td style="padding:8px;font-weight:600;">${employee.firstName} ${employee.lastName}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Employee #</td><td style="padding:8px;font-weight:500;">${employee.employeeNumber}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Department</td><td style="padding:8px;font-weight:500;">${employee.department || 'N/A'}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Position</td><td style="padding:8px;font-weight:500;">${employee.position}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Pay Period</td><td style="padding:8px;font-weight:500;">${periodString}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;">Pay Date</td><td style="padding:8px;font-weight:500;">${format(new Date(run.payDate), 'MMMM dd, yyyy')}</td></tr>
      </table>
    `;

    const earningsTable = generateTable(
      [
        { key: 'description', label: 'Earnings' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      [
        { description: 'Basic Salary', amount: entry.basicSalary },
        ...(entry.overtime > 0 ? [{ description: 'Overtime', amount: entry.overtime }] : []),
        ...(entry.bonus > 0 ? [{ description: 'Bonus', amount: entry.bonus }] : []),
        ...(entry.commission > 0 ? [{ description: 'Commission', amount: entry.commission }] : []),
        ...(entry.allowances > 0 ? [{ description: 'Allowances', amount: entry.allowances }] : []),
      ],
      {
        formatters: { amount: formatPrintCurrency },
        summaryRow: { description: 'Gross Pay', amount: entry.grossPay },
      }
    );

    const deductionsTable = generateTable(
      [
        { key: 'description', label: 'Deductions' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      [
        { description: 'PAYE (Income Tax)', amount: entry.paye },
        { description: 'NIS (Employee)', amount: entry.nis },
        { description: 'NHT', amount: entry.nht },
        { description: 'Education Tax', amount: entry.educationTax },
        ...(entry.otherDeductions > 0 ? [{ description: 'Other Deductions', amount: entry.otherDeductions }] : []),
      ],
      {
        formatters: { amount: formatPrintCurrency },
        summaryRow: { description: 'Total Deductions', amount: entry.totalDeductions },
      }
    );

    const netPaySection = `
      <div style="margin-top:20px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;">
        <p style="color:#166534;font-size:14px;margin-bottom:8px;">Net Pay</p>
        <p style="font-size:28px;font-weight:700;color:#166534;">${formatPrintCurrency(entry.netPay)}</p>
      </div>
    `;

    const taxInfo = `
      <div style="margin-top:20px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
        <p style="font-size:12px;color:#6b7280;">
          <strong>Tax Information:</strong> TRN: ${employee.trnNumber || 'N/A'} | NIS: ${employee.nisNumber || 'N/A'}
        </p>
        <p style="font-size:12px;color:#6b7280;margin-top:4px;">
          Year-to-date earnings and deductions are tracked for statutory reporting.
        </p>
      </div>
    `;

    printContent({
      title: 'Pay Slip',
      subtitle: periodString,
      companyName: activeCompany?.businessName,
      content: employeeInfo + '<h3 style="margin:20px 0 10px;font-weight:600;">Earnings</h3>' + earningsTable +
               '<h3 style="margin:20px 0 10px;font-weight:600;">Deductions</h3>' + deductionsTable +
               netPaySection + taxInfo,
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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-emerald-600">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="text-gray-500">{employee.position}</p>
              <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                employee.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/payroll/employees/${employee.id}/edit`}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <PencilIcon className="w-4 h-4" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Compensation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BanknotesIcon className="w-5 h-5 text-emerald-600" />
              Compensation
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Base Salary</dt>
                <dd className="text-lg font-semibold text-gray-900">{formatCurrency(employee.baseSalary)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Pay Frequency</dt>
                <dd className="text-lg font-semibold text-gray-900 capitalize">{employee.paymentFrequency}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Employment Type</dt>
                <dd className="text-lg font-semibold text-gray-900 capitalize">{employee.employmentType.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Department</dt>
                <dd className="text-lg font-semibold text-gray-900">{employee.department || '-'}</dd>
              </div>
            </div>
          </div>

          {/* Payroll History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Payroll History</h2>
            {employeePayrollHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No payroll history yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 border-b">
                      <th className="pb-3 font-medium">Period</th>
                      <th className="pb-3 font-medium text-right">Gross</th>
                      <th className="pb-3 font-medium text-right">Deductions</th>
                      <th className="pb-3 font-medium text-right">Net</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employeePayrollHistory.map(({ run, entry }, index) => (
                      <tr key={index}>
                        <td className="py-3 text-gray-900">
                          {format(new Date(run.periodStart), 'MMM dd')} - {format(new Date(run.periodEnd), 'MMM dd, yyyy')}
                        </td>
                        <td className="py-3 text-right text-gray-900">{formatCurrency(entry?.grossPay || 0)}</td>
                        <td className="py-3 text-right text-red-600">{formatCurrency(entry?.totalDeductions || 0)}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(entry?.netPay || 0)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {entry && (
                            <button
                              onClick={() => handlePrintPayslip(run, entry)}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Print payslip"
                            >
                              <PrinterIcon className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Contact Information</h2>
            <dl className="space-y-3">
              {employee.email && (
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                  <dd className="text-gray-900">{employee.email}</dd>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-3">
                  <PhoneIcon className="w-5 h-5 text-gray-400" />
                  <dd className="text-gray-900">{employee.phone}</dd>
                </div>
              )}
              {employee.address && (
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <dd className="text-gray-900">
                    {employee.address.street}
                    <br />
                    {employee.address.city}, {employee.address.parish}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Employment Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Employment Details</h2>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <dt className="text-xs text-gray-500">Hire Date</dt>
                  <dd className="text-gray-900">{format(new Date(employee.hireDate), 'MMM dd, yyyy')}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Employee Number</dt>
                <dd className="text-gray-900">{employee.employeeNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">TRN</dt>
                <dd className="text-gray-900">{employee.trnNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">NIS</dt>
                <dd className="text-gray-900">{employee.nisNumber}</dd>
              </div>
            </dl>
          </div>

          {/* Bank Info */}
          {employee.bankName && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Bank Information</h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-gray-500">Bank</dt>
                  <dd className="text-gray-900">{employee.bankName}</dd>
                </div>
                {employee.bankAccountNumber && (
                  <div>
                    <dt className="text-xs text-gray-500">Account Number</dt>
                    <dd className="text-gray-900">****{employee.bankAccountNumber.slice(-4)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
