'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { formatJMD, formatDate, formatDateTime } from '@/lib/utils';
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  useBankTransactions,
  useCreateBankTransaction,
} from '@/hooks/api';
import type { BankAccount, BankTransaction, BankReconciliation } from '@/types/banking';
import { PermissionGate } from '@/components/PermissionGate';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  BuildingLibraryIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const TRANSACTION_TYPES = [
  { value: 'deposit', label: 'Deposit', icon: ArrowDownIcon, color: 'text-emerald-600' },
  { value: 'withdrawal', label: 'Withdrawal', icon: ArrowUpIcon, color: 'text-red-600' },
  { value: 'transfer', label: 'Transfer', icon: ArrowsRightLeftIcon, color: 'text-blue-600' },
];

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const JAMAICA_BANKS = [
  'Bank of Jamaica',
  'National Commercial Bank (NCB)',
  'Scotiabank Jamaica',
  'CIBC First Caribbean',
  'Sagicor Bank',
  'JMMB Bank',
  'JN Bank',
  'Victoria Mutual Building Society',
  'Other',
];

export default function BankingPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'reconciliation'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);

  const [saveError, setSaveError] = useState('');

  // API hooks
  const { data: accountsResponse, isLoading: accountsLoading } = useBankAccounts();
  const { data: transactionsResponse, isLoading: txnsLoading } = useBankTransactions(
    selectedAccount?.id || undefined
  );
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();
  const createTransaction = useCreateBankTransaction();

  const bankAccounts: BankAccount[] = ((accountsResponse as any)?.data ?? []).map((a: any) => ({
    ...a,
    accountType: (a.accountType ?? '').toLowerCase(),
    currentBalance: Number(a.currentBalance ?? 0),
    availableBalance: Number(a.availableBalance ?? a.currentBalance ?? 0),
  }));

  const bankTransactions: BankTransaction[] = ((transactionsResponse as any)?.data ?? []).map((t: any) => ({
    ...t,
    amount: Number(t.amount ?? 0),
    balance: t.balance != null ? Number(t.balance) : undefined,
  }));

  const [accountForm, setAccountForm] = useState({
    accountName: '',
    bankName: '',
    accountNumber: '',
    accountType: 'checking' as BankAccount['accountType'],
    currency: 'JMD' as 'JMD' | 'USD',
    currentBalance: '',
    isActive: true,
  });

  const [transactionForm, setTransactionForm] = useState({
    accountId: '',
    type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    payee: '',
    category: '',
  });

  const [reconcileForm, setReconcileForm] = useState({
    accountId: '',
    statementDate: new Date().toISOString().split('T')[0],
    statementBalance: '',
    transactions: [] as string[],
  });

  const filteredAccounts = bankAccounts.filter((account) => {
    const matchesSearch = !searchQuery ||
      account.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.bankName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredTransactions = bankTransactions
    .filter((txn) => {
      const matchesSearch = !searchQuery ||
        txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.reference?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAccount = !selectedAccount || txn.bankAccountId === selectedAccount.id;
      return matchesSearch && matchesAccount;
    })
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  const handleOpenAccountModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        accountName: account.accountName,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currency: account.currency,
        currentBalance: account.currentBalance.toString(),
        isActive: account.isActive,
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        accountName: '',
        bankName: '',
        accountNumber: '',
        accountType: 'checking',
        currency: 'JMD',
        currentBalance: '',
        isActive: true,
      });
    }
    setShowAccountModal(true);
  };

  const handleSaveAccount = async () => {
    setSaveError('');
    if (!accountForm.accountName.trim()) {
      alert('Please enter account name');
      return;
    }
    if (!accountForm.bankName) {
      alert('Please select a bank');
      return;
    }

    const accountType = accountForm.accountType.toUpperCase() as string;

    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({
          id: editingAccount.id,
          data: {
            accountName: accountForm.accountName,
            isActive: accountForm.isActive,
            currentBalance: parseFloat(accountForm.currentBalance) || 0,
          },
        });
      } else {
        await createAccount.mutateAsync({
          accountName: accountForm.accountName,
          bankName: accountForm.bankName,
          accountNumber: accountForm.accountNumber,
          accountType,
          currency: accountForm.currency,
          currentBalance: parseFloat(accountForm.currentBalance) || 0,
          isActive: accountForm.isActive,
        });
      }
      setShowAccountModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save account';
      alert(message);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount.mutateAsync(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete account';
        alert(message);
      }
    }
  };

  const handleOpenTransactionModal = () => {
    setTransactionForm({
      accountId: selectedAccount?.id || (bankAccounts[0]?.id || ''),
      type: 'deposit',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      payee: '',
      category: '',
    });
    setShowTransactionModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!transactionForm.accountId) {
      alert('Please select an account');
      return;
    }
    if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!transactionForm.description.trim()) {
      alert('Please enter a description');
      return;
    }

    const rawAmount = parseFloat(transactionForm.amount);
    const amount = transactionForm.type === 'withdrawal' ? -rawAmount : rawAmount;

    try {
      await createTransaction.mutateAsync({
        bankAccountId: transactionForm.accountId,
        transactionDate: transactionForm.date,
        description: transactionForm.description,
        amount,
        reference: transactionForm.reference || undefined,
        category: transactionForm.category || undefined,
      });
      setShowTransactionModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save transaction';
      alert(message);
    }
  };

  const handleOpenReconcileModal = (account: BankAccount) => {
    setReconcileForm({
      accountId: account.id,
      statementDate: new Date().toISOString().split('T')[0],
      statementBalance: account.currentBalance.toString(),
      transactions: [],
    });
    setShowReconcileModal(true);
  };

  const handleReconcile = () => {
    alert('Reconciliation completed!');
    setShowReconcileModal(false);
  };

  // Stats
  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const activeAccounts = bankAccounts.filter(a => a.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
          <p className="text-gray-500">Manage bank accounts and transactions</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'accounts' && (
            <PermissionGate permission="banking:create">
              <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenAccountModal()}>
                Add Account
              </Button>
            </PermissionGate>
          )}
          {activeTab === 'transactions' && (
            <PermissionGate permission="banking:create">
              <Button icon={<PlusIcon className="w-4 h-4" />} onClick={handleOpenTransactionModal}>
                Add Transaction
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'accounts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BuildingLibraryIcon className="w-4 h-4 inline mr-2" />
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'transactions'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowsRightLeftIcon className="w-4 h-4 inline mr-2" />
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'reconciliation'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircleIcon className="w-4 h-4 inline mr-2" />
          Reconciliation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Balance</p>
            <p className="text-2xl font-bold text-emerald-600">{formatJMD(totalBalance)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Active Accounts</p>
            <p className="text-2xl font-bold text-gray-900">{activeAccounts}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold text-blue-600">{bankTransactions.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Unreconciled</p>
            <p className="text-2xl font-bold text-orange-600">
              {bankTransactions.filter(t => !t.isReconciled).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Content */}
      {activeTab === 'accounts' && (
        <>
          <div className="flex-1">
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <BuildingLibraryIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4">No bank accounts found</p>
                  <Button onClick={() => handleOpenAccountModal()}>Add your first account</Button>
                </CardContent>
              </Card>
            ) : (
              filteredAccounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <BuildingLibraryIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{account.accountName}</CardTitle>
                          <p className="text-sm text-gray-500">{account.bankName}</p>
                        </div>
                      </div>
                      <Badge variant={account.isActive ? 'success' : 'default'}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Account #</span>
                        <span className="font-mono">{account.accountNumber || '****'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Type</span>
                        <span className="capitalize">{account.accountType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Balance</span>
                        <span className={`text-xl font-bold ${account.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatJMD(account.currentBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedAccount(account);
                          setActiveTab('transactions');
                        }}
                      >
                        Transactions
                      </Button>
                      <PermissionGate permission="banking:update">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAccountModal(account)}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="banking:delete">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAccount(account.id)}
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
              />
            </div>
            <select
              value={selectedAccount?.id || ''}
              onChange={(e) => setSelectedAccount(bankAccounts.find(a => a.id === e.target.value) || null)}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            >
              <option value="">All Accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountName}</option>
              ))}
            </select>
          </div>

          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                      <p className="mb-4">No transactions found</p>
                      <Button onClick={handleOpenTransactionModal}>Add Transaction</Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((txn) => {
                    const account = bankAccounts.find(a => a.id === txn.bankAccountId);
                    const isDeposit = txn.amount >= 0;
                    const typeInfo = TRANSACTION_TYPES.find(t => t.value === (isDeposit ? 'deposit' : 'withdrawal'));
                    const TypeIcon = typeInfo?.icon || ArrowsRightLeftIcon;

                    return (
                      <TableRow key={txn.id}>
                        <TableCell className="text-gray-500">{formatDate(txn.transactionDate)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{txn.description}</p>
                            {txn.reference && (
                              <p className="text-sm text-gray-500">Ref: {txn.reference}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">{account?.accountName || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className={`w-4 h-4 ${typeInfo?.color}`} />
                            <span className="capitalize">{isDeposit ? 'Deposit' : 'Withdrawal'}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-medium ${
                          isDeposit ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {isDeposit ? '+' : ''}{formatJMD(txn.amount)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {txn.balance !== undefined ? formatJMD(txn.balance) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={txn.isReconciled ? 'success' : 'warning'}
                          >
                            {txn.isReconciled ? 'Reconciled' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {activeTab === 'reconciliation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.filter(a => a.isActive).map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle>{account.accountName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Book Balance</span>
                    <span className="font-medium">{formatJMD(account.currentBalance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Synced</span>
                    <span className="text-gray-500">
                      {account.lastSyncedAt ? formatDate(account.lastSyncedAt) : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uncleared Items</span>
                    <span className="font-medium text-orange-600">
                      {bankTransactions.filter(t => t.bankAccountId === account.id && !t.isReconciled).length}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => handleOpenReconcileModal(account)}
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Reconcile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Account Modal */}
      <Modal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title={editingAccount ? 'Edit Account' : 'Add Bank Account'}
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Account Name *"
              value={accountForm.accountName}
              onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
              placeholder="e.g., Business Checking"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank *</label>
                <select
                  value={accountForm.bankName}
                  onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select bank</option>
                  {JAMAICA_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={accountForm.accountType}
                  onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as BankAccount['accountType'] })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Account Number"
                value={accountForm.accountNumber}
                onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                placeholder="****1234"
              />
              <Input
                label="Opening Balance"
                type="number"
                value={accountForm.currentBalance}
                onChange={(e) => setAccountForm({ ...accountForm, currentBalance: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={accountForm.isActive}
                onChange={(e) => setAccountForm({ ...accountForm, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowAccountModal(false)}>Cancel</Button>
          <Button onClick={handleSaveAccount}>{editingAccount ? 'Update' : 'Create'}</Button>
        </ModalFooter>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title="Add Transaction"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
                <select
                  value={transactionForm.accountId}
                  onChange={(e) => setTransactionForm({ ...transactionForm, accountId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select account</option>
                  {bankAccounts.filter(a => a.isActive).map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={transactionForm.type}
                  onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as any })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount *"
                type="number"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Date *"
                type="date"
                value={transactionForm.date}
                onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
              />
            </div>
            <Input
              label="Description *"
              value={transactionForm.description}
              onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              placeholder="Transaction description"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reference"
                value={transactionForm.reference}
                onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                placeholder="Check #, etc."
              />
              <Input
                label="Payee"
                value={transactionForm.payee}
                onChange={(e) => setTransactionForm({ ...transactionForm, payee: e.target.value })}
                placeholder="Who received/sent"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowTransactionModal(false)}>Cancel</Button>
          <Button onClick={handleSaveTransaction}>Add Transaction</Button>
        </ModalFooter>
      </Modal>

      {/* Reconcile Modal */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="Bank Reconciliation"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Statement Date"
                type="date"
                value={reconcileForm.statementDate}
                onChange={(e) => setReconcileForm({ ...reconcileForm, statementDate: e.target.value })}
              />
              <Input
                label="Statement Ending Balance"
                type="number"
                value={reconcileForm.statementBalance}
                onChange={(e) => setReconcileForm({ ...reconcileForm, statementBalance: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Book Balance</p>
                  <p className="text-lg font-bold">
                    {formatJMD(bankAccounts.find(a => a.id === reconcileForm.accountId)?.currentBalance || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Statement Balance</p>
                  <p className="text-lg font-bold">
                    {formatJMD(parseFloat(reconcileForm.statementBalance) || 0)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Mark transactions as cleared to reconcile your account with your bank statement.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowReconcileModal(false)}>Cancel</Button>
          <Button onClick={handleReconcile}>
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Complete Reconciliation
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
