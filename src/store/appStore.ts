// YaadBooks Web - Main App Store
import { create } from 'zustand';
import type {
  User,
  Company,
  Customer,
  Product,
  Invoice,
  Quotation,
  Expense,
  Employee,
  PayrollRun,
  AppSettings,
} from '@/types';
import type { GLAccount, JournalEntry } from '@/types/generalLedger';
import type { FixedAsset } from '@/types/fixedAssets';
import type { BankAccount, BankTransaction } from '@/types/banking';
import type { CustomerPurchaseOrder } from '@/types/customerPO';
import type { ParkingSlip } from '@/types/parkingSlip';
import type { Notification } from '@/types/notifications';

// ============================================
// APP STORE
// ============================================

interface AppState {
  // User/Business
  user: User | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;

  // Companies (Multi-Company Support)
  companies: Company[];
  activeCompany: Company | null;

  // Settings
  settings: AppSettings;

  // Data
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  quotations: Quotation[];
  expenses: Expense[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  glAccounts: GLAccount[];
  journalEntries: JournalEntry[];
  fixedAssets: FixedAsset[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  customerPOs: CustomerPurchaseOrder[];
  parkingSlips: ParkingSlip[];
  notifications: Notification[];

  // RBAC — the user's role in the active company (set during hydration)
  userRole: string | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;

  // Hydration flag — set to true once useDataHydration finishes loading API data
  hydrated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  setUserRole: (role: string | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Company actions
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, company: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  setActiveCompany: (company: Company | null) => void;
  switchCompany: (companyId: string) => void;

  // Customer actions
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Product actions
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  updateProductQuantity: (id: string, quantity: number) => void;

  // Invoice actions
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  // Quotation actions
  setQuotations: (quotations: Quotation[]) => void;
  addQuotation: (quotation: Quotation) => void;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => void;
  deleteQuotation: (id: string) => void;

  // Expense actions
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Employee actions
  setEmployees: (employees: Employee[]) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Payroll actions
  setPayrollRuns: (payrollRuns: PayrollRun[]) => void;
  addPayrollRun: (payrollRun: PayrollRun) => void;
  updatePayrollRun: (id: string, payrollRun: Partial<PayrollRun>) => void;

  // GL Account actions
  setGLAccounts: (accounts: GLAccount[]) => void;
  addGLAccount: (account: GLAccount) => void;
  updateGLAccount: (id: string, account: Partial<GLAccount>) => void;
  deleteGLAccount: (id: string) => void;

  // Journal Entry actions
  setJournalEntries: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, entry: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  // Fixed Asset actions
  setFixedAssets: (assets: FixedAsset[]) => void;
  addFixedAsset: (asset: FixedAsset) => void;
  updateFixedAsset: (id: string, asset: Partial<FixedAsset>) => void;
  deleteFixedAsset: (id: string) => void;

  // Bank Account actions
  setBankAccounts: (accounts: BankAccount[]) => void;
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (id: string, account: Partial<BankAccount>) => void;
  deleteBankAccount: (id: string) => void;

  // Bank Transaction actions
  setBankTransactions: (transactions: BankTransaction[]) => void;
  addBankTransaction: (transaction: BankTransaction) => void;
  updateBankTransaction: (id: string, transaction: Partial<BankTransaction>) => void;
  deleteBankTransaction: (id: string) => void;

  // Customer PO actions
  setCustomerPOs: (pos: CustomerPurchaseOrder[]) => void;
  addCustomerPO: (po: CustomerPurchaseOrder) => void;
  updateCustomerPO: (id: string, po: Partial<CustomerPurchaseOrder>) => void;
  deleteCustomerPO: (id: string) => void;

  // Parking Slip actions
  setParkingSlips: (slips: ParkingSlip[]) => void;
  addParkingSlip: (slip: ParkingSlip) => void;
  updateParkingSlip: (id: string, slip: Partial<ParkingSlip>) => void;
  deleteParkingSlip: (id: string) => void;

  // Notification actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Clear all company-scoped cached data (used when switching companies)
  clearCompanyData: () => void;

  // Reset
  reset: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'light',
  language: 'english',
  currency: 'JMD',
  dateFormat: 'DD/MM/YYYY',
  invoicePrefix: 'INV-',
  quotationPrefix: 'QUO-',
  defaultPaymentTerms: 30,
  defaultGCTRate: 'standard',
  enableNotifications: true,
  autoBackup: true,
  dashboardWidgets: {
    cashFlow: true,
    profitLoss: true,
    invoices: true,
    expenses: true,
    inventory: true,
    activity: true,
  },
};

const initialState = {
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  companies: [],
  activeCompany: null,
  settings: defaultSettings,
  customers: [],
  products: [],
  invoices: [],
  quotations: [],
  expenses: [],
  employees: [],
  payrollRuns: [],
  glAccounts: [],
  journalEntries: [],
  fixedAssets: [],
  bankAccounts: [],
  bankTransactions: [],
  customerPOs: [],
  parkingSlips: [],
  notifications: [],
  userRole: null,
  isLoading: false,
  error: null,
  sidebarOpen: true,
  hydrated: false,
};

export const useAppStore = create<AppState>()(
  (set, get) => ({
    ...initialState,

    // User actions
    setUser: (user) => set({ user }),
    updateUser: (updates) =>
      set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    setUserRole: (userRole) => set({ userRole }),
    setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setOnboarded: (isOnboarded) => set({ isOnboarded }),
    updateSettings: (newSettings) =>
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),

    // Company actions
    setCompanies: (companies) => set({ companies }),
    addCompany: (company) =>
      set((state) => ({ companies: [...state.companies, company] })),
    updateCompany: (id, company) =>
      set((state) => ({
        companies: state.companies.map((c) =>
          c.id === id ? { ...c, ...company } : c
        ),
        activeCompany:
          state.activeCompany?.id === id
            ? { ...state.activeCompany, ...company }
            : state.activeCompany,
      })),
    deleteCompany: (id) =>
      set((state) => ({
        companies: state.companies.filter((c) => c.id !== id),
        activeCompany:
          state.activeCompany?.id === id ? null : state.activeCompany,
      })),
    setActiveCompany: (activeCompany) => set({ activeCompany }),
    switchCompany: (companyId) =>
      set((state) => {
        const company = state.companies.find((c) => c.id === companyId);
        return {
          activeCompany: company || null,
          user: state.user
            ? { ...state.user, activeCompanyId: companyId }
            : null,
        };
      }),

    // Customer actions
    setCustomers: (customers) => set({ customers }),
    addCustomer: (customer) =>
      set((state) => ({ customers: [...state.customers, customer] })),
    updateCustomer: (id, customer) =>
      set((state) => ({
        customers: state.customers.map((c) =>
          c.id === id ? { ...c, ...customer } : c
        ),
      })),
    deleteCustomer: (id) =>
      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
      })),

    // Product actions
    setProducts: (products) => set({ products }),
    addProduct: (product) =>
      set((state) => ({ products: [...state.products, product] })),
    updateProduct: (id, product) =>
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, ...product } : p
        ),
      })),
    deleteProduct: (id) =>
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),
    updateProductQuantity: (id, quantity) =>
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, quantity } : p
        ),
      })),

    // Invoice actions
    setInvoices: (invoices) => set({ invoices }),
    addInvoice: (invoice) =>
      set((state) => ({ invoices: [...state.invoices, invoice] })),
    updateInvoice: (id, invoice) =>
      set((state) => ({
        invoices: state.invoices.map((i) =>
          i.id === id ? { ...i, ...invoice } : i
        ),
      })),
    deleteInvoice: (id) =>
      set((state) => ({
        invoices: state.invoices.filter((i) => i.id !== id),
      })),

    // Quotation actions
    setQuotations: (quotations) => set({ quotations }),
    addQuotation: (quotation) =>
      set((state) => ({ quotations: [...state.quotations, quotation] })),
    updateQuotation: (id, quotation) =>
      set((state) => ({
        quotations: state.quotations.map((q) =>
          q.id === id ? { ...q, ...quotation } : q
        ),
      })),
    deleteQuotation: (id) =>
      set((state) => ({
        quotations: state.quotations.filter((q) => q.id !== id),
      })),

    // Expense actions
    setExpenses: (expenses) => set({ expenses }),
    addExpense: (expense) =>
      set((state) => ({ expenses: [...state.expenses, expense] })),
    updateExpense: (id, expense) =>
      set((state) => ({
        expenses: state.expenses.map((e) =>
          e.id === id ? { ...e, ...expense } : e
        ),
      })),
    deleteExpense: (id) =>
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== id),
      })),

    // Employee actions
    setEmployees: (employees) => set({ employees }),
    addEmployee: (employee) =>
      set((state) => ({ employees: [...state.employees, employee] })),
    updateEmployee: (id, employee) =>
      set((state) => ({
        employees: state.employees.map((e) =>
          e.id === id ? { ...e, ...employee } : e
        ),
      })),
    deleteEmployee: (id) =>
      set((state) => ({
        employees: state.employees.filter((e) => e.id !== id),
      })),

    // Payroll actions
    setPayrollRuns: (payrollRuns) => set({ payrollRuns }),
    addPayrollRun: (payrollRun) =>
      set((state) => ({ payrollRuns: [...state.payrollRuns, payrollRun] })),
    updatePayrollRun: (id, payrollRun) =>
      set((state) => ({
        payrollRuns: state.payrollRuns.map((p) =>
          p.id === id ? { ...p, ...payrollRun } : p
        ),
      })),

    // GL Account actions
    setGLAccounts: (glAccounts) => set({ glAccounts }),
    addGLAccount: (account) =>
      set((state) => ({ glAccounts: [...state.glAccounts, account] })),
    updateGLAccount: (id, account) =>
      set((state) => ({
        glAccounts: state.glAccounts.map((a) =>
          a.id === id ? { ...a, ...account } : a
        ),
      })),
    deleteGLAccount: (id) =>
      set((state) => ({
        glAccounts: state.glAccounts.filter((a) => a.id !== id),
      })),

    // Journal Entry actions
    setJournalEntries: (journalEntries) => set({ journalEntries }),
    addJournalEntry: (entry) =>
      set((state) => ({ journalEntries: [...state.journalEntries, entry] })),
    updateJournalEntry: (id, entry) =>
      set((state) => ({
        journalEntries: state.journalEntries.map((e) =>
          e.id === id ? { ...e, ...entry } : e
        ),
      })),
    deleteJournalEntry: (id) =>
      set((state) => ({
        journalEntries: state.journalEntries.filter((e) => e.id !== id),
      })),

    // Fixed Asset actions
    setFixedAssets: (fixedAssets) => set({ fixedAssets }),
    addFixedAsset: (asset) =>
      set((state) => ({ fixedAssets: [...state.fixedAssets, asset] })),
    updateFixedAsset: (id, asset) =>
      set((state) => ({
        fixedAssets: state.fixedAssets.map((a) =>
          a.id === id ? { ...a, ...asset } : a
        ),
      })),
    deleteFixedAsset: (id) =>
      set((state) => ({
        fixedAssets: state.fixedAssets.filter((a) => a.id !== id),
      })),

    // Bank Account actions
    setBankAccounts: (bankAccounts) => set({ bankAccounts }),
    addBankAccount: (account) =>
      set((state) => ({ bankAccounts: [...state.bankAccounts, account] })),
    updateBankAccount: (id, account) =>
      set((state) => ({
        bankAccounts: state.bankAccounts.map((a) =>
          a.id === id ? { ...a, ...account } : a
        ),
      })),
    deleteBankAccount: (id) =>
      set((state) => ({
        bankAccounts: state.bankAccounts.filter((a) => a.id !== id),
      })),

    // Bank Transaction actions
    setBankTransactions: (bankTransactions) => set({ bankTransactions }),
    addBankTransaction: (transaction) =>
      set((state) => ({ bankTransactions: [...state.bankTransactions, transaction] })),
    updateBankTransaction: (id, transaction) =>
      set((state) => ({
        bankTransactions: state.bankTransactions.map((t) =>
          t.id === id ? { ...t, ...transaction } : t
        ),
      })),
    deleteBankTransaction: (id) =>
      set((state) => ({
        bankTransactions: state.bankTransactions.filter((t) => t.id !== id),
      })),

    // Customer PO actions
    setCustomerPOs: (customerPOs) => set({ customerPOs }),
    addCustomerPO: (po) =>
      set((state) => ({ customerPOs: [...state.customerPOs, po] })),
    updateCustomerPO: (id, po) =>
      set((state) => ({
        customerPOs: state.customerPOs.map((p) =>
          p.id === id ? { ...p, ...po } : p
        ),
      })),
    deleteCustomerPO: (id) =>
      set((state) => ({
        customerPOs: state.customerPOs.filter((p) => p.id !== id),
      })),

    // Parking Slip actions
    setParkingSlips: (parkingSlips) => set({ parkingSlips }),
    addParkingSlip: (slip) =>
      set((state) => ({ parkingSlips: [...state.parkingSlips, slip] })),
    updateParkingSlip: (id, slip) =>
      set((state) => ({
        parkingSlips: state.parkingSlips.map((s) =>
          s.id === id ? { ...s, ...slip } : s
        ),
      })),
    deleteParkingSlip: (id) =>
      set((state) => ({
        parkingSlips: state.parkingSlips.filter((s) => s.id !== id),
      })),

    // Notification actions
    setNotifications: (notifications) => set({ notifications }),
    addNotification: (notification) =>
      set((state) => ({ notifications: [notification, ...state.notifications] })),
    markNotificationRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
      })),
    markAllNotificationsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      })),
    deleteNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    clearNotifications: () => set({ notifications: [] }),

    // UI actions
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    // Clear all company-scoped cached data (used when switching companies)
    clearCompanyData: () =>
      set({
        customers: [],
        products: [],
        invoices: [],
        quotations: [],
        expenses: [],
        employees: [],
        payrollRuns: [],
        glAccounts: [],
        journalEntries: [],
        fixedAssets: [],
        bankAccounts: [],
        bankTransactions: [],
        customerPOs: [],
        parkingSlips: [],
        notifications: [],
        hydrated: false,
      }),

    // Reset
    reset: () => set(initialState),
  })
);

