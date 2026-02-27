'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────
interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarColor: string;
  role: string;
  lastLoginAt: string | null;
}

interface EmployeeStats {
  period: { days: number };
  stats: {
    totalShifts: number;
    hoursWorked: number;
    totalSales: number;
    totalTips: number;
    totalTransactions: number;
    avgTicket: number;
    salesPerHour: number;
  };
}

// ── Component ────────────────────────────────────────────────────
export default function EmployeePortalPage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profileData, statsData] = await Promise.all([
          api.get<EmployeeProfile>('/api/employee/me'),
          api.get<EmployeeStats>('/api/employee/me/stats?period=30'),
        ]);
        setProfile(profileData);
        setStats(statsData);
      } catch {
        setError('Failed to load portal data. You may not have an employee profile configured.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardDocumentListIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Employee Portal</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {error || 'Your employee profile has not been set up yet. Contact your manager to create your POS profile.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `J$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const tabs = [
    {
      name: 'Schedule',
      icon: CalendarDaysIcon,
      href: '/employee-portal/schedule',
      description: 'View your upcoming shifts',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Stats',
      icon: ChartBarIcon,
      href: '/employee-portal/stats',
      description: 'View your performance metrics',
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      name: 'Time Off',
      icon: CalendarIcon,
      href: '/employee-portal/time-off',
      description: 'Request and view time off',
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.displayName || `${profile.firstName} ${profile.lastName}`}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {profile.role.replace('POS_', '').replace('_', ' ')}
              </p>
              {profile.lastLoginAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Last login: {new Date(profile.lastLoginAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats (30-day) */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Hours (30d)</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.stats.hoursWorked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ChartBarIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sales (30d)</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.stats.totalSales)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Ticket</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.stats.avgTicket)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tips (30d)</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.stats.totalTips)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tabs.map((tab) => (
          <Link key={tab.name} href={tab.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${tab.color}`}>
                  <tab.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{tab.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tab.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
