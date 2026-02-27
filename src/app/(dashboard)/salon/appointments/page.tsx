'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDaysIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  PlayIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerId: string | null;
  stylistId: string;
  stylist: Stylist;
  date: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  totalPrice: number;
  depositPaid: number;
  notes: string | null;
  status: string;
  services: AppointmentService[];
  createdAt: string;
}

interface AppointmentService {
  id: string;
  serviceId: string;
  price: number;
  duration: number;
  service: SalonService;
}

interface SalonService {
  id: string;
  name: string;
  price: number;
  duration: number;
  category?: { id: string; name: string };
}

interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isActive: boolean;
}

type TabKey = 'today' | 'upcoming' | 'past';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  BOOKED: { label: 'Booked', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  NO_SHOW: { label: 'No Show', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

// ─── Component ────────────────────────────────────────────

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Form state ──
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    stylistId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    notes: '',
    serviceIds: [] as string[],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // ── Fetch data ──
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/modules/salon/appointments?';
      const today = new Date().toISOString().split('T')[0];

      if (activeTab === 'today') {
        url += `from=${selectedDate}&to=${selectedDate}`;
      } else if (activeTab === 'upcoming') {
        url += `from=${today}`;
      } else {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 30);
        url += `to=${today}`;
      }

      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load appointments');
      const data = await res.json();
      setAppointments(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate, search]);

  const fetchStylists = useCallback(async () => {
    try {
      const res = await fetch('/api/modules/salon/stylists?active=true');
      if (!res.ok) return;
      const data = await res.json();
      setStylists(data.data || []);
    } catch {
      // silent
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/modules/salon/services?active=true');
      if (!res.ok) return;
      const data = await res.json();
      setServices(data.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    fetchStylists();
    fetchServices();
  }, [fetchStylists, fetchServices]);

  // ── Status actions ──
  const handleStatusAction = async (id: string, action: 'confirm' | 'start' | 'complete' | 'cancel' | 'no-show') => {
    try {
      setActionLoading(id);

      let url: string;
      let method = 'POST';

      if (action === 'confirm') {
        url = `/api/modules/salon/appointments/${id}/confirm`;
      } else if (action === 'start') {
        url = `/api/modules/salon/appointments/${id}/start`;
      } else if (action === 'complete' || action === 'cancel' || action === 'no-show') {
        url = `/api/modules/salon/appointments/${id}`;
        method = 'PUT';
      } else {
        return;
      }

      const body = action === 'complete'
        ? { status: 'COMPLETED' }
        : action === 'cancel'
        ? { status: 'CANCELLED' }
        : action === 'no-show'
        ? { status: 'NO_SHOW' }
        : undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${action} appointment`);
      }

      await fetchAppointments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Create appointment ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.serviceIds.length === 0) {
      setFormError('Please select at least one service');
      return;
    }
    if (!formData.stylistId) {
      setFormError('Please select a stylist');
      return;
    }
    if (!formData.customerName.trim()) {
      setFormError('Customer name is required');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const res = await fetch('/api/modules/salon/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone || null,
          customerEmail: formData.customerEmail || null,
          stylistId: formData.stylistId,
          date: formData.date,
          startTime: formData.startTime,
          notes: formData.notes || null,
          serviceIds: formData.serviceIds,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create appointment');
      }

      setShowModal(false);
      setFormData({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        stylistId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        notes: '',
        serviceIds: [],
      });
      await fetchAppointments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleService = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((s) => s !== id)
        : [...prev.serviceIds, id],
    }));
  };

  // ── Render helpers ──
  const getActions = (appt: Appointment) => {
    const actions: Array<{ label: string; action: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [];
    switch (appt.status) {
      case 'BOOKED':
        actions.push(
          { label: 'Confirm', action: 'confirm', icon: CheckCircleIcon, color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30' },
          { label: 'Start', action: 'start', icon: PlayIcon, color: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30' },
          { label: 'Cancel', action: 'cancel', icon: XCircleIcon, color: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' },
        );
        break;
      case 'CONFIRMED':
        actions.push(
          { label: 'Start', action: 'start', icon: PlayIcon, color: 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30' },
          { label: 'Cancel', action: 'cancel', icon: XCircleIcon, color: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' },
          { label: 'No Show', action: 'no-show', icon: ExclamationCircleIcon, color: 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700' },
        );
        break;
      case 'IN_PROGRESS':
        actions.push(
          { label: 'Complete', action: 'complete', icon: CheckCircleIcon, color: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30' },
        );
        break;
    }
    return actions;
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === 'today') return true;
    const today = new Date().toISOString().split('T')[0];
    const apptDate = new Date(appt.date).toISOString().split('T')[0];
    if (activeTab === 'upcoming') return apptDate >= today;
    return apptDate <= today;
  });

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDaysIcon className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Appointment
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {activeTab === 'today' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
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
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
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
            onClick={fetchAppointments}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <CalendarDaysIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No appointments found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {activeTab === 'today' ? 'No appointments for this date.' : 'No appointments in this range.'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium mt-2"
          >
            <PlusIcon className="w-4 h-4" />
            Book Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appt) => {
            const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.BOOKED;
            const actions = getActions(appt);

            return (
              <div
                key={appt.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  {/* Left - Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {appt.customerName}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {appt.startTime} - {appt.endTime}
                      </span>
                      <span>{appt.totalDuration} min</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        ${Number(appt.totalPrice).toLocaleString('en-JM', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {appt.services.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          {s.service.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Stylist: <span className="text-gray-700 dark:text-gray-300">{appt.stylist?.displayName || 'Unassigned'}</span>
                    </p>
                    {appt.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic truncate">
                        {appt.notes}
                      </p>
                    )}
                  </div>

                  {/* Right - Actions */}
                  {actions.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {actions.map((act) => (
                        <button
                          key={act.action}
                          onClick={() => handleStatusAction(appt.id, act.action as any)}
                          disabled={actionLoading === appt.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${act.color} disabled:opacity-50`}
                          title={act.label}
                        >
                          <act.icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Appointment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Appointment</h2>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter customer name"
                  required
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Email address"
                  />
                </div>
              </div>

              {/* Stylist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stylist *
                </label>
                <select
                  value={formData.stylistId}
                  onChange={(e) => setFormData({ ...formData, stylistId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select stylist</option>
                  {stylists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time *</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Services */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Services * ({formData.serviceIds.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                  {services.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 p-2">No services available</p>
                  ) : (
                    services.map((svc) => (
                      <label
                        key={svc.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          formData.serviceIds.includes(svc.id)
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(svc.id)}
                            onChange={() => toggleService(svc.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{svc.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {svc.duration}min / ${Number(svc.price).toLocaleString()}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Special requests or notes..."
                />
              </div>

              {/* Submit */}
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
                  {formLoading ? 'Creating...' : 'Create Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
