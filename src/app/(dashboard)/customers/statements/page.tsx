'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/lib/utils';
import { printContent, generateTable, formatTRN, downloadAsCSV } from '@/lib/print';
import { useCurrency } from '@/hooks/useCurrency';
import { api } from '@/lib/api-client';
import {
  PrinterIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  UserGroupIcon,
  CalendarIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface StatementLine {
  date: string;
  type: 'Invoice' | 'Payment' | 'Credit Note';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

// ============================================
// CUSTOMER STATEMENTS PAGE
// ============================================

export default function CustomerStatementsPage() {
  const { fc, fcp } = useCurrency();
  const { customers, invoices, activeCompany } = useAppStore();

  // Filter customers belonging to active company (customers & both)
  const companyCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.companyId === activeCompany?.id &&
          (c.type === 'customer' || c.type === 'both')
      ),
    [customers, activeCompany?.id]
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
      .toISOString()
      .split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const selectedCustomer = useMemo(
    () => companyCustomers.find((c) => c.id === selectedCustomerId) || null,
    [companyCustomers, selectedCustomerId]
  );

  const filteredDropdownCustomers = useMemo(() => {
    if (!customerSearch.trim()) return companyCustomers;
    const query = customerSearch.toLowerCase();
    return companyCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
    );
  }, [companyCustomers, customerSearch]);

  // ============================================
  // GENERATE STATEMENT DATA
  // ============================================

  const statementData = useMemo(() => {
    if (!selectedCustomer) return null;

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    // Get all invoices for this customer in the active company
    const customerInvoices = invoices
      .filter(
        (inv) =>
          inv.customerId === selectedCustomer.id &&
          inv.companyId === activeCompany?.id &&
          inv.status !== 'draft' &&
          inv.status !== 'cancelled'
      )
      .sort(
        (a, b) =>
          new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
      );

    // Build transaction lines
    const lines: StatementLine[] = [];

    // Calculate opening balance from invoices before the start date
    let openingBalance = 0;
    customerInvoices.forEach((inv) => {
      const invDate = new Date(inv.issueDate);
      if (invDate < startDate) {
        openingBalance += inv.total;
        // Subtract payments made on invoices before period
        if (inv.amountPaid > 0) {
          openingBalance -= inv.amountPaid;
        }
      }
    });

    // Build lines for invoices within the date range
    customerInvoices.forEach((inv) => {
      const invDate = new Date(inv.issueDate);
      if (invDate >= startDate && invDate <= endDate) {
        // Invoice line (debit)
        lines.push({
          date: inv.issueDate,
          type: 'Invoice',
          reference: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber}${inv.items.length > 0 ? ` - ${inv.items.length} item${inv.items.length > 1 ? 's' : ''}` : ''}`,
          debit: inv.total,
          credit: 0,
          runningBalance: 0, // Calculated below
        });

        // Payment line (credit) - if any payment has been made
        if (inv.amountPaid > 0) {
          const paymentDateStr = inv.paidDate || inv.issueDate;
          const paymentDate = new Date(paymentDateStr);
          // Only include payment if it falls in the date range
          if (paymentDate >= startDate && paymentDate <= endDate) {
            lines.push({
              date: paymentDateStr,
              type: 'Payment',
              reference: `PMT-${inv.invoiceNumber}`,
              description: `Payment received for ${inv.invoiceNumber}`,
              debit: 0,
              credit: inv.amountPaid,
              runningBalance: 0,
            });
          }
        }
      }
    });

    // Sort lines by date, then invoices before payments on same date
    lines.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      // Invoices before payments on the same date
      if (a.type === 'Invoice' && b.type === 'Payment') return -1;
      if (a.type === 'Payment' && b.type === 'Invoice') return 1;
      return 0;
    });

    // Calculate running balances
    let balance = openingBalance;
    lines.forEach((line) => {
      balance += Number(line.debit || 0) - Number(line.credit || 0);
      line.runningBalance = balance;
    });

    const closingBalance = balance;
    const totalInvoiced = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalPayments = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    const totalCredits = lines
      .filter((l) => l.type === 'Credit Note')
      .reduce((sum, l) => sum + Number(l.credit || 0), 0);

    return {
      openingBalance,
      closingBalance,
      totalInvoiced,
      totalPayments,
      totalCredits,
      lines,
    };
  }, [selectedCustomer, invoices, activeCompany?.id, dateRange]);

  // ============================================
  // PRINT STATEMENT
  // ============================================

  const handlePrintStatement = () => {
    if (!selectedCustomer || !statementData) return;

    const periodLabel = `${formatDate(new Date(dateRange.start))} - ${formatDate(new Date(dateRange.end))}`;

    const customerInfoHtml = `
      <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
        <div>
          <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#1f2937;">Statement To:</h3>
          <p style="margin:2px 0;font-size:14px;font-weight:600;">${selectedCustomer.name}</p>
          ${selectedCustomer.companyName ? `<p style="margin:2px 0;font-size:13px;color:#6b7280;">${selectedCustomer.companyName}</p>` : ''}
          ${selectedCustomer.email ? `<p style="margin:2px 0;font-size:13px;color:#6b7280;">${selectedCustomer.email}</p>` : ''}
          ${selectedCustomer.phone ? `<p style="margin:2px 0;font-size:13px;color:#6b7280;">${selectedCustomer.phone}</p>` : ''}
          ${selectedCustomer.trnNumber ? `<p style="margin:2px 0;font-size:13px;color:#6b7280;">TRN: ${selectedCustomer.trnNumber}</p>` : ''}
        </div>
        <div style="text-align:right;">
          <p style="margin:2px 0;font-size:13px;color:#6b7280;">Statement Period</p>
          <p style="margin:2px 0;font-size:14px;font-weight:600;">${periodLabel}</p>
          <p style="margin:10px 0 2px;font-size:13px;color:#6b7280;">Statement Date</p>
          <p style="margin:2px 0;font-size:14px;font-weight:600;">${formatDate(new Date())}</p>
        </div>
      </div>
    `;

    const openingRow = `
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;" colspan="5"><strong>Opening Balance</strong></td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>${fcp(statementData.openingBalance)}</strong></td>
      </tr>
    `;

    const transactionTable = generateTable(
      [
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Type' },
        { key: 'reference', label: 'Reference' },
        { key: 'description', label: 'Description' },
        { key: 'debit', label: 'Debit', align: 'right' },
        { key: 'credit', label: 'Credit', align: 'right' },
        { key: 'balance', label: 'Balance', align: 'right' },
      ],
      statementData.lines.map((line) => ({
        date: formatDate(line.date),
        type: line.type,
        reference: line.reference,
        description: line.description,
        debit: line.debit > 0 ? line.debit : '',
        credit: line.credit > 0 ? line.credit : '',
        balance: line.runningBalance,
      })),
      {
        formatters: {
          debit: (v: number | string) =>
            typeof v === 'number' ? fcp(v) : '',
          credit: (v: number | string) =>
            typeof v === 'number' ? fcp(v) : '',
          balance: (v: number) => fcp(v),
        },
        summaryRow: {
          date: '',
          type: '',
          reference: '',
          description: 'Closing Balance',
          debit: statementData.totalInvoiced,
          credit: statementData.totalPayments,
          balance: statementData.closingBalance,
        },
      }
    );

    const summaryHtml = `
      <div style="margin-top:30px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
          <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Total Invoiced</p>
          <p style="font-size:20px;font-weight:bold;color:#dc2626;margin:0;">${fcp(statementData.totalInvoiced)}</p>
        </div>
        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
          <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Total Payments</p>
          <p style="font-size:20px;font-weight:bold;color:#059669;margin:0;">${fcp(statementData.totalPayments)}</p>
        </div>
        <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
          <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Amount Due</p>
          <p style="font-size:20px;font-weight:bold;color:#1f2937;margin:0;">${fcp(statementData.closingBalance)}</p>
        </div>
      </div>
      <div style="margin-top:30px;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
        <p style="font-size:14px;color:#374151;margin:0;">
          Please remit payment at your earliest convenience. Thank you for your continued business.
        </p>
      </div>
    `;

    const content = customerInfoHtml + transactionTable + summaryHtml;

    printContent({
      title: 'Customer Statement',
      subtitle: periodLabel,
      companyName: activeCompany?.businessName,
      companyTrn: activeCompany?.trnNumber,
      companyGct: activeCompany?.gctRegistered ? activeCompany?.gctNumber : undefined,
      content,
      footer: `${activeCompany?.businessName || 'YaadBooks'} | ${activeCompany?.phone || ''} | ${activeCompany?.email || ''} | Generated on ${formatDate(new Date())}`,
    });
  };

  // ============================================
  // DOWNLOAD CSV
  // ============================================

  const handleDownloadCSV = () => {
    if (!selectedCustomer || !statementData) return;

    const csvData = [
      {
        Date: '',
        Type: '',
        Reference: '',
        Description: 'Opening Balance',
        Debit: '',
        Credit: '',
        Balance: statementData.openingBalance.toFixed(2),
      },
      ...statementData.lines.map((line) => ({
        Date: formatDate(line.date),
        Type: line.type,
        Reference: line.reference,
        Description: line.description,
        Debit: line.debit > 0 ? line.debit.toFixed(2) : '',
        Credit: line.credit > 0 ? line.credit.toFixed(2) : '',
        Balance: line.runningBalance.toFixed(2),
      })),
      {
        Date: '',
        Type: '',
        Reference: '',
        Description: 'Closing Balance',
        Debit: statementData.totalInvoiced.toFixed(2),
        Credit: statementData.totalPayments.toFixed(2),
        Balance: statementData.closingBalance.toFixed(2),
      },
    ];

    const filename = `statement-${selectedCustomer.name.replace(/\s+/g, '-').toLowerCase()}-${dateRange.start}-to-${dateRange.end}`;
    downloadAsCSV(csvData, filename);
  };

  // ============================================
  // EMAIL STATEMENT
  // ============================================

  const [emailSending, setEmailSending] = useState(false);

  const handleEmailStatement = async () => {
    if (!selectedCustomer) return;

    if (!selectedCustomer.email) {
      alert(
        `No email address on file for ${selectedCustomer.name}. Please update the customer record with an email address.`
      );
      return;
    }

    setEmailSending(true);
    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/statement/email`, {
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      alert(`Statement emailed to ${selectedCustomer.email} successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to email statement. Please try again.');
    } finally {
      setEmailSending(false);
    }
  };

  // ============================================
  // GENERATE ALL STATEMENTS
  // ============================================

  const [batchSending, setBatchSending] = useState(false);

  const handleGenerateAll = async () => {
    const customersWithInvoices = companyCustomers.filter((c) =>
      invoices.some(
        (inv) =>
          inv.customerId === c.id &&
          inv.companyId === activeCompany?.id &&
          inv.status !== 'draft' &&
          inv.status !== 'cancelled'
      )
    );

    if (customersWithInvoices.length === 0) {
      alert('No customers with invoices found for the selected period.');
      return;
    }

    const customersWithEmail = customersWithInvoices.filter((c) => c.email);
    const customersWithoutEmail = customersWithInvoices.filter((c) => !c.email);

    if (customersWithEmail.length === 0) {
      alert('No customers with email addresses found. Please update customer records with email addresses.');
      return;
    }

    const confirmMessage = customersWithoutEmail.length > 0
      ? `Send statements to ${customersWithEmail.length} customer(s) with email addresses?\n\n${customersWithoutEmail.length} customer(s) without email will be skipped.`
      : `Send statements to ${customersWithEmail.length} customer(s)?`;

    if (!confirm(confirmMessage)) return;

    setBatchSending(true);
    let sentCount = 0;
    let failedCount = 0;

    for (const customer of customersWithEmail) {
      try {
        await api.post(`/api/v1/customers/${customer.id}/statement/email`, {
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    setBatchSending(false);

    const resultMessage = failedCount > 0
      ? `Statements sent: ${sentCount}. Failed: ${failedCount}.`
      : `All ${sentCount} statement(s) sent successfully.`;

    if (customersWithoutEmail.length > 0) {
      alert(`${resultMessage}\n\nSkipped ${customersWithoutEmail.length} customer(s) without email:\n${customersWithoutEmail.map((c) => `- ${c.name}`).join('\n')}`);
    } else {
      alert(resultMessage);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customer Statements
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Generate and send account statements to your customers
          </p>
        </div>
        <Button
          icon={<UserGroupIcon className="w-4 h-4" />}
          onClick={handleGenerateAll}
          variant="outline"
          loading={batchSending}
          disabled={batchSending}
        >
          {batchSending ? 'Sending Statements...' : 'Generate All Statements'}
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Customer Selector */}
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <span
                    className={
                      selectedCustomer ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                    }
                  >
                    {selectedCustomer
                      ? selectedCustomer.name
                      : 'Select a customer...'}
                  </span>
                  <ChevronDownIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </button>

                {showCustomerDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/20 max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredDropdownCustomers.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No customers found
                        </div>
                      ) : (
                        filteredDropdownCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setShowCustomerDropdown(false);
                              setCustomerSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors ${
                              c.id === selectedCustomerId
                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <div className="font-medium">{c.name}</div>
                            {c.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {c.email}
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From
                </label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                  className="w-40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To
                </label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                  className="w-40"
                />
              </div>
              <div className="flex gap-2">
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
                      start: new Date(now.getFullYear(), now.getMonth() - 3, 1)
                        .toISOString()
                        .split('T')[0],
                      end: now.toISOString().split('T')[0],
                    });
                  }}
                >
                  Last 3 Months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    setDateRange({
                      start: new Date(now.getFullYear(), 0, 1)
                        .toISOString()
                        .split('T')[0],
                      end: now.toISOString().split('T')[0],
                    });
                  }}
                >
                  YTD
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Close dropdown on outside click */}
      {showCustomerDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowCustomerDropdown(false)}
        />
      )}

      {/* Statement Content */}
      {!selectedCustomer ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Customer
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Choose a customer from the dropdown above to generate their account
              statement for the selected period.
            </p>
          </CardContent>
        </Card>
      ) : !statementData || statementData.lines.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Transactions Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              No invoices or payments were found for{' '}
              <strong>{selectedCustomer.name}</strong> during the selected
              period. Try adjusting the date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              icon={<PrinterIcon className="w-4 h-4" />}
              onClick={handlePrintStatement}
            >
              Print Statement
            </Button>
            <Button
              variant="outline"
              icon={<ArrowDownTrayIcon className="w-4 h-4" />}
              onClick={handleDownloadCSV}
            >
              Download CSV
            </Button>
            <Button
              variant="outline"
              icon={<EnvelopeIcon className="w-4 h-4" />}
              onClick={handleEmailStatement}
              loading={emailSending}
              disabled={emailSending}
            >
              {emailSending ? 'Sending...' : 'Email Statement'}
            </Button>
          </div>

          {/* Statement Card */}
          <Card padding="none">
            <div className="p-6">
              {/* Statement Header */}
              <div className="flex flex-col md:flex-row md:justify-between gap-6 mb-8 pb-6 border-b-2 border-emerald-600">
                {/* Company Info */}
                <div>
                  <h2 className="text-xl font-bold text-emerald-600 mb-1">
                    {activeCompany?.businessName || 'Your Company'}
                  </h2>
                  {activeCompany?.tradingName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Trading as: {activeCompany.tradingName}
                    </p>
                  )}
                  {activeCompany?.address && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {typeof activeCompany.address === 'string'
                        ? activeCompany.address
                        : `${activeCompany.address.street}, ${activeCompany.address.city}`}
                    </p>
                  )}
                  {activeCompany?.phone && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activeCompany.phone}
                    </p>
                  )}
                  {activeCompany?.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activeCompany.email}
                    </p>
                  )}
                  {activeCompany?.trnNumber && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      TRN: {formatTRN(activeCompany.trnNumber)}
                    </p>
                  )}
                  {activeCompany?.gctRegistered && activeCompany?.gctNumber && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      GCT Reg: {activeCompany.gctNumber}
                    </p>
                  )}
                </div>

                {/* Statement Title & Period */}
                <div className="text-right">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    STATEMENT
                  </h3>
                  <div className="space-y-1">
                    <div className="flex justify-end gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Statement Date:</span>
                      <span className="font-medium">
                        {formatDate(new Date())}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Period:</span>
                      <span className="font-medium">
                        {formatDate(new Date(dateRange.start))} -{' '}
                        {formatDate(new Date(dateRange.end))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Bill To
                </h4>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selectedCustomer.name}
                </p>
                {selectedCustomer.companyName && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedCustomer.companyName}
                  </p>
                )}
                {selectedCustomer.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCustomer.email}
                  </p>
                )}
                {selectedCustomer.phone && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedCustomer.phone}
                  </p>
                )}
                {selectedCustomer.trnNumber && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    TRN: {selectedCustomer.trnNumber}
                  </p>
                )}
              </div>

              {/* Opening Balance */}
              <div className="flex justify-between items-center py-3 px-4 bg-gray-100 dark:bg-gray-700 rounded-t-lg border border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Opening Balance
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {fc(statementData.openingBalance)}
                </span>
              </div>

              {/* Transactions Table */}
              <div className="border-x border-gray-200 dark:border-gray-700 overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Date
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Reference
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Description
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Debit
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Credit
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementData.lines.map((line, index) => (
                      <tr
                        key={`${line.reference}-${index}`}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(line.date)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              line.type === 'Invoice'
                                ? 'warning'
                                : line.type === 'Payment'
                                  ? 'success'
                                  : 'info'
                            }
                            size="sm"
                          >
                            {line.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                          {line.reference}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {line.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                          {line.debit > 0 ? fc(line.debit) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                          {line.credit > 0 ? fc(line.credit) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          {fc(line.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Closing Balance */}
              <div className="flex justify-between items-center py-3 px-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-b-lg border border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-emerald-800">
                  Closing Balance
                </span>
                <span className="font-bold text-lg text-emerald-800">
                  {fc(statementData.closingBalance)}
                </span>
              </div>

              {/* Summary Section */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800 text-center">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">
                    Total Invoiced
                  </p>
                  <p className="text-xl font-bold text-red-700">
                    {fc(statementData.totalInvoiced)}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-800 text-center">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">
                    Total Payments
                  </p>
                  <p className="text-xl font-bold text-emerald-700">
                    {fc(statementData.totalPayments)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Amount Due
                  </p>
                  <p
                    className={`text-xl font-bold ${statementData.closingBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}
                  >
                    {fc(statementData.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Footer Message */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please remit payment at your earliest convenience. Thank you
                  for your continued business.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  If you have any questions regarding this statement, please
                  contact us at{' '}
                  {activeCompany?.email || 'your company email'}.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
