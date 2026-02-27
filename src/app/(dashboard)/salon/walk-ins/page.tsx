'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClockIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  UserIcon,
  TrashIcon,
  ArrowPathIcon,
  UserGroupIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────

interface WalkIn {
  id: string;
  customerName: string;
  customerPhone: string | null;
  requestedServices: any;
  status: 'WAITING' | 'ASSIGNED' | 'IN_SERVICE' | 'COMPLETED' | 'LEFT';
  queuePosition: number;
  estimatedWait: number | null;
  preferredStylistId: string | null;
  assignedStylistId: string | null;
  assignedStylist?: Stylist | null;
  joinedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isActive: boolean;
}

interface SalonService {
  id: string;
  name: string;
  duration: number;
  price: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  WAITING: { label: 'Waiting', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  IN_SERVICE: { label: 'In Service', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  LEFT: { label: 'Left', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

function getWaitTime(joinedAt: string): string {
  const now = new Date();
  const created = new Date(joinedAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function getServiceDisplay(requestedServices: any): string {
  if (!requestedServices) return 'Walk-in';
  if (Array.isArray(requestedServices)) {
    return requestedServices.join(', ');
  }
  if (typeof requestedServices === 'string') return requestedServices;
  return 'Walk-in';
}

// ─── Component ────────────────────────────────────────────

export default function WalkInsPage() {
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Modal ──
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    requestedService: '',
    preferredStylistId: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // ── Assign modal ──
  const [assigningWalkIn, setAssigningWalkIn] = useState<WalkIn | null>(null);
  const [assignStylistId, setAssignStylistId] = useState('');

  // ── Polling for real-time feel ──
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitialLoad = useRef(true);

  // ── Fetch data ──
  const fetchWalkIns = useCallback(async () => {
    try {
      if (isInitialLoad.current) {
        setLoading(true);
      }
      setError(null);

      const res = await fetch('/api/modules/salon/walk-ins');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to fetch walk-ins');
      }

      const data = await res.json();
      setWalkIns(data.data || []);
    } catch (err) {
      if (isInitialLoad.current) {
        setError(err instanceof Error ? err.message : 'Failed to load walk-ins');
      }
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

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
    fetchWalkIns();
    fetchStylists();
    fetchServices();

    // Poll every 30 seconds for real-time feel
    intervalRef.current = setInterval(() => {
      fetchWalkIns();
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add to queue via API ──
  const handleAddToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      setFormError('Customer name is required');
      return;
    }
    if (!formData.requestedService.trim()) {
      setFormError('Please specify a service');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const selectedService = services.find((s) => s.id === formData.requestedService);
      const serviceName = selectedService?.name || formData.requestedService;

      const res = await fetch('/api/modules/salon/walk-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone.trim() || null,
          requestedServices: [serviceName],
          preferredStylistId: formData.preferredStylistId || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to add to queue');
      }

      const newWalkIn = await res.json();
      setWalkIns((prev) => [...prev, newWalkIn]);
      setShowModal(false);
      setFormData({
        customerName: '',
        customerPhone: '',
        requestedService: '',
        preferredStylistId: '',
        notes: '',
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add to queue');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Assign to stylist via API ──
  const handleAssign = async () => {
    if (!assigningWalkIn || !assignStylistId) return;

    try {
      setActionLoading(assigningWalkIn.id);

      const res = await fetch('/api/modules/salon/walk-ins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assigningWalkIn.id,
          assignedStylistId: assignStylistId,
          status: 'ASSIGNED',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to assign stylist');
      }

      // Refresh the list to get server state
      await fetchWalkIns();
      setAssigningWalkIn(null);
      setAssignStylistId('');
    } catch {
      alert('Failed to assign stylist');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove from queue via API ──
  const handleRemove = async (id: string) => {
    try {
      setActionLoading(id);

      const res = await fetch('/api/modules/salon/walk-ins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'LEFT',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to remove from queue');
      }

      setWalkIns((prev) => prev.filter((w) => w.id !== id));
    } catch {
      alert('Failed to remove from queue');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Active queue (not completed/left) ──
  const activeQueue = walkIns.filter((w) => ['WAITING', 'ASSIGNED', 'IN_SERVICE'].includes(w.status));

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <QueueListIcon className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Walk-in Queue</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {activeQueue.length > 0 ? `${activeQueue.length} in queue` : 'No one waiting'}
              <button
                onClick={() => fetchWalkIns()}
                className="ml-2 inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                Refresh
              </button>
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add to Queue
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
            onClick={() => { isInitialLoad.current = true; fetchWalkIns(); }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : activeQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <UserGroupIcon className="w-10 h-10 text-gray-300 dark:text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">No walk-ins right now</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              When customers walk in, add them to the queue to track wait times and assign stylists.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium mt-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Walk-in
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeQueue.map((walkIn, index) => {
            const statusCfg = STATUS_CONFIG[walkIn.status] || STATUS_CONFIG.WAITING;

            return (
              <div
                key={walkIn.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Position Number */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                      {walkIn.queuePosition || index + 1}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {walkIn.customerName}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-4 h-4" />
                        {getServiceDisplay(walkIn.requestedServices)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {getWaitTime(walkIn.joinedAt)} wait
                      </span>
                      {walkIn.estimatedWait != null && walkIn.status === 'WAITING' && (
                        <span className="text-xs text-gray-400">
                          ~{walkIn.estimatedWait} min est.
                        </span>
                      )}
                      {walkIn.assignedStylist && (
                        <span className="text-gray-700 dark:text-gray-300">
                          Assigned to: <span className="font-medium">{walkIn.assignedStylist.displayName}</span>
                        </span>
                      )}
                    </div>
                    {walkIn.customerPhone && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {walkIn.customerPhone}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {walkIn.status === 'WAITING' && (
                      <button
                        onClick={() => { setAssigningWalkIn(walkIn); setAssignStylistId(''); }}
                        disabled={actionLoading === walkIn.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                      >
                        <UserGroupIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Assign</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(walkIn.id)}
                      disabled={actionLoading === walkIn.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add to Queue Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Queue</h2>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddToQueue} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Customer name"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Phone number (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Requested Service *
                </label>
                {services.length > 0 ? (
                  <select
                    value={formData.requestedService}
                    onChange={(e) => setFormData({ ...formData, requestedService: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">Select a service</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} ({svc.duration} min - ${Number(svc.price).toLocaleString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.requestedService}
                    onChange={(e) => setFormData({ ...formData, requestedService: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="What service do they need?"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Stylist
                </label>
                <select
                  value={formData.preferredStylistId}
                  onChange={(e) => setFormData({ ...formData, preferredStylistId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">No preference</option>
                  {stylists.map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName}</option>
                  ))}
                </select>
              </div>

              </div>
              <div className="flex-shrink-0 flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
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
                  {formLoading ? 'Adding...' : 'Add to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Stylist Modal ── */}
      {assigningWalkIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm mx-4 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Stylist</h2>
              <button
                onClick={() => setAssigningWalkIn(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Assign <span className="font-medium text-gray-900 dark:text-white">{assigningWalkIn.customerName}</span> to a stylist.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stylist</label>
                <select
                  value={assignStylistId}
                  onChange={(e) => setAssignStylistId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select stylist</option>
                  {stylists.map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-shrink-0 flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setAssigningWalkIn(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!assignStylistId}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
