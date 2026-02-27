'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  IdentificationIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  XCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface LoyaltyMember {
  id: string;
  cardNumber: string | null;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  enrolledAt: string;
  lastActivityAt: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  loyaltyProgram: { id: string; name: string };
}

interface LoyaltyProgram {
  id: string;
  name: string;
  isActive: boolean;
}

// ============================================
// TIER BADGE
// ============================================

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PLATINUM: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[tier] || TIER_COLORS.BRONZE}`}>
      {tier}
    </span>
  );
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
// ENROLL MODAL
// ============================================

function EnrollModal({
  open,
  programs,
  onClose,
  onSaved,
}: {
  open: boolean;
  programs: LoyaltyProgram[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [programId, setProgramId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [tier, setTier] = useState('BRONZE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setCustomerId('');
    setCustomerSearch('');
    setProgramId(programs.find((p) => p.isActive)?.id || '');
    setCardNumber('');
    setTier('BRONZE');
    setError('');
    setCustomerResults([]);
  }, [open, programs]);

  // Search customers
  useEffect(() => {
    if (!customerSearch || customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/v1/customers?search=${encodeURIComponent(customerSearch)}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          setCustomerResults(json.data || json.customers || []);
        }
      } catch {
        // Silently handle search errors
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [customerSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !programId) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/modules/retail/loyalty/${programId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          cardNumber: cardNumber || null,
          tier,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to enroll member');
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

  const activePrograms = programs.filter((p) => p.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Enroll New Member</h2>
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

            {activePrograms.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-lg p-3">
                No active loyalty programs found. Create a loyalty program first.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Loyalty Program *
                  </label>
                  <select value={programId} onChange={(e) => setProgramId(e.target.value)} required className={inputCls}>
                    <option value="">Select a program...</option>
                    {activePrograms.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId(''); }}
                      className={inputCls}
                      placeholder="Search by name or email..."
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ArrowPathIcon className="w-4 h-4 text-gray-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  {customerId && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Customer selected: {customerResults.find((c) => c.id === customerId)?.name || customerId}
                    </p>
                  )}
                  {customerResults.length > 0 && !customerId && (
                    <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                          {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className={inputCls}
                      placeholder="Auto-generated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Starting Tier
                    </label>
                    <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputCls}>
                      <option value="BRONZE">Bronze</option>
                      <option value="SILVER">Silver</option>
                      <option value="GOLD">Gold</option>
                      <option value="PLATINUM">Platinum</option>
                    </select>
                  </div>
                </div>
              </>
            )}
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
              disabled={saving || !customerId || !programId}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enrolling...' : 'Enroll Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MembersPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sortBy, setSortBy] = useState('enrolledAt');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50', sortBy, sortOrder: 'desc' });
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      if (programFilter) params.set('programId', programFilter);
      const res = await fetch(`/api/modules/retail/loyalty/members?${params}`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json();
      setMembers(json.data || []);
      setTotalMembers(json.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter, programFilter, sortBy]);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch('/api/modules/retail/loyalty?includeInactive=true');
      if (res.ok) {
        const json = await res.json();
        setPrograms(json.data || []);
      }
    } catch {
      // Programs fetch is non-critical
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // Stats
  const tierCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.tier] = (acc[m.tier] || 0) + 1;
    return acc;
  }, {});

  const totalPoints = members.reduce((sum, m) => sum + (m.pointsBalance || 0), 0);

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // ---- LOADING STATE ----
  if (loading && members.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error && members.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <XCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Failed to load</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => { setError(''); fetchMembers(); }}
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
            <IdentificationIcon className="w-7 h-7 text-emerald-600" />
            Member Cards
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage loyalty program members and their cards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMembers}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <UserPlusIcon className="w-4 h-4" />
            Enroll Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserGroupIcon} label="Total Members" value={totalMembers.toLocaleString()} color="bg-emerald-600" />
        <StatCard
          icon={IdentificationIcon}
          label="Gold & Platinum"
          value={(tierCounts.GOLD || 0) + (tierCounts.PLATINUM || 0)}
          subtext="Premium members"
          color="bg-yellow-500"
        />
        <StatCard
          icon={IdentificationIcon}
          label="Total Points"
          value={totalPoints.toLocaleString()}
          subtext="Active balances"
          color="bg-blue-600"
        />
        <StatCard
          icon={IdentificationIcon}
          label="Programs"
          value={programs.length}
          subtext={`${programs.filter((p) => p.isActive).length} active`}
          color="bg-purple-600"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or card number..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Tiers</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
          </select>
          {programs.length > 1 && (
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="enrolledAt">Newest</option>
            <option value="pointsBalance">Points</option>
            <option value="lifetimePoints">Lifetime Points</option>
            <option value="lastActivityAt">Last Active</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <UserGroupIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No members found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {search || tierFilter || programFilter
              ? 'Try adjusting your search or filters'
              : 'Enroll customers in a loyalty program to see them here'}
          </p>
          {!search && !tierFilter && !programFilter && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <UserPlusIcon className="w-4 h-4" />
              Enroll Member
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Card #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Program</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Points</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Lifetime</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{member.customer.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.customer.email || member.customer.phone || '--'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {member.cardNumber || '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.loyaltyProgram.name}</td>
                    <td className="px-4 py-3"><TierBadge tier={member.tier} /></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {member.pointsBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {member.lifetimePoints.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {formatDate(member.lastActivityAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.length >= 50 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {members.length} of {totalMembers} members. Use search to find specific members.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Enroll Modal */}
      <EnrollModal
        open={modalOpen}
        programs={programs}
        onClose={() => setModalOpen(false)}
        onSaved={() => { fetchMembers(); fetchPrograms(); }}
      />
    </div>
  );
}
