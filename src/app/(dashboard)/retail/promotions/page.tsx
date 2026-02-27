'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TagIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  MegaphoneIcon,
  CalendarIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y' | 'BUNDLE';
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT' | 'CUSTOMER_SEGMENT';
  targetIds: string[] | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  currentUses: number;
  promoCode: string | null;
  requiresCode: boolean;
  createdAt: string;
  updatedAt: string;
}

type TabKey = 'active' | 'scheduled' | 'expired' | 'all';

// ============================================
// STATUS HELPERS
// ============================================

function getEffectiveStatus(promo: Promotion): 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED' {
  if (!promo.isActive) return 'DISABLED';
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = promo.endDate ? new Date(promo.endDate) : null;
  if (start > now) return 'SCHEDULED';
  if (end && end < now) return 'EXPIRED';
  return 'ACTIVE';
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  DISABLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.EXPIRED}`}>
      {status}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed Amount',
  BUY_X_GET_Y: 'Buy X Get Y',
  BUNDLE: 'Bundle',
};

function formatDiscountValue(promo: Promotion): string {
  const value = Number(promo.value);
  switch (promo.type) {
    case 'PERCENTAGE':
      return `${value}% off`;
    case 'FIXED_AMOUNT':
      return `$${value.toLocaleString()} off`;
    case 'BUY_X_GET_Y':
      return `BXGY - $${value.toLocaleString()}`;
    case 'BUNDLE':
      return `Bundle - $${value.toLocaleString()}`;
    default:
      return `$${value.toLocaleString()}`;
  }
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
// CREATE / EDIT MODAL
// ============================================

function PromotionModal({
  open,
  promotion,
  onClose,
  onSaved,
}: {
  open: boolean;
  promotion: Promotion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Promotion['type']>('PERCENTAGE');
  const [value, setValue] = useState(0);
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [requiresCode, setRequiresCode] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (promotion) {
      setName(promotion.name);
      setDescription(promotion.description || '');
      setType(promotion.type);
      setValue(Number(promotion.value));
      setMinOrderAmount(promotion.minOrderAmount ? String(Number(promotion.minOrderAmount)) : '');
      setMaxDiscount(promotion.maxDiscount ? String(Number(promotion.maxDiscount)) : '');
      setStartDate(promotion.startDate ? promotion.startDate.slice(0, 10) : '');
      setEndDate(promotion.endDate ? promotion.endDate.slice(0, 10) : '');
      setMaxUses(promotion.maxUses ? String(promotion.maxUses) : '');
      setMaxUsesPerCustomer(promotion.maxUsesPerCustomer ? String(promotion.maxUsesPerCustomer) : '');
      setPromoCode(promotion.promoCode || '');
      setRequiresCode(promotion.requiresCode);
      setIsActive(promotion.isActive);
    } else {
      setName('');
      setDescription('');
      setType('PERCENTAGE');
      setValue(0);
      setMinOrderAmount('');
      setMaxDiscount('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setMaxUses('');
      setMaxUsesPerCustomer('');
      setPromoCode('');
      setRequiresCode(false);
      setIsActive(true);
    }
    setError('');
  }, [promotion, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        type,
        value,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        startDate,
        endDate: endDate || null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerCustomer: maxUsesPerCustomer ? parseInt(maxUsesPerCustomer) : null,
        promoCode: promoCode || null,
        requiresCode,
        isActive,
      };

      const url = promotion
        ? `/api/modules/retail/promotions/${promotion.id}`
        : '/api/modules/retail/promotions';
      const res = await fetch(url, {
        method: promotion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save promotion');
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
            {promotion ? 'Edit Promotion' : 'Create Promotion'}
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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g., Summer Sale 20% Off" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} placeholder="Describe this promotion..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as Promotion['type'])} className={inputCls}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
                <option value="BUY_X_GET_Y">Buy X Get Y</option>
                <option value="BUNDLE">Bundle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount Value ($)'} *
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                min={0}
                max={type === 'PERCENTAGE' ? 100 : undefined}
                step={type === 'PERCENTAGE' ? 1 : 0.01}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Purchase ($)</label>
              <input
                type="number"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                min={0}
                step={0.01}
                className={inputCls}
                placeholder="No minimum"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Discount ($)</label>
              <input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                min={0}
                step={0.01}
                className={inputCls}
                placeholder="No cap"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usage Limit</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min={1}
                className={inputCls}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Per Customer Limit</label>
              <input
                type="number"
                value={maxUsesPerCustomer}
                onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                min={1}
                className={inputCls}
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Promo Code</label>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className={inputCls}
              placeholder="e.g., SUMMER2026"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRequiresCode(!requiresCode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  requiresCode ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${requiresCode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Requires Code</span>
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
              disabled={saving || !name.trim() || !startDate}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : promotion ? 'Update Promotion' : 'Create Promotion'}
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

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      params.set('limit', '100');
      const res = await fetch(`/api/modules/retail/promotions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch promotions');
      const json = await res.json();
      setPromotions(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      const res = await fetch(`/api/modules/retail/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchPromotions();
    } catch {
      alert('Failed to delete promotion');
    }
  };

  // Stats
  const allPromos = promotions;
  const activeCount = allPromos.filter((p) => getEffectiveStatus(p) === 'ACTIVE').length;
  const scheduledCount = allPromos.filter((p) => getEffectiveStatus(p) === 'SCHEDULED').length;
  const totalUses = allPromos.reduce((sum, p) => sum + (p.currentUses || 0), 0);

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-44 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
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
            onClick={() => { setError(''); fetchPromotions(); }}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'expired', label: 'Expired' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TagIcon className="w-7 h-7 text-emerald-600" />
            Promotions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage discounts, promo codes, and special offers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPromotions}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setEditingPromotion(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Promotion
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TagIcon} label="Active Promotions" value={activeCount} color="bg-emerald-600" />
        <StatCard icon={CalendarIcon} label="Scheduled" value={scheduledCount} color="bg-blue-600" />
        <StatCard icon={TicketIcon} label="Total Uses" value={totalUses.toLocaleString()} color="bg-purple-600" />
        <StatCard icon={MegaphoneIcon} label="Total Promotions" value={allPromos.length} color="bg-amber-500" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Promotions List */}
      {promotions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MegaphoneIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {activeTab === 'all' ? 'No promotions yet' : `No ${activeTab} promotions`}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {activeTab === 'all'
              ? 'Create your first promotion to attract and reward customers'
              : `There are no ${activeTab} promotions right now`}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => { setEditingPromotion(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <PlusIcon className="w-4 h-4" />
              Create Promotion
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {promotions.map((promo) => {
            const status = getEffectiveStatus(promo);
            return (
              <div
                key={promo.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                        {promo.name}
                      </h3>
                      <StatusBadge status={status} />
                    </div>
                    {promo.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {promo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 font-medium">
                        {TYPE_LABELS[promo.type] || promo.type}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {formatDiscountValue(promo)}
                      </span>
                      {promo.promoCode && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-mono">
                          {promo.promoCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <button
                      onClick={() => { setEditingPromotion(promo); setModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatDate(promo.startDate)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Start</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatDate(promo.endDate)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">End</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {promo.currentUses || 0}{promo.maxUses ? ` / ${promo.maxUses}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Uses</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <PromotionModal
        open={modalOpen}
        promotion={editingPromotion}
        onClose={() => { setModalOpen(false); setEditingPromotion(null); }}
        onSaved={fetchPromotions}
      />
    </div>
  );
}
