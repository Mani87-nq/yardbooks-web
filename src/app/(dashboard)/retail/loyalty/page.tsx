'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  StarIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ChartBarIcon,
  GiftIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  pointsPerDollar: number;
  pointsRounding: string;
  rewardThreshold: number;
  createdAt: string;
  updatedAt: string;
  _count: { members: number; transactions: number; rewards: number };
}

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

interface PointsActivity {
  transaction: {
    id: string;
    type: string;
    points: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  };
  member: LoyaltyMember;
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
// CREATE / EDIT PROGRAM MODAL
// ============================================

function ProgramModal({
  open,
  program,
  onClose,
  onSaved,
}: {
  open: boolean;
  program: LoyaltyProgram | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsPerDollar, setPointsPerDollar] = useState(1);
  const [pointsRounding, setPointsRounding] = useState('FLOOR');
  const [rewardThreshold, setRewardThreshold] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (program) {
      setName(program.name);
      setDescription(program.description || '');
      setPointsPerDollar(Number(program.pointsPerDollar));
      setPointsRounding(program.pointsRounding);
      setRewardThreshold(program.rewardThreshold);
      setIsActive(program.isActive);
    } else {
      setName('');
      setDescription('');
      setPointsPerDollar(1);
      setPointsRounding('FLOOR');
      setRewardThreshold(100);
      setIsActive(true);
    }
    setError('');
  }, [program, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const url = program
        ? `/api/modules/retail/loyalty/${program.id}`
        : '/api/modules/retail/loyalty';
      const res = await fetch(url, {
        method: program ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          pointsPerDollar,
          pointsRounding,
          rewardThreshold,
          isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save program');
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {program ? 'Edit Program' : 'Create Loyalty Program'}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Yard Rewards"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Describe the loyalty program..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Points per JMD Spent
              </label>
              <input
                type="number"
                value={pointsPerDollar}
                onChange={(e) => setPointsPerDollar(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.01}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reward Threshold (pts)
              </label>
              <input
                type="number"
                value={rewardThreshold}
                onChange={(e) => setRewardThreshold(parseInt(e.target.value) || 1)}
                min={1}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Points Rounding
            </label>
            <select
              value={pointsRounding}
              onChange={(e) => setPointsRounding(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="FLOOR">Round Down (Floor)</option>
              <option value="ROUND">Nearest (Round)</option>
              <option value="CEIL">Round Up (Ceil)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
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
              {saving ? 'Saving...' : program ? 'Update Program' : 'Create Program'}
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

export default function LoyaltyPage() {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [activeTab, setActiveTab] = useState<'programs' | 'members' | 'activity'>('programs');

  // Stats
  const totalMembers = programs.reduce((sum, p) => sum + (p._count?.members || 0), 0);
  const totalTransactions = programs.reduce((sum, p) => sum + (p._count?.transactions || 0), 0);
  const activePrograms = programs.filter((p) => p.isActive).length;

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/modules/retail/loyalty?includeInactive=true');
      if (!res.ok) throw new Error('Failed to fetch programs');
      const json = await res.json();
      setPrograms(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const params = new URLSearchParams({ limit: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/modules/retail/loyalty/members?${params}`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json();
      setMembers(json.data || []);
    } catch {
      // Members error handled silently - programs error is shown
    } finally {
      setMembersLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab, fetchMembers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this loyalty program? This will remove all members and transaction history.')) return;
    try {
      const res = await fetch(`/api/modules/retail/loyalty/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchPrograms();
    } catch {
      alert('Failed to delete program');
    }
  };

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
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
            onClick={fetchPrograms}
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
            <StarIcon className="w-7 h-7 text-emerald-600" />
            Loyalty Programs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reward your customers and build lasting relationships
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPrograms}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setEditingProgram(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Program
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={StarIcon}
          label="Active Programs"
          value={activePrograms}
          subtext={`${programs.length} total`}
          color="bg-emerald-600"
        />
        <StatCard
          icon={UserGroupIcon}
          label="Total Members"
          value={totalMembers.toLocaleString()}
          color="bg-blue-600"
        />
        <StatCard
          icon={ChartBarIcon}
          label="Total Transactions"
          value={totalTransactions.toLocaleString()}
          color="bg-purple-600"
        />
        <StatCard
          icon={GiftIcon}
          label="Rewards Available"
          value={programs.reduce((sum, p) => sum + (p._count?.rewards || 0), 0)}
          color="bg-amber-500"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {(['programs', 'members', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'programs' && (
        <div>
          {programs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <SparklesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No loyalty programs yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Create your first loyalty program to start rewarding customers
              </p>
              <button
                onClick={() => {
                  setEditingProgram(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
              >
                <PlusIcon className="w-4 h-4" />
                Create Program
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {program.name}
                        </h3>
                        {program.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircleIcon className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                            <XCircleIcon className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </div>
                      {program.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                          {program.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => {
                          setEditingProgram(program);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(program.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {program._count?.members || 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {Number(program.pointsPerDollar)}x
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Points/JMD</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {program.rewardThreshold}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Reward at</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or card number..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <UserGroupIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No members found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {search ? 'Try a different search term' : 'Enroll customers in a loyalty program to see them here'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Program</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tier</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Points</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Lifetime</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Card #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{member.customer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.customer.email || member.customer.phone || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.loyaltyProgram.name}</td>
                        <td className="px-4 py-3"><TierBadge tier={member.tier} /></td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{member.pointsBalance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{member.lifetimePoints.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{member.cardNumber || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ChartBarIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Points Activity</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recent points earned, redeemed, and adjusted will appear here as transactions are made.
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <ProgramModal
        open={modalOpen}
        program={editingProgram}
        onClose={() => {
          setModalOpen(false);
          setEditingProgram(null);
        }}
        onSaved={fetchPrograms}
      />
    </div>
  );
}