// ============================================
// SELECTORS
// ============================================

export const useDashboardStats = () => {
  const allInvoices = useAppStore((state) => state.invoices);
  const allExpenses = useAppStore((state) => state.expenses);
  const allProducts = useAppStore((state) => state.products);
  const allCustomers = useAppStore((state) => state.customers);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);

  // Filter by active company
  const invoices = activeCompanyId ? allInvoices.filter((i) => i.companyId === activeCompanyId) : [];
  const expenses = activeCompanyId ? allExpenses.filter((e) => e.companyId === activeCompanyId) : [];
  const products = activeCompanyId ? allProducts.filter((p) => p.companyId === activeCompanyId) : [];
  const customers = activeCompanyId ? allCustomers.filter((c) => c.companyId === activeCompanyId) : [];

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const monthlyInvoices = invoices.filter(
    (inv) => new Date(inv.issueDate) >= startOfMonth
  );
  const monthlyExpenses = expenses.filter(
    (exp) => new Date(exp.date) >= startOfMonth
  );

  const totalReceivable = invoices
    .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.balance, 0);

  const totalRevenue = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalExpensesAmount = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status !== 'paid' &&
      inv.status !== 'cancelled' &&
      new Date(inv.dueDate) < today
  );

  const lowStockProducts = products.filter(
    (prod) => prod.isActive && prod.quantity <= prod.reorderLevel
  );

  return {
    totalReceivable,
    totalRevenue,
    totalExpenses: totalExpensesAmount,
    profit: totalRevenue - totalExpensesAmount,
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0),
    lowStockCount: lowStockProducts.length,
    customerCount: customers.filter((c) => c.type !== 'vendor').length,
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
  };
};

