'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  SparklesIcon,
  UserGroupIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  todayAppointments: number;
  activeStylists: number;
  walkInQueue: number;
  revenueToday: number;
}

export default function SalonDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    activeStylists: 0,
    walkInQueue: 0,
    revenueToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);

        const today = new Date().toISOString().split('T')[0];

        const [appointmentsRes, stylistsRes] = await Promise.all([
          fetch(`/api/modules/salon/appointments?from=${today}&to=${today}`),
          fetch('/api/modules/salon/stylists?active=true'),
        ]);

        if (!appointmentsRes.ok || !stylistsRes.ok) {
          throw new Error('Failed to load salon data');
        }

        const appointmentsData = await appointmentsRes.json();
        const stylistsData = await stylistsRes.json();

        const appointments = appointmentsData.data || [];
        const stylists = stylistsData.data || [];

        const revenueToday = appointments
          .filter((a: any) => a.status === 'COMPLETED')
          .reduce((sum: number, a: any) => sum + Number(a.totalPrice || 0), 0);

        const walkInCount = appointments.filter(
          (a: any) => a.walkIn && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)
        ).length;

        setStats({
          todayAppointments: appointments.length,
          activeStylists: stylists.length,
          walkInQueue: walkInCount,
          revenueToday,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <ExclamationCircleIcon className="w-12 h-12 text-red-400" />
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Appointments",
      value: stats.todayAppointments,
      icon: CalendarDaysIcon,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Active Stylists',
      value: stats.activeStylists,
      icon: UserGroupIcon,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Walk-in Queue',
      value: stats.walkInQueue,
      icon: ClockIcon,
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Revenue Today',
      value: `$${stats.revenueToday.toLocaleString('en-JM', { minimumFractionDigits: 2 })}`,
      icon: BanknotesIcon,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600',
    },
  ];

  const navCards = [
    {
      title: 'Appointments',
      description: 'View and manage upcoming appointments, confirm bookings, and track schedule.',
      href: '/salon/appointments',
      icon: CalendarDaysIcon,
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Service Catalog',
      description: 'Manage your service offerings, pricing, categories, and durations.',
      href: '/salon/services',
      icon: SparklesIcon,
      iconBg: 'bg-pink-500',
    },
    {
      title: 'Stylists',
      description: 'View stylist profiles, schedules, specialties, and commissions.',
      href: '/salon/stylists',
      icon: UserGroupIcon,
      iconBg: 'bg-purple-500',
    },
    {
      title: 'Walk-in Queue',
      description: 'Manage walk-in customers, assign stylists, and track wait times.',
      href: '/salon/walk-ins',
      icon: ClockIcon,
      iconBg: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salon & Spa</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Overview of your salon operations for today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {typeof stat.value === 'number' ? stat.value : stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {card.title}
                    </h3>
                    <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
