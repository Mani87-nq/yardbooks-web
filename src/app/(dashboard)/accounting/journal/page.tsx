'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatJMD, formatDate, formatDateTime } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
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
} from '@heroicons/react/24/outline';

export default function JournalEntriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [lines, setLines] = useState<Partial<JournalEntryLine>[]>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);

  const { journalEntries, glAccounts, addJournalEntry, updateJournalEntry, deleteJournalEntry, updateGLAccount } = useAppStore();

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

  const handleSave = () => {
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

    const entryLines: JournalEntryLine[] = lines.map((l, i) => ({
      id: uuidv4(),
      accountId: l.accountId!,
      accountName: glAccounts.find(a => a.id === l.accountId)?.name || '',
      accountNumber: glAccounts.find(a => a.id === l.accountId)?.accountNumber || '',
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description,
    }));

    const entryData = {
      date: new Date(formData.date),
      reference: formData.reference || undefined,
      description: formData.description,
      notes: formData.notes || undefined,
      lines: entryLines,
      totalDebits,
      totalCredits,
      updatedAt: new Date(),
    };

    if (editingEntry) {
      updateJournalEntry(editingEntry.id, entryData);
    } else {
      addJournalEntry({
        id: uuidv4(),
        entryNumber: generateEntryNumber(),
        ...entryData,
        status: 'draft',
        createdAt: new Date(),
        createdBy: 'Current User',
      });
    }
    setShowModal(false);
  };

  const handlePost = (entry: JournalEntry) => {
    if (entry.status !== 'draft') {
      alert('Only draft entries can be posted');
      return;
    }
    if (!confirm('Post this journal entry? This will update account balances.')) {
      return;
    }

    // Update GL account balances
    entry.lines.forEach(line => {
      const account = glAccounts.find(a => a.id === line.accountId);
      if (account) {
        const isDebitNormal = ['asset', 'expense'].includes(account.type);
        const balanceChange = isDebitNormal
          ? line.debit - line.credit
          : line.credit - line.debit;
        updateGLAccount(account.id, {
          balance: (account.balance || 0) + balanceChange,
        });
      }
    });

    updateJournalEntry(entry.id, {
      status: 'posted',
      postedAt: new Date(),
      postedBy: 'Current User',
    });
  };

  const handleVoid = (entry: JournalEntry) => {
    if (entry.status === 'void') return;
    if (!confirm('Void this journal entry? This will reverse any posted amounts.')) {
      return;
    }

    // Reverse GL account balances if posted
    if (entry.status === 'posted') {
      entry.lines.forEach(line => {
        const account = glAccounts.find(a => a.id === line.accountId);
        if (account) {
          const isDebitNormal = ['asset', 'expense'].includes(account.type);
          const balanceChange = isDebitNormal
            ? line.credit - line.debit
            : line.debit - line.credit;
          updateGLAccount(account.id, {
            balance: (account.balance || 0) + balanceChange,
          });
        }
      });
    }

    updateJournalEntry(entry.id, { status: 'void' });
  };

  const handleDelete = (id: string) => {
    const entry = journalEntries.find(e => e.id === id);
    if (entry?.status === 'posted') {
      alert('Cannot delete a posted entry. Void it instead.');
      return;
    }
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteJournalEntry(id);
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
            <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
            <p className="text-gray-500">Record and manage journal entries</p>
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
            <p className="text-sm text-gray-500">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900">{journalEntries.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Draft</p>
            <p className="text-2xl font-bold text-orange-600">
              {journalEntries.filter(e => e.status === 'draft').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Posted</p>
            <p className="text-2xl font-bold text-emerald-600">
              {journalEntries.filter(e => e.status === 'posted').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">This Month</p>
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
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
                <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No journal entries found</p>
                  <Button onClick={() => handleOpenModal()}>Create your first entry</Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-gray-600">
                    {entry.entryNumber}
                  </TableCell>
                  <TableCell className="text-gray-500">{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{entry.description}</p>
                      {entry.reference && (
                        <p className="text-sm text-gray-500">Ref: {entry.reference}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatJMD(entry.totalDebits)}</TableCell>
                  <TableCell className="font-medium">{formatJMD(entry.totalCredits)}</TableCell>
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
                <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
                <Button variant="outline" size="sm" onClick={handleAddLine}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Line
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-32">Debit</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-32">Credit</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Memo</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <select
                            value={line.accountId || ''}
                            onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.credit || ''}
                            onChange={(e) => handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description || ''}
                            onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                    <tr className="bg-gray-50 font-medium">
                      <td className="px-3 py-2 text-right">Totals:</td>
                      <td className="px-3 py-2 text-right">{formatJMD(totalDebits)}</td>
                      <td className="px-3 py-2 text-right">{formatJMD(totalCredits)}</td>
                      <td className="px-3 py-2" colSpan={2}>
                        {isBalanced ? (
                          <span className="text-emerald-600 text-sm">Balanced</span>
                        ) : (
                          <span className="text-red-600 text-sm">
                            Out of balance by {formatJMD(Math.abs(totalDebits - totalCredits))}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
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
