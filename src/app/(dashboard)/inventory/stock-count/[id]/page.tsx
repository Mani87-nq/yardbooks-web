'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  useStockCount,
  useUpdateStockCount,
  useUpdateStockCountItem,
} from '@/hooks/api/useStockCounts';
import type { StockCountItemAPI } from '@/hooks/api/useStockCounts';

interface PageProps {
  params: Promise<{ id: string }>;
}

type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'APPROVED' | 'POSTED' | 'CANCELLED';

export default function StockCountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'variance'>('all');

  // Tracks local counted quantities while user is entering (before they blur/save)
  const [pendingCounts, setPendingCounts] = useState<Record<string, number | undefined>>({});

  // API hooks
  const { data: stockCount, isLoading, error: fetchError, refetch } = useStockCount(id);
  const updateStockCount = useUpdateStockCount();
  const updateItem = useUpdateStockCountItem();

  const items: StockCountItemAPI[] = stockCount?.items ?? [];
  const status = (stockCount?.status ?? 'DRAFT') as StockCountStatus;
  const isMutable = !['APPROVED', 'POSTED', 'CANCELLED'].includes(status);

  const updateCount = useCallback((item: StockCountItemAPI, value: number) => {
    // Optimistically update local state
    setPendingCounts(prev => ({ ...prev, [item.id]: value }));

    // Send to API
    updateItem.mutate(
      {
        stockCountId: id,
        itemId: item.id,
        data: { countedQuantity: value },
      },
      {
        onSuccess: () => {
          // Clear pending state once confirmed
          setPendingCounts(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        },
        onError: () => {
          // Revert on error
          setPendingCounts(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
        },
      }
    );
  }, [id, updateItem]);

  const getCountedQty = (item: StockCountItemAPI): number | null => {
    if (pendingCounts[item.id] !== undefined) return pendingCounts[item.id]!;
    return item.countedQuantity;
  };

  const getItemStatus = (item: StockCountItemAPI): 'pending' | 'counted' => {
    const qty = getCountedQty(item);
    return qty !== null ? 'counted' : 'pending';
  };

  const getVariance = (item: StockCountItemAPI): number => {
    const counted = getCountedQty(item);
    if (counted === null) return 0;
    return counted - item.expectedQuantity;
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'pending') return getItemStatus(item) === 'pending';
    if (activeTab === 'variance') return getVariance(item) !== 0 && getItemStatus(item) === 'counted';
    return true;
  });

  const countedCount = items.filter(i => getItemStatus(i) === 'counted').length;
  const progress = items.length > 0 ? Math.round((countedCount / items.length) * 100) : 0;
  const varianceCount = items.filter(i => getVariance(i) !== 0 && getItemStatus(i) === 'counted').length;

  const handleCompleteCount = async () => {
    if (!confirm('Mark this count as pending review?')) return;
    try {
      await updateStockCount.mutateAsync({
        id,
        data: { status: 'PENDING_REVIEW' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete count';
      alert(message);
    }
  };

  const handleCancelCount = async () => {
    if (!confirm('Are you sure you want to cancel this count?')) return;
    try {
      await updateStockCount.mutateAsync({
        id,
        data: { status: 'CANCELLED' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel count';
      alert(message);
    }
  };

  const getStatusLabel = (s: StockCountStatus) => {
    const labels: Record<StockCountStatus, string> = {
      DRAFT: 'Draft',
      IN_PROGRESS: 'In Progress',
      PENDING_REVIEW: 'Pending Review',
      APPROVED: 'Approved',
      POSTED: 'Posted',
      CANCELLED: 'Cancelled',
    };
    return labels[s] || s;
  };

  const getStatusColor = (s: StockCountStatus) => {
    const colors: Record<StockCountStatus, string> = {
      DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      POSTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[s] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/inventory/stock-count" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loading...</h1>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading stock count...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError || !stockCount) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/inventory/stock-count" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Count</h1>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-300">
              {fetchError instanceof Error ? fetchError.message : 'Failed to load stock count.'}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            <ArrowPathIcon className="w-4 h-4 inline mr-1" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/stock-count" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stockCount.countNumber}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                {getStatusLabel(status)}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">{stockCount.name}</p>
            {stockCount.warehouseName && (
              <p className="text-sm text-gray-400 dark:text-gray-500">{stockCount.warehouseName}</p>
            )}
          </div>
        </div>
        {isMutable && (
          <div className="flex gap-2">
            <button
              onClick={handleCancelCount}
              disabled={updateStockCount.isPending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel Count
            </button>
            <button
              onClick={handleCompleteCount}
              disabled={updateStockCount.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {updateStockCount.isPending ? 'Saving...' : 'Complete Count'}
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Counting Progress</h2>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {countedCount} of {items.length} items counted
          </span>
          {varianceCount > 0 && (
            <span className="text-orange-600 flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" />
              {varianceCount} variance{varianceCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All Items', count: items.length },
          { value: 'pending', label: 'Pending', count: items.filter(i => getItemStatus(i) === 'pending').length },
          { value: 'variance', label: 'Variances', count: varianceCount },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-white/20">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending' ? 'All items have been counted' :
               activeTab === 'variance' ? 'No variances found' :
               'No items in this stock count'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-center">Expected</th>
                  <th className="px-4 py-3 font-medium text-center">Counted</th>
                  <th className="px-4 py-3 font-medium text-center">Variance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredItems.map((item) => {
                  const counted = getCountedQty(item);
                  const itemStatus = getItemStatus(item);
                  const variance = getVariance(item);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">{item.productName}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{item.sku}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{item.expectedQuantity}</td>
                      <td className="px-4 py-3">
                        {isMutable ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateCount(item, Math.max((counted ?? 0) - 1, 0))}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                              disabled={updateItem.isPending}
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={counted ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setPendingCounts(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                } else {
                                  updateCount(item, parseInt(val) || 0);
                                }
                              }}
                              className="w-20 text-center border border-gray-300 dark:border-gray-600 rounded-lg py-1 text-gray-900 dark:text-gray-200 dark:bg-gray-700"
                              placeholder="-"
                            />
                            <button
                              onClick={() => updateCount(item, (counted ?? 0) + 1)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                              disabled={updateItem.isPending}
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-gray-900 dark:text-white">
                            {counted ?? '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {itemStatus === 'counted' && (
                          <span className={`font-semibold ${
                            variance === 0 ? 'text-green-600' :
                            variance > 0 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {variance > 0 ? '+' : ''}{variance}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {itemStatus === 'counted' ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircleIcon className="w-4 h-4" />
                            Counted
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