export const useActiveCustomers = () => {
  const customers = useAppStore((state) => state.customers);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return customers.filter((c) => c.companyId === activeCompanyId && (c.type === 'customer' || c.type === 'both'));
};

export const useActiveVendors = () => {
  const customers = useAppStore((state) => state.customers);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return customers.filter((c) => c.companyId === activeCompanyId && (c.type === 'vendor' || c.type === 'both'));
};

export const useActiveProducts = () => {
  const products = useAppStore((state) => state.products);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return products.filter((p) => p.companyId === activeCompanyId && p.isActive);
};

export const usePendingInvoices = () => {
  const invoices = useAppStore((state) => state.invoices);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return invoices.filter(
    (inv) =>
      inv.companyId === activeCompanyId &&
      inv.status !== 'paid' &&
      inv.status !== 'cancelled' &&
      inv.status !== 'draft'
  );
};

export const useRecentInvoices = (limit = 10) => {
  const invoices = useAppStore((state) => state.invoices);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return [...invoices]
    .filter((inv) => inv.companyId === activeCompanyId)
    .sort(
      (a, b) =>
        new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
    )
    .slice(0, limit);
};

export const useRecentExpenses = (limit = 10) => {
  const expenses = useAppStore((state) => state.expenses);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return [...expenses]
    .filter((exp) => exp.companyId === activeCompanyId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
};

export const useLowStockProducts = () => {
  const products = useAppStore((state) => state.products);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return products.filter(
    (prod) => prod.companyId === activeCompanyId && prod.isActive && prod.quantity <= prod.reorderLevel
  );
};

export const useActiveEmployees = () => {
  const employees = useAppStore((state) => state.employees);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return employees.filter((e) => e.companyId === activeCompanyId && e.isActive);
};

export const useUnreadNotifications = () => {
  const notifications = useAppStore((state) => state.notifications);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return notifications.filter((n) => n.companyId === activeCompanyId && !n.isRead && !n.isArchived);
};

export const useUnreadNotificationCount = () => {
  const notifications = useAppStore((state) => state.notifications);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return notifications.filter((n) => n.companyId === activeCompanyId && !n.isRead && !n.isArchived).length;
};

export const useActiveParkingSlips = () => {
  const parkingSlips = useAppStore((state) => state.parkingSlips);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return parkingSlips.filter((s) => s.companyId === activeCompanyId && s.status === 'active');
};

export const useOpenCustomerPOs = () => {
  const customerPOs = useAppStore((state) => state.customerPOs);
  const activeCompanyId = useAppStore((state) => state.activeCompany?.id);
  return customerPOs.filter(
    (po) => po.companyId === activeCompanyId && (po.status === 'open' || po.status === 'partially_invoiced')
  );
};
