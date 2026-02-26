'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  TruckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XMarkIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/store/appStore';
import {
  PARKING_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  calculateParkingDuration,
  calculateParkingAmount,
} from '@/types/parkingSlip';
import type { ParkingSlip, ParkingSlipStatus } from '@/types/parkingSlip';
import { printContent, generateStatCards, formatPrintCurrency } from '@/lib/print';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ParkingSlipDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const activeCompany = useAppStore((state) => state.activeCompany);

  const [slip, setSlip] = useState<ParkingSlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');

  const fetchSlip = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<ParkingSlip>(`/api/v1/parking-slips/${id}`);
      setSlip(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load parking slip');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSlip();
  }, [fetchSlip]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading parking slip...</p>
        </div>
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <TruckIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {error || 'Slip Not Found'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">The parking slip you are looking for doesn't exist or could not be loaded.</p>
        <Link
          href="/parking-slip"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Back to Parking Slips
        </Link>
      </div>
    );
  }

  const duration = calculateParkingDuration(slip.entryTime, slip.exitTime);
  const amount = slip.totalAmount || calculateParkingAmount(duration, slip.hourlyRate);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
    }
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  const getStatusColor = (status: ParkingSlipStatus) => {
    const colors: Record<ParkingSlipStatus, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[status];
  };

  const handleCheckout = async () => {
    setUpdating(true);
    try {
      await api.post(`/api/v1/parking-slips/${slip.id}/exit`);
      await api.post(`/api/v1/parking-slips/${slip.id}/payment`, {
        paymentMethod,
        totalAmount: amount,
      });
      router.push('/parking-slip');
    } catch (err: any) {
      alert(err.message || 'Failed to complete checkout');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this parking slip?')) return;
    setUpdating(true);
    try {
      await api.put(`/api/v1/parking-slips/${slip.id}`, { status: 'cancelled' });
      router.push('/parking-slip');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel parking slip');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    const content = `
      ${generateStatCards([
        { label: 'Duration', value: formatDuration(duration) },
        { label: 'Amount Due', value: formatPrintCurrency(amount), color: '#059669' },
        { label: 'Hourly Rate', value: formatPrintCurrency(slip.hourlyRate) + '/hr' },
      ])}
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Vehicle Details</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">License Plate</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.vehiclePlate}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Vehicle Type</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.vehicleType ? VEHICLE_TYPE_LABELS[slip.vehicleType] : '-'}</td></tr>
        ${slip.vehicleColor ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Color</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.vehicleColor}</td></tr>` : ''}
      </table>
      <h3 style="margin: 20px 0 10px; font-weight: 600;">Time Information</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Entry Time</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${format(new Date(slip.entryTime), 'dd MMM yyyy, HH:mm')}</td></tr>
        ${slip.exitTime ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Exit Time</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${format(new Date(slip.exitTime), 'dd MMM yyyy, HH:mm')}</td></tr>` : ''}
        ${slip.lotName ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Lot</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.lotName}</td></tr>` : ''}
        ${slip.spotNumber ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Spot</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.spotNumber}</td></tr>` : ''}
      </table>
      ${slip.driverName || slip.driverPhone ? `
        <h3 style="margin: 20px 0 10px; font-weight: 600;">Driver Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${slip.driverName ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Name</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.driverName}</td></tr>` : ''}
          ${slip.driverPhone ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Phone</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:500;">${slip.driverPhone}</td></tr>` : ''}
        </table>
      ` : ''}
    `;

    printContent({
      title: `Parking Slip ${slip.slipNumber}`,
      subtitle: `${slip.vehiclePlate} | ${PARKING_STATUS_LABELS[slip.status]}`,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/parking-slip"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{slip.slipNumber}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(slip.status)}`}>
                {PARKING_STATUS_LABELS[slip.status]}
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{slip.vehiclePlate}</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Print parking slip"
        >
          <PrinterIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Time & Cost Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <ClockIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDuration(duration)}</p>
              </div>
              <div className="text-center border-x border-gray-200 dark:border-gray-700">
                <CurrencyDollarIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Amount Due</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">${amount.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <TruckIcon className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Rate</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">${slip.hourlyRate}/hr</p>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Vehicle Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">License Plate</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{slip.vehiclePlate}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Vehicle Type</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {slip.vehicleType ? VEHICLE_TYPE_LABELS[slip.vehicleType] : '-'}
                </dd>
              </div>
              {slip.vehicleColor && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Color</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{slip.vehicleColor}</dd>
                </div>
              )}
              {slip.vehicleDescription && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{slip.vehicleDescription}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Driver Details */}
          {(slip.driverName || slip.driverPhone) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Driver Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                {slip.driverName && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{slip.driverName}</dd>
                  </div>
                )}
                {slip.driverPhone && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{slip.driverPhone}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Notes */}
          {slip.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Notes</h2>
              <p className="text-gray-700 dark:text-gray-300">{slip.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Time Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Time Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Entry Time</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(slip.entryTime), 'dd MMM yyyy, HH:mm')}
                </dd>
              </div>
              {slip.exitTime && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Exit Time</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(slip.exitTime), 'dd MMM yyyy, HH:mm')}
                  </dd>
                </div>
              )}
              {slip.lotName && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Lot</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{slip.lotName}</dd>
                </div>
              )}
              {slip.spotNumber && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Spot</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{slip.spotNumber}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Payment / Checkout */}
          {slip.status === 'active' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Checkout</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'mobile'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        paymentMethod === method
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Due</span>
                  <span className="text-emerald-600">${amount.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
              >
                <CheckCircleIcon className="w-5 h-5" />
                {updating ? 'Processing...' : 'Complete Checkout'}
              </button>
            </div>
          )}

          {/* Status Actions */}
          {slip.status === 'active' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
              <button
                onClick={handleCancel}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                <XMarkIcon className="w-4 h-4" />
                {updating ? 'Cancelling...' : 'Cancel Slip'}
              </button>
            </div>
          )}

          {/* Payment Info (if completed) */}
          {slip.status === 'completed' && slip.isPaid && (
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800 p-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h2 className="font-semibold text-green-800 dark:text-green-300">Payment Complete</h2>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-green-700 dark:text-green-400">Amount Paid</dt>
                  <dd className="font-medium text-green-800 dark:text-green-300">${(slip.totalAmount || 0).toLocaleString()}</dd>
                </div>
                {slip.paymentMethod && (
                  <div className="flex justify-between">
                    <dt className="text-green-700 dark:text-green-400">Method</dt>
                    <dd className="font-medium text-green-800 dark:text-green-300 capitalize">{slip.paymentMethod}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
