'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserGroupIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────

interface StylistService {
  id: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
}

interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  bio: string | null;
  specialties: string[];
  isActive: boolean;
  defaultCommissionType: string;
  defaultCommissionRate: number;
  workingDays: Record<string, boolean> | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  services: StylistService[];
  _count?: {
    appointments: number;
  };
}

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Component ────────────────────────────────────────────

export default function StylistsPage() {
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Detail panel ──
  const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);

  // ── Modal ──
  const [showModal, setShowModal] = useState(false);
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    phone: '',
    email: '',
    bio: '',
    specialties: '',
    defaultCommissionType: 'PERCENTAGE',
    defaultCommissionRate: '0',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // ── Fetch data ──
  const fetchStylists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/modules/salon/stylists');
      if (!res.ok) throw new Error('Failed to load stylists');

      const data = await res.json();
      setStylists(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stylists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStylists();
  }, [fetchStylists]);

  // ── Modal logic ──
  const openModal = (stylist?: Stylist) => {
    if (stylist) {
      setEditingStylist(stylist);
      setFormData({
        firstName: stylist.firstName,
        lastName: stylist.lastName,
        displayName: stylist.displayName,
        phone: stylist.phone || '',
        email: stylist.email || '',
        bio: stylist.bio || '',
        specialties: (stylist.specialties || []).join(', '),
        defaultCommissionType: stylist.defaultCommissionType || 'PERCENTAGE',
        defaultCommissionRate: String(Number(stylist.defaultCommissionRate) || 0),
      });
    } else {
      setEditingStylist(null);
      setFormData({
        firstName: '',
        lastName: '',
        displayName: '',
        phone: '',
        email: '',
        bio: '',
        specialties: '',
        defaultCommissionType: 'PERCENTAGE',
        defaultCommissionRate: '0',
      });
    }
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError('First and last name are required');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const specialtiesArr = formData.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const displayName = formData.displayName.trim() || `${formData.firstName.trim()} ${formData.lastName.trim()}`;

      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        bio: formData.bio.trim() || null,
        specialties: specialtiesArr,
        defaultCommissionType: formData.defaultCommissionType,
        defaultCommissionRate: parseFloat(formData.defaultCommissionRate) || 0,
      };

      const url = editingStylist
        ? `/api/modules/salon/stylists/${editingStylist.id}`
        : '/api/modules/salon/stylists';

      const res = await fetch(url, {
        method: editingStylist ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save stylist');
      }

      setShowModal(false);
      setEditingStylist(null);
      await fetchStylists();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save stylist');
    } finally {
      setFormLoading(false);
    }
  };

  // Auto-fill display name
  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    const newData = { ...formData, [field]: value };
    if (!editingStylist) {
      const first = field === 'firstName' ? value : formData.firstName;
      const last = field === 'lastName' ? value : formData.lastName;
      newData.displayName = `${first} ${last}`.trim();
    }
    setFormData(newData);
  };

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserGroupIcon className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stylists</h1>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Stylist
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={fetchStylists}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : stylists.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <UserGroupIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No stylists yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Add your team members to start booking appointments.</p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium mt-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Stylist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stylist Grid */}
          <div className={`${selectedStylist ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stylists.map((stylist) => {
                const isSelected = selectedStylist?.id === stylist.id;
                const todayCount = stylist._count?.appointments ?? 0;

                return (
                  <div
                    key={stylist.id}
                    onClick={() => setSelectedStylist(isSelected ? null : stylist)}
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-emerald-500 dark:border-emerald-400 ring-1 ring-emerald-500'
                        : 'border-gray-200 dark:border-gray-700'
                    } ${!stylist.isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-full ${stylist.avatarColor || getAvatarColor(stylist.displayName)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-semibold text-sm">
                          {getInitials(stylist.displayName)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {stylist.displayName}
                          </h3>
                          {stylist.isActive ? (
                            <span className="inline-flex items-center w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Specialties */}
                        {stylist.specialties && stylist.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {stylist.specialties.slice(0, 3).map((spec, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs"
                              >
                                {spec}
                              </span>
                            ))}
                            {stylist.specialties.length > 3 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                +{stylist.specialties.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Today's appointments */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDaysIcon className="w-3.5 h-3.5" />
                            {todayCount} today
                          </span>
                          <ChevronRightIcon className="w-3.5 h-3.5 ml-auto text-gray-300 dark:text-gray-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedStylist && (
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Stylist Details</h3>
                  <button
                    onClick={() => openModal(selectedStylist)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Edit
                  </button>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-16 h-16 rounded-full ${selectedStylist.avatarColor || getAvatarColor(selectedStylist.displayName)} flex items-center justify-center`}>
                    <span className="text-white font-bold text-lg">
                      {getInitials(selectedStylist.displayName)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{selectedStylist.displayName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedStylist.firstName} {selectedStylist.lastName}
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-2 mb-4">
                  {selectedStylist.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <PhoneIcon className="w-4 h-4" />
                      <span>{selectedStylist.phone}</span>
                    </div>
                  )}
                  {selectedStylist.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <EnvelopeIcon className="w-4 h-4" />
                      <span className="truncate">{selectedStylist.email}</span>
                    </div>
                  )}
                </div>

                {/* Bio */}
                {selectedStylist.bio && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Bio</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedStylist.bio}</p>
                  </div>
                )}

                {/* Specialties */}
                {selectedStylist.specialties && selectedStylist.specialties.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStylist.specialties.map((spec, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs"
                        >
                          <SparklesIcon className="w-3 h-3" />
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commission */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Commission</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {Number(selectedStylist.defaultCommissionRate) || 0}
                    {selectedStylist.defaultCommissionType === 'PERCENTAGE' ? '%' : ' (fixed)'}
                  </p>
                </div>

                {/* Working Hours */}
                {selectedStylist.workingHoursStart && selectedStylist.workingHoursEnd && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Working Hours</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedStylist.workingHoursStart} - {selectedStylist.workingHoursEnd}
                    </p>
                  </div>
                )}

                {/* Services */}
                {selectedStylist.services && selectedStylist.services.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Services</p>
                    <div className="space-y-1">
                      {selectedStylist.services.map((ss) => (
                        <div
                          key={ss.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="text-gray-700 dark:text-gray-300">{ss.service.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            ${Number(ss.service.price).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedStylist(null)}
                  className="w-full mt-4 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingStylist ? 'Edit Stylist' : 'Add Stylist'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleNameChange('firstName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleNameChange('lastName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Auto-filled from name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specialties <span className="text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formData.specialties}
                  onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Braids, Coloring, Extensions"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commission Type</label>
                  <select
                    value={formData.defaultCommissionType}
                    onChange={(e) => setFormData({ ...formData, defaultCommissionType: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Commission Rate</label>
                  <input
                    type="number"
                    value={formData.defaultCommissionRate}
                    onChange={(e) => setFormData({ ...formData, defaultCommissionRate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                    max={formData.defaultCommissionType === 'PERCENTAGE' ? '100' : undefined}
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Brief bio about this stylist..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {formLoading ? 'Saving...' : editingStylist ? 'Update Stylist' : 'Add Stylist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
