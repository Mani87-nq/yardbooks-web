'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useJournalEntries,
  useGLAccounts,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  usePostJournalEntry,
  useVoidJournalEntry,
} from '@/hooks/api';
import type { JournalEntry, JournalEntryLine } from '@/types/generalLedger';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function JournalEntriesPage() {
  const { fc } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [lines, setLines] = useState<Partial<JournalEntryLine>[]>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);

  // API hooks
  const { data: entriesResponse, isLoading: entriesLoading } = useJournalEntries({ limit: 100 });
  const { data: glAccountsResponse } = useGLAccounts();
  const createJournalEntry = useCreateJournalEntry();
  const updateJournalEntryMut = useUpdateJournalEntry();
  const deleteJournalEntryMut = useDeleteJournalEntry();
  const postJournalEntry = usePostJournalEntry();
  const voidJournalEntry = useVoidJournalEntry();

  // Map from API (UPPERCASE) to local (lowercase) status/type
  const STATUS_MAP_FROM_API: Record<string, string> = {
    DRAFT: 'draft', POSTED: 'posted', VOID: 'void',
  };
  const TYPE_MAP_FROM_API: Record<string, string> = {
    ASSET: 'asset', LIABILITY: 'liability', EQUITY: 'equity', INCOME: 'revenue', EXPENSE: 'expense',
  };

  const journalEntries: JournalEntry[] = ((entriesResponse as any)?.data ?? []).map((e: any) => ({
    ...e,
    status: STATUS_MAP_FROM_API[e.status] ?? e.status?.toLowerCase() ?? 'draft',
    totalDebits: Number(e.totalDebits ?? 0),
    totalCredits: Number(e.totalCredits ?? 0),
    lines: (e.lines ?? []).map((l: any) => ({
      ...l,
      debit: Number(l.debitAmount ?? 0),
      credit: Number(l.creditAmount ?? 0),
      accountName: l.accountName || l.account?.name || '',
      accountNumber: l.accountCode || l.account?.accountNumber || '',
    })),
  }));

  const glAccounts: Array<{ id: string; accountNumber: string; name: string; type: string; isActive: boolean; balance: number; [key: string]: unknown }> = ((glAccountsResponse as any)?.data ?? []).map((a: any) => ({
    ...a,
    type: TYPE_MAP_FROM_API[a.type] ?? a.type?.toLowerCase() ?? 'asset',
    balance: Number(a.currentBalance ?? a.balance ?? 0),
  }));

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    notes: '',
  });

  const filteredEntries = journalEntries.filter((entry) => {
    const matchesSearch = !searchQuery ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;

    const matchesDate = (!dateRange.start || new Date(entry.date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(entry.date) <= new Date(dateRange.end));

    return matchesSearch && matchesStatus && matchesDate;
  });

  const generateEntryNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = journalEntries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === now.getMonth();
    }).length + 1;
    return `JE-${year}${month}-${String(count).padStart(4, '0')}`;
  };

  const handleOpenModal = (entry?: JournalEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        date: new Date(entry.date).toISOString().split('T')[0],
        reference: entry.reference || '',
        description: entry.description,
        notes: entry.notes || '',
      });
      setLines(entry.lines.map(l => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description || '',
      })));
    } else {
      setEditingEntry(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        notes: '',
      });
      setLines([
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ]);
    }
    setShowModal(true);
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0, description: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      alert('A journal entry must have at least 2 lines');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;

    if (field === 'debit' && value) {
      newLines[index] = { ...newLines[index], debit: numValue, credit: 0 };
    } else if (field === 'credit' && value) {
      newLines[index] = { ...newLines[index], credit: numValue, debit: 0 };
    } else if (field === 'accountId') {
      newLines[index] = { ...newLines[index], accountId: String(value) };
    } else if (field === 'description') {
      newLines[index] = { ...newLines[index], description: String(value) };
    }
    setLines(newLines);
  };

  const totalDebits = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const handleSave = async () => {
    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!isBalanced) {
      alert('Journal entry must balance (debits must equal credits)');
      return;
    }
    if (lines.some(l => !l.accountId)) {
      alert('Please select an account for all lines');
      return;
    }

    const apiLines = lines.map((l, i) => ({
      accountId: l.accountId!,
      accountName: glAccounts.find((a: any) => a.id === l.accountId)?.name || '',
      accountCode: glAccounts.find((a: any) => a.id === l.accountId)?.accountNumber || '',
      debitAmount: Number(l.debit) || 0,
      creditAmount: Number(l.credit) || 0,
      description: l.description || undefined,
      lineNumber: i + 1,
    }));

    const payload: Record<string, unknown> = {
      date: formData.date,
      reference: formData.reference || undefined,
      description: formData.description,
      notes: formData.notes || undefined,
      lines: apiLines,
    };

    try {
      if (editingEntry) {
        await updateJournalEntryMut.mutateAsync({ id: editingEntry.id, data: payload });
      } else {
        await createJournalEntry.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save journal entry';
      alert(message);
    }
  };

  const handlePost = async (entry: JournalEntry) => {
    if (entry.status !== 'draft') {
      alert('Only draft entries can be posted');
      return;
    }
    if (!confirm('Post this journal entry? This will update account balances.')) {
      return;
    }

    try {
      await postJournalEntry.mutateAsync(entry.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post journal entry';
      alert(message);
    }
  };

  const handleVoid = async (entry: JournalEntry) => {
    if (entry.status === 'void') return;
    if (!confirm('Void this journal entry? This will reverse any posted amounts.')) {
      return;
    }

    try {
      await voidJournalEntry.mutateAsync(entry.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to void journal entry';
      alert(message);
    }
  };

  const handleDelete = async (id: string) => {
    const entry = journalEntries.find(e => e.id === id);
    if (entry?.status === 'posted') {
      alert('Cannot delete a posted entry. Void it instead.');
      return;
    }
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteJournalEntryMut.mutateAsync(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete journal entry';
        alert(message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/accounting/chart">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Chart of Accounts
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal Entries</h1>
            <p className="text-gray-500 dark:text-gray-400">Record and manage journal entries</p>
          </div>
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
          New Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{journalEntries.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Draft</p>
            <p className="text-2xl font-bold text-orange-600">
              {journalEntries.filter(e => e.status === 'draft').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Posted</p>
            <p className="text-2xl font-bold text-emerald-600">
              {journalEntries.filter(e => e.status === 'posted').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
            <p className="text-2xl font-bold text-blue-600">
              {journalEntries.filter(e => {
                const d = new Date(e.date);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            rightIcon={searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="w-5 h-5" />
              </button>
            ) : undefined}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'posted', 'voided'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Debit</TableHead>
              <TableHead>Credit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="mb-4">No journal entries found</p>
                  <Button onClick={() => handleOpenModal()}>Create your first entry</Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-gray-600 dark:text-gray-400">
                    {entry.entryNumber}
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{entry.description}</p>
                      {entry.reference && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ref: {entry.reference}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{fc(entry.totalDebits)}</TableCell>
                  <TableCell className="font-medium">{fc(entry.totalCredits)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.status === 'posted' ? 'success' :
                        entry.status === 'draft' ? 'warning' :
                        'default'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {entry.status === 'draft' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handlePost(entry)} title="Post">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(entry)}>
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      {entry.status === 'posted' && (
                        <Button variant="ghost" size="sm" onClick={() => handleVoid(entry)} title="Void">
                          <XCircleIcon className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}
        size="xl"
      >
        <ModalBody>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Date *"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              <Input
                label="Reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Invoice #, etc."
              />
              <Input
                label="Description *"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Entry description"
              />
            </div>

            {/* Entry Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entry Lines</label>
                <Button variant="outline" size="sm" onClick={handleAddLine}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Line
                </Button>
              </div>
              <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Account</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-32">Debit</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-32">Credit</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Memo</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <select
                            value={line.accountId || ''}
                            onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm"
                          >
                            <option value="">Select account</option>
                            {glAccounts.filter(a => a.isActive).map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountNumber} - {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.debit || ''}
                            onChange={(e) => handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm text-right"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.credit || ''}
                            onChange={(e) => handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm text-right"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description || ''}
                            onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm"
                            placeholder="Optional memo"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveLine(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 dark:bg-gray-900 font-medium">
                      <td className="px-3 py-2 text-right">Totals:</td>
                      <td className="px-3 py-2 text-right">{fc(totalDebits)}</td>
                      <td className="px-3 py-2 text-right">{fc(totalCredits)}</td>
                      <td className="px-3 py-2" colSpan={2}>
                        {isBalanced ? (
                          <span className="text-emerald-600 text-sm">Balanced</span>
                        ) : (
                          <span className="text-red-600 text-sm">
                            Out of balance by {fc(Math.abs(totalDebits - totalCredits))}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isBalanced}>
            {editingEntry ? 'Update' : 'Create'} Entry
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
