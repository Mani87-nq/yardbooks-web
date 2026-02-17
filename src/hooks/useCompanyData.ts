// YardBooks Web - Company-Aware Data Hooks
// These hooks filter all data by the active company

import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * Hook to get the active company ID
 */
export function useActiveCompanyId(): string | null {
  return useAppStore((state) => state.activeCompany?.id ?? null);
}

/**
 * Hook to get customers filtered by active company
 */
export function useCompanyCustomers() {
  const customers = useAppStore((state) => state.customers);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return customers.filter((c) => c.companyId === activeCompanyId);
  }, [customers, activeCompanyId]);
}

/**
 * Hook to get products filtered by active company
 */
export function useCompanyProducts() {
  const products = useAppStore((state) => state.products);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return products.filter((p) => p.companyId === activeCompanyId);
  }, [products, activeCompanyId]);
}

/**
 * Hook to get invoices filtered by active company
 */
export function useCompanyInvoices() {
  const invoices = useAppStore((state) => state.invoices);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return invoices.filter((i) => i.companyId === activeCompanyId);
  }, [invoices, activeCompanyId]);
}

/**
 * Hook to get quotations filtered by active company
 */
export function useCompanyQuotations() {
  const quotations = useAppStore((state) => state.quotations);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return quotations.filter((q) => q.companyId === activeCompanyId);
  }, [quotations, activeCompanyId]);
}

/**
 * Hook to get expenses filtered by active company
 */
export function useCompanyExpenses() {
  const expenses = useAppStore((state) => state.expenses);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return expenses.filter((e) => e.companyId === activeCompanyId);
  }, [expenses, activeCompanyId]);
}

/**
 * Hook to get employees filtered by active company
 */
export function useCompanyEmployees() {
  const employees = useAppStore((state) => state.employees);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return employees.filter((e) => e.companyId === activeCompanyId);
  }, [employees, activeCompanyId]);
}

/**
 * Hook to get payroll runs filtered by active company
 */
export function useCompanyPayrollRuns() {
  const payrollRuns = useAppStore((state) => state.payrollRuns);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return payrollRuns.filter((pr) => pr.companyId === activeCompanyId);
  }, [payrollRuns, activeCompanyId]);
}

/**
 * Hook to get bank accounts filtered by active company
 */
export function useCompanyBankAccounts() {
  const bankAccounts = useAppStore((state) => state.bankAccounts);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return bankAccounts.filter((ba) => ba.companyId === activeCompanyId);
  }, [bankAccounts, activeCompanyId]);
}

/**
 * Hook to get bank transactions for active company's accounts
 */
export function useCompanyBankTransactions() {
  const bankTransactions = useAppStore((state) => state.bankTransactions);
  const companyBankAccounts = useCompanyBankAccounts();

  return useMemo(() => {
    const accountIds = new Set(companyBankAccounts.map((ba) => ba.id));
    return bankTransactions.filter((bt) => accountIds.has(bt.bankAccountId));
  }, [bankTransactions, companyBankAccounts]);
}

/**
 * Hook to get GL accounts filtered by active company
 */
export function useCompanyGLAccounts() {
  const glAccounts = useAppStore((state) => state.glAccounts);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return glAccounts.filter((gl) => gl.companyId === activeCompanyId);
  }, [glAccounts, activeCompanyId]);
}

/**
 * Hook to get journal entries filtered by active company
 */
export function useCompanyJournalEntries() {
  const journalEntries = useAppStore((state) => state.journalEntries);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return journalEntries.filter((je) => je.companyId === activeCompanyId);
  }, [journalEntries, activeCompanyId]);
}

/**
 * Hook to get fixed assets filtered by active company
 */
export function useCompanyFixedAssets() {
  const fixedAssets = useAppStore((state) => state.fixedAssets);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return fixedAssets.filter((fa) => fa.companyId === activeCompanyId);
  }, [fixedAssets, activeCompanyId]);
}

/**
 * Hook to get customer POs filtered by active company
 */
export function useCompanyCustomerPOs() {
  const customerPOs = useAppStore((state) => state.customerPOs);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return customerPOs.filter((po) => po.companyId === activeCompanyId);
  }, [customerPOs, activeCompanyId]);
}

/**
 * Hook to get parking slips filtered by active company
 */
export function useCompanyParkingSlips() {
  const parkingSlips = useAppStore((state) => state.parkingSlips);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return parkingSlips.filter((ps) => ps.companyId === activeCompanyId);
  }, [parkingSlips, activeCompanyId]);
}

/**
 * Hook to get notifications filtered by active company
 */
export function useCompanyNotifications() {
  const notifications = useAppStore((state) => state.notifications);
  const activeCompanyId = useActiveCompanyId();

  return useMemo(() => {
    if (!activeCompanyId) return [];
    return notifications.filter((n) => n.companyId === activeCompanyId);
  }, [notifications, activeCompanyId]);
}

// ============================================
// DASHBOARD SUMMARY HOOKS
// ============================================

/**
 * Hook to get dashboard summary data for the active company
 */
export function useCompanyDashboardSummary() {
  const invoices = useCompanyInvoices();
  const expenses = useCompanyExpenses();
  const customers = useCompanyCustomers();
  const products = useCompanyProducts();

  return useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Revenue calculations
    const thisMonthRevenue = invoices
      .filter((inv) => inv.status === 'paid' && new Date(inv.paidDate || inv.createdAt) >= thisMonthStart)
      .reduce((sum, inv) => sum + inv.total, 0);

    const lastMonthRevenue = invoices
      .filter((inv) => {
        const paidDate = new Date(inv.paidDate || inv.createdAt);
        return inv.status === 'paid' && paidDate >= lastMonthStart && paidDate <= lastMonthEnd;
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    // Expenses this month
    const thisMonthExpenses = expenses
      .filter((exp) => new Date(exp.date) >= thisMonthStart)
      .reduce((sum, exp) => sum + exp.amount, 0);

    // Outstanding invoices
    const outstandingInvoices = invoices
      .filter((inv) => ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.balance, 0);

    // Overdue invoices
    const overdueInvoices = invoices
      .filter((inv) => inv.status === 'overdue' || (inv.balance > 0 && new Date(inv.dueDate) < now));

    return {
      thisMonthRevenue,
      lastMonthRevenue,
      revenueChange: lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0,
      thisMonthExpenses,
      netIncome: thisMonthRevenue - thisMonthExpenses,
      outstandingInvoices,
      overdueCount: overdueInvoices.length,
      overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0),
      totalCustomers: customers.length,
      totalProducts: products.length,
      lowStockProducts: products.filter((p) => p.quantity <= p.reorderLevel).length,
    };
  }, [invoices, expenses, customers, products]);
}
