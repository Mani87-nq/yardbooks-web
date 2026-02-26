'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import {
  useStockCounts,
  useCreateStockCount,
  useUpdateStockCount,
  useAddStockCountItems,
} from '@/hooks/api/useStockCounts';
import { useProducts } from '@/hooks/api';
import type { StockCountAPI } from '@/hooks/api/useStockCounts';
import {
  ArrowLeftIcon,
  PlusIcon,
  ClipboardDocumentCheckIcon,
  PlayIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'POSTED': return 'success';
    case 'IN_PROGRESS': return 'warning';
    case 'APPROVED':
    case 'PENDING_REVIEW': return 'info';
    case 'DRAFT': return 'default';
    case 'CANCELLED': return 'default';
    default: return 'default';
  }
};

const getStatusDisplay = (status: string) => status.toLowerCase().replace(/_/g, ' ');

export default function StockCountPage() {
  const [showModal, setShowModal] = useState(false);
  const [saveError, setSaveError] = useState('');

  // API hooks
  const { data: stockCountsResponse, isLoading, error: fetchError, refetch } = useStockCounts({ limit: 50 });
  const { data: productsResponse } = useProducts({ limit: 200 });
  const createStockCount = useCreateStockCount();
  const updateStockCount = useUpdateStockCount();
  const addStockCountItems = useAddStockCountItems();

  const stockCounts = stockCountsResponse?.data ?? [];
  const products = (productsResponse as any)?.data ?? [];

  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    countType: 'FULL' as string,
  });

  const handleStartCount = async () => {
    setSaveError('');
    if (!formData.name.trim()) {
      setSaveError('Please enter a count name');
      return;
    }

    try {
      // 1. Create the stock count
      const newCount = await createStockCount.mutateAsync({
        name: formData.name,
        type: formData.countType,
        scheduledDate: new Date().toISOString(),
        notes: formData.notes || undefined,
      });

      // 2. Add items from products if there are products
      if (products.length > 0) {
        const items = products.map((p: any) => ({
          productId: p.id,
          productName: p.name,
          sku: p.sku || '',
          barcode: p.barcode || undefined,
          uomCode: p.unit || 'EACH',
          expectedQuantity: p.quantity ?? 0,
        }));

        await addStockCountItems.mutateAsync({
          stockCountId: newCount.id,
          items,
        });
      }

      // 3. Set status to IN_PROGRESS
      await updateStockCount.mutateAsync({
        id: newCount.id,
        data: { status: 'IN_PROGRESS' },
      });

      setShowModal(false);
      setFormData({ name: '', notes: '', countType: 'FULL' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create stock count';
      setSaveError(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Count</h1>
          <p className="text-gray-500 dark:text-gray-400">Physical inventory counts and adjustments</p>
        </div>
        <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          New Count
        </Button>
      </div>

      {/* Error State */}
      {fetchError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-300">Failed to load stock counts. {fetchError instanceof Error ? fetchError.message : ''}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading stock counts...</p>
          </div>
        </Card>
      )}

      {/* Count History */}
      {!isLoading && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>Count History</CardTitle>
          </CardHeader>
          {stockCounts.length === 0 ? (
            <CardContent>
              <div className="text-center py-12">
                <ClipboardDocumentCheckIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No stock counts yet</p>
                <Button onClick={() => setShowModal(true)}>Start First Count</Button>
              </div>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Count Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockCounts.map((count) => (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium text-gray-900 dark:text-white">{count.countNumber}</TableCell>
                    <TableCell className="font-medium">{count.name}</TableCell>
                    <TableCell className="capitalize text-gray-500 dark:text-gray-400">{count.type?.toLowerCase()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(count.status)}>
                        {getStatusDisplay(count.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 dark:text-gray-400">
                      {count.totalItems || count._count?.items || 0}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                      {count.startedAt ? formatDateTime(new Date(count.startedAt)) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                      {count.completedAt ? formatDateTime(new Date(count.completedAt)) : '-'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/inventory/stock-count/${count.id}`}>
                        <Button variant="ghost" size="sm">
                          <EyeIcon className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* New Count Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Stock Count"
      >
        <ModalBody>
          <div className="space-y-4">
            {saveError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                {saveError}
              </div>
            )}
            <Input
              label="Count Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Inventory Count"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Count Type</label>
              <select
                value={formData.countType}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm"
              >
                <option value="FULL">Full Count</option>
                <option value="CYCLE">Cycle Count</option>
                <option value="SPOT">Spot Check</option>
                <option value="ANNUAL">Annual Count</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Optional notes about this count"
              />
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This count will include <strong>{products.length}</strong> products from your inventory
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleStartCount}
            disabled={createStockCount.isPending || addStockCountItems.isPending || updateStockCount.isPending}
          >
            <PlayIcon className="w-4 h-4 mr-1" />
            {(createStockCount.isPending || addStockCountItems.isPending) ? 'Creating...' : 'Start Count'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
