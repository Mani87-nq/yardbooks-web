'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StockCountItem {
  productId: string;
  productName: string;
  sku: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number;
  status: 'pending' | 'counted' | 'reviewed';
}

type StockCountStatus = 'in_progress' | 'completed' | 'cancelled';

// Mock stock count data - in real app would come from store
const mockStockCount = {
  id: 'sc-001',
  countNumber: 'SC-2024-001',
  status: 'in_progress' as StockCountStatus,
  startDate: new Date(),
  location: 'Main Warehouse',
  assignedTo: 'John Smith',
  items: [
    { productId: '1', productName: 'Rice (5kg Bag)', sku: 'RICE-5KG', expectedQty: 45, countedQty: 43, variance: -2, status: 'counted' as const },
    { productId: '2', productName: 'Sugar (2kg)', sku: 'SUGAR-2KG', expectedQty: 60, countedQty: 60, variance: 0, status: 'counted' as const },
    { productId: '3', productName: 'Flour (2kg)', sku: 'FLOUR-2KG', expectedQty: 35, countedQty: null, variance: 0, status: 'pending' as const },
    { productId: '4', productName: 'Chicken (per kg)', sku: 'CHICKEN-1KG', expectedQty: 25, countedQty: 28, variance: 3, status: 'counted' as const },
    { productId: '5', productName: 'Ting (355ml)', sku: 'TING-355ML', expectedQty: 100, countedQty: null, variance: 0, status: 'pending' as const },
  ] as StockCountItem[],
};

export default function StockCountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [stockCount, setStockCount] = useState(mockStockCount);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'variance'>('all');

  const updateCount = (productId: string, value: number) => {
    setStockCount((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              countedQty: value,
              variance: value - item.expectedQty,
              status: 'counted' as const,
            }
          : item
      ),
    }));
  };

  const filteredItems = stockCount.items.filter((item) => {
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'variance') return item.variance !== 0 && item.status === 'counted';
    return true;
  });

  const progress = Math.round(
    (stockCount.items.filter((i) => i.status !== 'pending').length / stockCount.items.length) * 100
  );

  const varianceCount = stockCount.items.filter((i) => i.variance !== 0 && i.status === 'counted').length;

  const getStatusLabel = (status: StockCountStatus) => {
    const labels: Record<StockCountStatus, string> = {
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status];
  };

  const getStatusColor = (status: StockCountStatus) => {
    const colors: Record<StockCountStatus, string> = {
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/stock-count" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{stockCount.countNumber}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(stockCount.status)}`}>
                {getStatusLabel(stockCount.status)}
              </span>
            </div>
            <p className="text-gray-500">{stockCount.location}</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Complete Count
        </button>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Counting Progress</h2>
          <span className="text-2xl font-bold text-gray-900">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-gray-500">
            {stockCount.items.filter((i) => i.status !== 'pending').length} of {stockCount.items.length} items counted
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
          { value: 'all', label: 'All Items', count: stockCount.items.length },
          { value: 'pending', label: 'Pending', count: stockCount.items.filter((i) => i.status === 'pending').length },
          { value: 'variance', label: 'Variances', count: varianceCount },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium text-center">Expected</th>
                <th className="px-4 py-3 font-medium text-center">Counted</th>
                <th className="px-4 py-3 font-medium text-center">Variance</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{item.productName}</span>
                      <span className="text-sm text-gray-500 ml-2">{item.sku}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-900">{item.expectedQty}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => updateCount(item.productId, (item.countedQty || 0) - 1)}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        <MinusIcon className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={item.countedQty ?? ''}
                        onChange={(e) => updateCount(item.productId, parseInt(e.target.value) || 0)}
                        className="w-20 text-center border border-gray-300 rounded-lg py-1 text-gray-900"
                        placeholder="-"
                      />
                      <button
                        onClick={() => updateCount(item.productId, (item.countedQty || 0) + 1)}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.status === 'counted' && (
                      <span className={`font-semibold ${
                        item.variance === 0 ? 'text-green-600' :
                        item.variance > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {item.variance > 0 ? '+' : ''}{item.variance}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'counted' ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="w-4 h-4" />
                        Counted
                      </span>
                    ) : (
                      <span className="text-gray-500">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
