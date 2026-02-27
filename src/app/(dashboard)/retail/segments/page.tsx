'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UsersIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  EyeIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface SegmentRule {
  field: string;
  operator: string;
  value: string | number | string[];
}

interface CustomerSegment {
  id: string;
  name: string;
  description: string | null;
  type: 'MANUAL' | 'AUTO';
  rules: SegmentRule[] | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
}

interface SegmentMember {
  id: string;
  customerId: string;
  addedAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
}

// ============================================
// HELPERS
// ============================================

const FIELD_LABELS: Record<string, string> = {
  totalSpend: 'Total Spend',
  total_spent: 'Total Spent',
  orderCount: 'Order Count',
  order_count: 'Order Count',
  visits: 'Visits',
  lastOrderDate: 'Last Order Date',
  last_visit: 'Last Visit',
  parish: 'Parish',
  tags: 'Tags',
  lifetimePoints: 'Lifetime Points',
  tier: 'Tier',
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: 'does not equal',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  contains: 'contains',
  in: 'in',
};

function formatRuleSummary(rules: SegmentRule[] | null): string {
  if (!rules || rules.length === 0) return 'No rules defined';
  return rules
    .map((r) => {
      const field = FIELD_LABELS[r.field] || r.field;
      const op = OPERATOR_LABELS[r.operator] || r.operator;
      const val = Array.isArray(r.value) ? r.value.join(', ') : String(r.value);
      return `${field} ${op} ${val}`;
    })
    .join(' AND ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// STAT CARD
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

// ============================================
// CRITERIA ROW
// ============================================

function CriteriaRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: SegmentRule;
  onChange: (updated: SegmentRule) => void;
  onRemove: () => void;
}) {
  const inputCls =
    'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
        className={`${inputCls} w-40`}
      >
        <option value="totalSpend">Total Spend</option>
        <option value="orderCount">Order Count</option>
        <option value="visits">Visits</option>
        <option value="lastOrderDate">Last Order Date</option>
        <option value="lifetimePoints">Lifetime Points</option>
        <option value="tier">Tier</option>
        <option value="parish">Parish</option>
      </select>
      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value })}
        className={`${inputCls} w-36`}
      >
        <option value="gt">greater than</option>
        <option value="gte">at least</option>
        <option value="lt">less than</option>
        <option value="lte">at most</option>
        <option value="eq">equals</option>
        <option value="neq">not equals</option>
        <option value="contains">contains</option>
      </select>
      <input
        type="text"
        value={Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
        onChange={(e) => {
          const val = e.target.value;
          const numVal = Number(val);
          onChange({ ...rule, value: isNaN(numVal) || val === '' ? val : numVal });
        }}
        className={`${inputCls} flex-1 min-w-[100px]`}
        placeholder="Value"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// CREATE / EDIT MODAL
// ============================================

function SegmentModal({
  open,
  segment,
  onClose,
  onSaved,
}: {
  open: boolean;
  segment: CustomerSegment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (segment) {
      setName(segment.name);
      setDescription(segment.description || '');
      setType(segment.type);
      setRules(segment.rules && Array.isArray(segment.rules) ? (segment.rules as SegmentRule[]) : []);
      setIsActive(segment.isActive);
    } else {
      setName('');
      setDescription('');
      setType('MANUAL');
      setRules([]);
      setIsActive(true);
    }
    setError('');
  }, [segment, open]);

  const addRule = () => {
    setRules([...rules, { field: 'totalSpend', operator: 'gt', value: 0 }]);
  };

  const updateRule = (index: number, updated: SegmentRule) => {
    const newRules = [...rules];
    newRules[index] = updated;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (type === 'AUTO' && rules.length === 0) {
        throw new Error('Auto segments require at least one rule');
      }

      const body = {
        name,
        description: description || null,
        type,
        rules: rules.length > 0 ? rules : null,
        isActive,
      };

      const url = segment
        ? `/api/modules/retail/segments/${segment.id}`
        : '/api/modules/retail/segments';
      const res = await fetch(url, {
        method: segment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save segment');
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

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {segment ? 'Edit Segment' : 'Create Segment'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g., High-Value Customers" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} placeholder="Describe this segment..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'MANUAL' | 'AUTO')} className={inputCls}>
              <option value="MANUAL">Manual - Add members manually</option>
              <option value="AUTO">Auto - Based on rules</option>
            </select>
          </div>

          {/* Criteria Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Rules {type === 'AUTO' && <span className="text-red-500">*</span>}
              </label>
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add Rule
              </button>
            </div>
            {rules.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                {type === 'AUTO' ? 'Add at least one rule for auto segments' : 'No rules defined (optional for manual segments)'}
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, i) => (
                  <CriteriaRow key={i} rule={rule} onChange={(r) => updateRule(i, r)} onRemove={() => removeRule(i)} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </div>

          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : segment ? 'Update Segment' : 'Create Segment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MEMBERS VIEWER MODAL
// ============================================

function MembersModal({
  open,
  segment,
  onClose,
}: {
  open: boolean;
  segment: CustomerSegment | null;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<SegmentMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !segment) {
      setMembers([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/modules/retail/segments/${segment.id}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch {
        // Handle silently
      } finally {
        setLoading(false);
      }
    })();
  }, [open, segment]);

  if (!open || !segment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{segment.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {segment._count?.members || segment.memberCount || 0} members
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No members in this segment yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{m.customer.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {m.customer.email || m.customer.phone || '--'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Added {formatDate(m.addedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function SegmentsPage() {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<CustomerSegment | null>(null);
  const [viewingSegment, setViewingSegment] = useState<CustomerSegment | null>(null);
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});

  const fetchSegments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/modules/retail/segments?includeInactive=true');
      if (!res.ok) throw new Error('Failed to fetch segments');
      const json = await res.json();
      setSegments(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment? This will remove all member associations.')) return;
    try {
      const res = await fetch(`/api/modules/retail/segments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchSegments();
    } catch {
      alert('Failed to delete segment');
    }
  };

  const toggleRules = (id: string) => {
    setExpandedRules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Stats
  const totalSegments = segments.length;
  const activeSegments = segments.filter((s) => s.isActive).length;
  const autoSegments = segments.filter((s) => s.type === 'AUTO').length;
  const totalSegmentMembers = segments.reduce((sum, s) => sum + (s._count?.members || s.memberCount || 0), 0);

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-44 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <XCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Failed to load</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => { setError(''); fetchSegments(); }}
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
            <UsersIcon className="w-7 h-7 text-emerald-600" />
            Customer Segments
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Group customers for targeted promotions and analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSegments}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setEditingSegment(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Segment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label="Total Segments" value={totalSegments} color="bg-emerald-600" />
        <StatCard icon={UsersIcon} label="Active Segments" value={activeSegments} color="bg-blue-600" />
        <StatCard icon={FunnelIcon} label="Auto Segments" value={autoSegments} subtext="Rule-based" color="bg-purple-600" />
        <StatCard icon={UsersIcon} label="Total Members" value={totalSegmentMembers.toLocaleString()} subtext="Across all segments" color="bg-amber-500" />
      </div>

      {/* Segments List */}
      {segments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No segments yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create customer segments to target promotions and track groups
          </p>
          <button
            onClick={() => { setEditingSegment(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            <PlusIcon className="w-4 h-4" />
            Create Segment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {segments.map((segment) => {
            const memberCount = segment._count?.members ?? segment.memberCount ?? 0;
            const hasRules = segment.rules && Array.isArray(segment.rules) && segment.rules.length > 0;
            const isExpanded = expandedRules[segment.id];

            return (
              <div
                key={segment.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                        {segment.name}
                      </h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        segment.type === 'AUTO'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {segment.type}
                      </span>
                      {!segment.isActive && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    {segment.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {segment.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <button
                      onClick={() => setViewingSegment(segment)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="View members"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingSegment(segment); setModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(segment.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Rules summary */}
                {hasRules && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleRules(segment.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <FunnelIcon className="w-3.5 h-3.5" />
                      {(segment.rules as SegmentRule[]).length} rule{(segment.rules as SegmentRule[]).length !== 1 ? 's' : ''}
                      {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-1">
                        {(segment.rules as SegmentRule[]).map((rule, i) => (
                          <p key={i} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                            {FIELD_LABELS[rule.field] || rule.field}{' '}
                            <span className="text-gray-400 dark:text-gray-500">{OPERATOR_LABELS[rule.operator] || rule.operator}</span>{' '}
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {memberCount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(segment.createdAt)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <SegmentModal
        open={modalOpen}
        segment={editingSegment}
        onClose={() => { setModalOpen(false); setEditingSegment(null); }}
        onSaved={fetchSegments}
      />

      {/* View Members Modal */}
      <MembersModal
        open={!!viewingSegment}
        segment={viewingSegment}
        onClose={() => setViewingSegment(null)}
      />
    </div>
  );
}
