'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Squares2X2Icon,
  CalendarDaysIcon,
  BookOpenIcon,
  FireIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// ── Types ────────────────────────────────────────────────────────────
interface TableSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
}

interface ReservationSummary {
  todayCount: number;
  upcomingCount: number;
  pendingCount: number;
}

interface KitchenSummary {
  newOrders: number;
  inProgress: number;
  ready: number;
}

// ── Stat Card ────────────────────────────────────────────────────────
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

// ── Main Page ────────────────────────────────────────────────────────
export default function RestaurantPage() {
  const [tableSummary, setTableSummary] = useState<TableSummary | null>(null);
  const [reservationSummary, setReservationSummary] = useState<ReservationSummary | null>(null);
  const [kitchenSummary, setKitchenSummary] = useState<KitchenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [tablesRes, reservationsRes, kitchenRes] = await Promise.allSettled([
        fetch('/api/modules/restaurant/tables'),
        fetch('/api/modules/restaurant/reservations?filter=today'),
        fetch('/api/modules/restaurant/kitchen'),
      ]);

      // Parse tables
      if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
        const tablesData = await tablesRes.value.json();
        const tables = tablesData.data || tablesData || [];
        const tableArr = Array.isArray(tables) ? tables : [];
        setTableSummary({
          total: tableArr.length,
          available: tableArr.filter((t: { status: string }) => t.status === 'AVAILABLE').length,
          occupied: tableArr.filter((t: { status: string }) => t.status === 'OCCUPIED').length,
          reserved: tableArr.filter((t: { status: string }) => t.status === 'RESERVED').length,
          cleaning: tableArr.filter((t: { status: string }) => t.status === 'CLEANING').length,
        });
      } else {
        setTableSummary({ total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 });
      }

      // Parse reservations
      if (reservationsRes.status === 'fulfilled' && reservationsRes.value.ok) {
        const resData = await reservationsRes.value.json();
        const reservations = resData.data || resData || [];
        const resArr = Array.isArray(reservations) ? reservations : [];
        setReservationSummary({
          todayCount: resArr.length,
          upcomingCount: resArr.filter((r: { status: string }) => ['PENDING', 'CONFIRMED'].includes(r.status)).length,
          pendingCount: resArr.filter((r: { status: string }) => r.status === 'PENDING').length,
        });
      } else {
        setReservationSummary({ todayCount: 0, upcomingCount: 0, pendingCount: 0 });
      }

      // Parse kitchen
      if (kitchenRes.status === 'fulfilled' && kitchenRes.value.ok) {
        const kitchenData = await kitchenRes.value.json();
        const orders = kitchenData.data || kitchenData || [];
        const orderArr = Array.isArray(orders) ? orders : [];
        setKitchenSummary({
          newOrders: orderArr.filter((o: { status: string }) => o.status === 'NEW').length,
          inProgress: orderArr.filter((o: { status: string }) => o.status === 'IN_PROGRESS').length,
          ready: orderArr.filter((o: { status: string }) => o.status === 'READY').length,
        });
      } else {
        setKitchenSummary({ newOrders: 0, inProgress: 0, ready: 0 });
      }
    } catch {
      setError('Failed to load restaurant overview data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const navCards = [
    {
      name: 'Floor Plan',
      description: 'Manage tables, seating, and floor layout',
      href: '/restaurant/tables',
      icon: Squares2X2Icon,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Reservations',
      description: 'View and manage guest reservations',
      href: '/restaurant/reservations',
      icon: CalendarDaysIcon,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
    {
      name: 'Menu',
      description: 'Categories, items, pricing, and availability',
      href: '/restaurant/menu',
      icon: BookOpenIcon,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
    {
      name: 'Kitchen Display',
      description: 'Real-time kitchen order tracking',
      href: '/restaurant/kitchen',
      icon: FireIcon,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
    {
      name: 'Tips',
      description: 'Track server tips and distributions',
      href: '/restaurant/tips',
      icon: BanknotesIcon,
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300">Failed to load</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const kitchenQueueTotal = kitchenSummary
    ? kitchenSummary.newOrders + kitchenSummary.inProgress
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BuildingStorefrontIcon className="w-7 h-7 text-orange-500" />
            Restaurant & Bar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Table management, reservations, kitchen, and more
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 self-start"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Squares2X2Icon}
          label="Active Tables"
          value={tableSummary?.occupied ?? 0}
          subtext={`${tableSummary?.total ?? 0} total tables`}
          color="bg-blue-600"
        />
        <StatCard
          icon={CalendarDaysIcon}
          label="Today's Reservations"
          value={reservationSummary?.todayCount ?? 0}
          subtext={reservationSummary?.pendingCount ? `${reservationSummary.pendingCount} pending` : 'All confirmed'}
          color="bg-purple-600"
        />
        <StatCard
          icon={FireIcon}
          label="Kitchen Queue"
          value={kitchenQueueTotal}
          subtext={kitchenSummary?.ready ? `${kitchenSummary.ready} ready for pickup` : 'No orders ready'}
          color="bg-red-600"
        />
        <StatCard
          icon={BanknotesIcon}
          label="Tips Today"
          value="--"
          subtext="From POS transactions"
          color="bg-emerald-600"
        />
      </div>

      {/* Table status summary */}
      {tableSummary && tableSummary.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Table Status</h3>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tableSummary.available} Available
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tableSummary.occupied} Occupied
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tableSummary.reserved} Reserved
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tableSummary.cleaning} Cleaning
              </span>
            </div>
          </div>
          {/* Progress bar */}
          {tableSummary.total > 0 && (
            <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
              {tableSummary.available > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(tableSummary.available / tableSummary.total) * 100}%` }}
                />
              )}
              {tableSummary.occupied > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(tableSummary.occupied / tableSummary.total) * 100}%` }}
                />
              )}
              {tableSummary.reserved > 0 && (
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(tableSummary.reserved / tableSummary.total) * 100}%` }}
                />
              )}
              {tableSummary.cleaning > 0 && (
                <div
                  className="bg-gray-400"
                  style={{ width: `${(tableSummary.cleaning / tableSummary.total) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {navCards.map((card) => (
            <Link key={card.name} href={card.href}>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow cursor-pointer h-full flex items-center gap-4">
                <div className={`p-3 rounded-xl ${card.color} flex-shrink-0`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{card.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{card.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
