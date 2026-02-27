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
  requestedService: string;
  status: 'WAITING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REMOVED';
  position: number;
  stylistId: string | null;
  stylist?: Stylist | null;
  notes: string | null;
  createdAt: string;
  assignedAt: string | null;
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
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  REMOVED: { label: 'Removed', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

function getWaitTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
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
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // ── Assign modal ──
  const [assigningWalkIn, setAssigningWalkIn] = useState<WalkIn | null>(null);
  const [assignStylistId, setAssignStylistId] = useState('');

  // ── Polling for real-time feel ──
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch data ──
  const fetchWalkIns = useCallback(async () => {
    try {
      if (!loading) {
        // Don't set loading on poll refreshes to avoid flicker
      } else {
        setLoading(true);
      }
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/modules/salon/appointments?from=${today}&to=${today}&status=WAITING,ASSIGNED,IN_PROGRESS`);

      if (!res.ok) {
        // If the walk-in endpoint doesn't exist, fall back to showing
        // appointments that came from walk-ins. We'll manage state locally.
        setWalkIns([]);
        return;
      }

      const data = await res.json();
      // Filter for walk-in type appointments or just show all for the queue
      // Since there's no dedicated walk-in API, we'll manage state locally
      setWalkIns(data.data || []);
    } catch (err) {
      if (loading) {
        setError(err instanceof Error ? err.message : 'Failed to load walk-ins');
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

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

  // ── Local walk-in queue (client-managed for now) ──
  const [localQueue, setLocalQueue] = useState<WalkIn[]>([]);

  // ── Add to queue ──
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

      // Create as a walk-in appointment
      const selectedService = services.find((s) => s.id === formData.requestedService);
      const serviceName = selectedService?.name || formData.requestedService;

      // Add to local queue with a temporary entry
      const newWalkIn: WalkIn = {
        id: `local-${Date.now()}`,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim() || null,
        requestedService: serviceName,
        status: 'WAITING',
        position: localQueue.length + 1,
        stylistId: null,
        stylist: null,
        notes: formData.notes.trim() || null,
        createdAt: new Date().toISOString(),
        assignedAt: null,
      };

      setLocalQueue((prev) => [...prev, newWalkIn]);
      setShowModal(false);
      setFormData({
        customerName: '',
        customerPhone: '',
        requestedService: '',
        notes: '',
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add to queue');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Assign to stylist ──
  const handleAssign = async () => {
    if (!assigningWalkIn || !assignStylistId) return;

    try {
      setActionLoading(assigningWalkIn.id);

      const stylist = stylists.find((s) => s.id === assignStylistId);

      setLocalQueue((prev) =>
        prev.map((w) =>
          w.id === assigningWalkIn.id
            ? { ...w, status: 'ASSIGNED' as const, stylistId: assignStylistId, stylist: stylist || null, assignedAt: new Date().toISOString() }
            : w
        )
      );

      setAssigningWalkIn(null);
      setAssignStylistId('');
    } catch {
      alert('Failed to assign stylist');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove from queue ──
  const handleRemove = (id: string) => {
    setLocalQueue((prev) => prev.filter((w) => w.id !== id));
  };

  // ── Active queue (not completed/removed) ──
  const activeQueue = localQueue.filter((w) => ['WAITING', 'ASSIGNED'].includes(w.status));

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
            onClick={() => { setLoading(true); fetchWalkIns(); }}
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
                      {index + 1}
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
                        {walkIn.requestedService}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {getWaitTime(walkIn.createdAt)} wait
                      </span>
                      {walkIn.stylist && (
                        <span className="text-gray-700 dark:text-gray-300">
                          Assigned to: <span className="font-medium">{walkIn.stylist.displayName}</span>
                        </span>
                      )}
                    </div>
                    {walkIn.customerPhone && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {walkIn.customerPhone}
                      </p>
                    )}
                    {walkIn.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                        {walkIn.notes}
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Queue</h2>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddToQueue} className="p-5 space-y-4">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                  placeholder="Any special requests..."
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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Stylist</h2>
              <button
                onClick={() => setAssigningWalkIn(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
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

              <div className="flex justify-end gap-3 pt-2">
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
        </div>
      )}
    </div>
  );
}
