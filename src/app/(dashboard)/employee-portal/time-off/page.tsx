'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Button, Modal, ModalBody, ModalFooter, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  PlusIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────
interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  leaveType: string;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  employeeProfile: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
}

interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  PENDING: {
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    label: 'Pending',
  },
  APPROVED: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    label: 'Approved',
  },
  DENIED: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    label: 'Denied',
  },
  CANCELLED: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    label: 'Cancelled',
  },
};

const LEAVE_TYPES = [
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'OTHER', label: 'Other' },
];

// ── Component ────────────────────────────────────────────────────
export default function TimeOffPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    leaveType: 'VACATION',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileData, requestsData] = await Promise.all([
        api.get<EmployeeProfile>('/api/employee/me'),
        api.get<{ data: TimeOffRequest[] }>('/api/time-off'),
      ]);
      setProfile(profileData);
      setRequests(requestsData.data);
    } catch {
      setError('Failed to load time-off data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!profile || !formData.startDate || !formData.endDate) return;
    setSaving(true);
    setError('');

    try {
      await api.post('/api/time-off', {
        employeeProfileId: profile.id,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        reason: formData.reason || undefined,
        leaveType: formData.leaveType,
      });

      setShowCreateModal(false);
      setFormData({ startDate: '', endDate: '', reason: '', leaveType: 'VACATION' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this time-off request?')) return;

    try {
      await api.delete(`/api/time-off/${id}`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
    }
  };

  const getDayCount = (start: string, end: string): number => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Off</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Request and manage time off
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Request Time Off
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Requests list */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">No time-off requests</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Click &quot;Request Time Off&quot; to submit a request
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const badge = STATUS_BADGES[req.status] || STATUS_BADGES.PENDING;
            const days = getDayCount(req.startDate, req.endDate);

            return (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                        <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {LEAVE_TYPES.find((t) => t.value === req.leaveType)?.label || req.leaveType}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(req.startDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          -{' '}
                          {new Date(req.endDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {days} day{days !== 1 ? 's' : ''}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                            {req.reason}
                          </p>
                        )}
                        {req.reviewNotes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Manager note: {req.reviewNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cancel button for pending requests */}
                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(req.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Cancel request"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Request Time Off">
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Leave Type
                </label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  placeholder="Brief description of your leave request"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.startDate || !formData.endDate || saving}
            >
              {saving ? 'Submitting...' : 'Submit Request'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Back link */}
      <div className="text-center">
        <a
          href="/employee-portal"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          &larr; Back to Employee Portal
        </a>
      </div>
    </div>
  );
}
