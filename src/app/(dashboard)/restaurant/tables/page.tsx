'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Squares2X2Icon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────
interface RestaurantTable {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  section: string | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
  currentOrderId: string | null;
  seatedAt: string | null;
  createdAt: string;
}

type TableStatus = RestaurantTable['status'];

// ── Status Helpers ───────────────────────────────────────────────────
const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; ring: string; dot: string }> = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    ring: 'ring-red-500/30',
    dot: 'bg-red-500',
  },
  RESERVED: {
    label: 'Reserved',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    ring: 'ring-yellow-500/30',
    dot: 'bg-yellow-500',
  },
  CLEANING: {
    label: 'Cleaning',
    bg: 'bg-gray-100 dark:bg-gray-700/50',
    text: 'text-gray-600 dark:text-gray-400',
    ring: 'ring-gray-400/30',
    dot: 'bg-gray-400',
  },
};

function getElapsedTime(seatedAt: string | null): string {
  if (!seatedAt) return '';
  const diff = Date.now() - new Date(seatedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ── Add Table Modal ──────────────────────────────────────────────────
function AddTableModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNumber('');
      setName('');
      setCapacity('4');
      setSection('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/modules/restaurant/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: parseInt(number),
          name: name || null,
          capacity: parseInt(capacity),
          section: section || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to add table');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Table</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table Number *
              </label>
              <input
                type="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                min={1}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                min={1}
                max={50}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="4"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Table Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Window Booth, Patio 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section / Zone
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Main Floor, Patio, Bar Area"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !number}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding...' : 'Add Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Seat / Action Modal ──────────────────────────────────────────────
function TableActionModal({
  table,
  onClose,
  onAction,
}: {
  table: RestaurantTable | null;
  onClose: () => void;
  onAction: () => void;
}) {
  const [actionLoading, setActionLoading] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (table) {
      setGuestCount(String(table.capacity));
      setError('');
    }
  }, [table]);

  if (!table) return null;

  const handleSeat = async () => {
    setActionLoading('seat');
    setError('');
    try {
      const res = await fetch(`/api/modules/restaurant/tables/${table.id}/seat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestCount: parseInt(guestCount) || table.capacity }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to seat guests');
      }
      onAction();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading('');
    }
  };

  const handleClear = async () => {
    setActionLoading('clear');
    setError('');
    try {
      const res = await fetch(`/api/modules/restaurant/tables/${table.id}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to clear table');
      }
      onAction();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading('');
    }
  };

  const config = STATUS_CONFIG[table.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Table {table.number}
              {table.name && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">({table.name})</span>}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                {config.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Capacity</span>
              <span className="text-gray-900 dark:text-white font-medium">{table.capacity} seats</span>
            </div>
            {table.section && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Section</span>
                <span className="text-gray-900 dark:text-white font-medium">{table.section}</span>
              </div>
            )}
            {table.seatedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Seated for</span>
                <span className="text-gray-900 dark:text-white font-medium">{getElapsedTime(table.seatedAt)}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Actions by status */}
          {table.status === 'AVAILABLE' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of Guests
                </label>
                <input
                  type="number"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  min={1}
                  max={table.capacity}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleSeat}
                disabled={!!actionLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === 'seat' ? 'Seating...' : 'Seat Guests'}
              </button>
            </div>
          )}

          {table.status === 'OCCUPIED' && (
            <button
              onClick={handleClear}
              disabled={!!actionLoading}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === 'clear' ? 'Clearing...' : 'Clear Table'}
            </button>
          )}

          {table.status === 'RESERVED' && (
            <div className="space-y-2">
              <button
                onClick={handleSeat}
                disabled={!!actionLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === 'seat' ? 'Seating...' : 'Seat Reservation'}
              </button>
              <button
                onClick={handleClear}
                disabled={!!actionLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                {actionLoading === 'clear' ? 'Clearing...' : 'Clear Reservation'}
              </button>
            </div>
          )}

          {table.status === 'CLEANING' && (
            <button
              onClick={handleClear}
              disabled={!!actionLoading}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading === 'clear' ? 'Marking...' : 'Mark Available'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');

  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/modules/restaurant/tables');
      if (!res.ok) throw new Error('Failed to fetch tables');
      const json = await res.json();
      setTables(json.data || json || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Group by sections
  const sections = Array.from(new Set(tables.map((t) => t.section || 'Unassigned')));
  const filteredTables = filterSection === 'all'
    ? tables
    : tables.filter((t) => (t.section || 'Unassigned') === filterSection);

  // Stats
  const stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === 'AVAILABLE').length,
    occupied: tables.filter((t) => t.status === 'OCCUPIED').length,
    reserved: tables.filter((t) => t.status === 'RESERVED').length,
    cleaning: tables.filter((t) => t.status === 'CLEANING').length,
  };

  // Loading
  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Failed to load tables</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={fetchTables}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Squares2X2Icon className="w-7 h-7 text-blue-600" />
            Floor Plan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage tables and seating
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTables}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.available}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Available</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.occupied}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Occupied</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.reserved}</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400">Reserved</p>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{stats.cleaning}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cleaning</p>
        </div>
      </div>

      {/* Section filter */}
      {sections.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterSection('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterSection === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All ({stats.total})
          </button>
          {sections.map((section) => {
            const count = tables.filter((t) => (t.section || 'Unassigned') === section).length;
            return (
              <button
                key={section}
                onClick={() => setFilterSection(section)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  filterSection === section
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {section} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {tables.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Squares2X2Icon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tables configured</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add your restaurant tables to get started with the floor plan.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add First Table
          </button>
        </div>
      )}

      {/* Table Grid */}
      {filteredTables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTables
            .sort((a, b) => a.number - b.number)
            .map((table) => {
              const config = STATUS_CONFIG[table.status];
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${config.bg} border-transparent ring-1 ${config.ring}`}
                >
                  {/* Status dot */}
                  <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${config.dot}`} />

                  {/* Table number */}
                  <div className="text-center mb-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{table.number}</span>
                  </div>

                  {/* Table name */}
                  {table.name && (
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 truncate mb-2">
                      {table.name}
                    </p>
                  )}

                  {/* Capacity */}
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <UserGroupIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{table.capacity}</span>
                  </div>

                  {/* Status label */}
                  <p className={`text-xs font-medium text-center ${config.text}`}>
                    {config.label}
                  </p>

                  {/* Time seated */}
                  {table.status === 'OCCUPIED' && table.seatedAt && (
                    <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
                      {getElapsedTime(table.seatedAt)}
                    </p>
                  )}
                </button>
              );
            })}
        </div>
      )}

      {/* Modals */}
      <AddTableModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSaved={fetchTables}
      />

      <TableActionModal
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        onAction={fetchTables}
      />
    </div>
  );
}
