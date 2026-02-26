'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TruckIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api-client';
import type { ParkingSlip, ParkingSlipStatus } from '@/types/parkingSlip';
import {
  PARKING_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  calculateParkingDuration,
  calculateParkingAmount,
} from '@/types/parkingSlip';

const FILTER_OPTIONS: { value: ParkingSlipStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ParkingSlipPage() {
  const [parkingSlips, setParkingSlips] = useState<ParkingSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ParkingSlipStatus | 'all'>('all');

  const fetchSlips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<{ data: ParkingSlip[] } | ParkingSlip[]>('/api/v1/parking-slips');
      const list = Array.isArray(data) ? data : (data as any).data ?? [];
      setParkingSlips(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load parking slips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlips();
  }, [fetchSlips]);

  const filteredSlips = useMemo(() => {
    let result = [...parkingSlips];

    if (activeFilter !== 'all') {
      result = result.filter((slip) => slip.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((slip) =>
        slip.slipNumber.toLowerCase().includes(query) ||
        slip.vehiclePlate.toLowerCase().includes(query) ||
        slip.driverName?.toLowerCase().includes(query)
      );
    }

    result.sort(
      (a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
    );

    return result;
  }, [parkingSlips, activeFilter, searchQuery]);

  const getStatusColor = (status: ParkingSlipStatus) => {
    const colors: Record<ParkingSlipStatus, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[status];
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Stats
  const activeCount = parkingSlips.filter(s => s.status === 'active').length;
  const todayRevenue = parkingSlips
    .filter(s => s.status === 'completed' && s.exitTime &&
      new Date(s.exitTime).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading parking slips...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchSlips}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parking Slips</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage parking lot operations</p>
        </div>
        <Link
          href="/parking-slip/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New Entry
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TruckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Vehicles</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ClockIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {parkingSlips.filter(s =>
                  new Date(s.entryTime).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Today&apos;s Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${todayRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by slip number, plate, driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parking Slip List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredSlips.length === 0 ? (
          <div className="p-12 text-center">
            <TruckIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No parking slips found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Start tracking vehicles by creating a new entry</p>
            <Link
              href="/parking-slip/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <PlusIcon className="w-5 h-5" />
              New Entry
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredSlips.map((slip) => {
              const duration = calculateParkingDuration(slip.entryTime, slip.exitTime);
              const amount = slip.totalAmount || calculateParkingAmount(duration, slip.hourlyRate);

              return (
                <Link
                  key={slip.id}
                  href={`/parking-slip/${slip.id}`}
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{slip.slipNumber}</span>
                        <span className="text-lg font-bold text-emerald-600">{slip.vehiclePlate}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {slip.vehicleType ? VEHICLE_TYPE_LABELS[slip.vehicleType] : 'Vehicle'}
                        {slip.vehicleColor && ` - ${slip.vehicleColor}`}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(slip.status)}`}>
                      {PARKING_STATUS_LABELS[slip.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Entry</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {format(new Date(slip.entryTime), 'HH:mm')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(slip.entryTime), 'dd MMM')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Exit</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {slip.exitTime ? format(new Date(slip.exitTime), 'HH:mm') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Duration</span>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDuration(duration)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Amount</span>
                      <p className="font-medium text-gray-900 dark:text-white">${amount.toLocaleString()}</p>
                      {slip.isPaid && (
                        <span className="text-xs text-green-600">Paid</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
