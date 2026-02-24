'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  BellIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api-client';

interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  {
    key: 'invoice_due',
    label: 'Invoice Due Reminders',
    description: 'Get notified when invoices are approaching due date',
    email: true,
    push: true,
    inApp: true,
  },
  {
    key: 'invoice_overdue',
    label: 'Overdue Invoices',
    description: 'Alerts for invoices past their due date',
    email: true,
    push: true,
    inApp: true,
  },
  {
    key: 'payment_received',
    label: 'Payment Received',
    description: 'Notification when a payment is recorded',
    email: true,
    push: false,
    inApp: true,
  },
  {
    key: 'low_stock',
    label: 'Low Stock Alerts',
    description: 'When inventory falls below reorder level',
    email: true,
    push: true,
    inApp: true,
  },
  {
    key: 'payroll_due',
    label: 'Payroll Reminders',
    description: 'Reminders for upcoming payroll runs',
    email: true,
    push: true,
    inApp: true,
  },
  {
    key: 'expense_status',
    label: 'Expense Updates',
    description: 'When expenses are approved or rejected',
    email: false,
    push: false,
    inApp: true,
  },
  {
    key: 'po_received',
    label: 'New Purchase Orders',
    description: 'When a new customer PO is received',
    email: true,
    push: true,
    inApp: true,
  },
  {
    key: 'bank_sync',
    label: 'Bank Sync Updates',
    description: 'Status of bank transaction imports',
    email: false,
    push: false,
    inApp: true,
  },
  {
    key: 'system',
    label: 'System Notifications',
    description: 'Important system updates and announcements',
    email: true,
    push: false,
    inApp: true,
  },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings from API on mount
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ settings: NotificationSetting[]; enableNotifications: boolean }>('/api/v1/notifications/settings');
      if (data.settings && Array.isArray(data.settings)) {
        setSettings(data.settings);
      }
    } catch {
      // If the API fails, fall back to defaults (already set)
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleSetting = (key: string, channel: 'email' | 'push' | 'inApp') => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.key === key
          ? { ...setting, [channel]: !setting[channel] }
          : setting
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.put('/api/v1/notifications/settings', { settings });
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-gray-500">Manage how you receive notifications</p>
        </div>
      </div>

      {/* Channel Legend */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <EnvelopeIcon className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-700">Email</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <DevicePhoneMobileIcon className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm text-gray-700">Push</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <BellIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm text-gray-700">In-App</span>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {settings.map((setting) => (
            <div key={setting.key} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{setting.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Email Toggle */}
                  <button
                    onClick={() => toggleSetting(setting.key, 'email')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      setting.email
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                    title="Email notifications"
                  >
                    <EnvelopeIcon className="w-5 h-5" />
                  </button>

                  {/* Push Toggle */}
                  <button
                    onClick={() => toggleSetting(setting.key, 'push')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      setting.push
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                    title="Push notifications"
                  >
                    <DevicePhoneMobileIcon className="w-5 h-5" />
                  </button>

                  {/* In-App Toggle */}
                  <button
                    onClick={() => toggleSetting(setting.key, 'inApp')}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                      setting.inApp
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                    title="In-app notifications"
                  >
                    <BellIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {saveMessage && (
          <span className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
            {saveMessage}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
