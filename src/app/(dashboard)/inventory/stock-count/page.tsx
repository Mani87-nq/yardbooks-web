'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { formatDateTime } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import type { StockCount, StockCountItem } from '@/types/stockCount';
import {
  ArrowLeftIcon,
  PlusIcon,
  ClipboardDocumentCheckIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function StockCountPage() {
  const [showModal, setShowModal] = useState(false);
  const [activeCount, setActiveCount] = useState<StockCount | null>(null);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});

  const { products, updateProduct, activeCompany } = useAppStore();
  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    countType: 'full' as 'full' | 'partial' | 'cycle',
  });

  const handleStartCount = () => {
    if (!formData.name.trim()) {
      alert('Please enter a count name');
      return;
    }

    const countId = uuidv4();
    const items: StockCountItem[] = products.map((p, idx) => ({
      id: `${countId}-${idx}`,
      stockCountId: countId,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      uomCode: p.unit || 'each',
      expectedQuantity: p.quantity,
      countedQuantity: undefined,
      variance: 0,
    }));

    const newCount: StockCount = {
      id: countId,
      companyId: activeCompany?.id ?? '',
      countNumber: `SC-${Date.now()}`,
      name: formData.name,
      notes: formData.notes,
      status: 'in_progress',
      type: formData.countType as StockCount['type'],
      items,
      scheduledDate: new Date(),
      startedAt: new Date(),
      totalItems: items.length,
      itemsCounted: 0,
      itemsWithVariance: 0,
      totalVarianceValue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setStockCounts([newCount, ...stockCounts]);
    setActiveCount(newCount);
    setCountedQuantities({});
    setShowModal(false);
    setFormData({ name: '', notes: '', countType: 'full' });
  };

  const handleUpdateQuantity = (productId: string, quantity: string) => {
    const qty = quantity === '' ? undefined : parseInt(quantity);
    setCountedQuantities({
      ...countedQuantities,
      [productId]: qty as number,
    });
  };

  const handleCompleteCount = () => {
    if (!activeCount) return;

    const updatedItems = activeCount.items.map(item => {
      const counted = countedQuantities[item.productId];
      return {
        ...item,
        countedQuantity: counted,
        variance: counted !== undefined ? counted - item.expectedQuantity : 0,
      };
    });

    const completedCount: StockCount = {
      ...activeCount,
      items: updatedItems,
      status: 'posted',
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    // Update stock counts list
    setStockCounts(stockCounts.map(sc =>
      sc.id === activeCount.id ? completedCount : sc
    ));

    // Optionally apply variances to inventory
    if (confirm('Apply counted quantities to inventory?')) {
      updatedItems.forEach(item => {
        if (item.countedQuantity !== undefined) {
          updateProduct(item.productId, { quantity: item.countedQuantity });
        }
      });
    }

    setActiveCount(null);
    setCountedQuantities({});
  };

  const handleCancelCount = () => {
    if (!activeCount) return;
    if (!confirm('Are you sure you want to cancel this count?')) return;

    setStockCounts(stockCounts.map(sc =>
      sc.id === activeCount.id ? { ...sc, status: 'cancelled' as const } : sc
    ));
    setActiveCount(null);
    setCountedQuantities({});
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-gray-500';
    if (variance > 0) return 'text-emerald-600';
    return 'text-red-600';
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Count</h1>
          <p className="text-gray-500">Physical inventory counts and adjustments</p>
        </div>
        {!activeCount && (
          <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowModal(true)}>
            New Count
          </Button>
        )}
      </div>

      {/* Active Count */}
      {activeCount && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{activeCount.name}</CardTitle>
                <p className="text-sm text-gray-500">
                  Started: {activeCount.startedAt ? formatDateTime(activeCount.startedAt) : '-'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancelCount}>
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button onClick={handleCompleteCount}>
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Complete Count
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Counted</TableHead>
                  <TableHead>Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCount.items.map((item) => {
                  const counted = countedQuantities[item.productId];
                  const variance = counted !== undefined ? counted - item.expectedQuantity : 0;

                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-gray-500">{item.sku || '-'}</TableCell>
                      <TableCell>{item.expectedQuantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={counted ?? ''}
                          onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                          className="w-24"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className={getVarianceColor(variance)}>
                        {counted !== undefined ? (
                          variance > 0 ? `+${variance}` : variance
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Count History */}
      {!activeCount && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>Count History</CardTitle>
          </CardHeader>
          {stockCounts.length === 0 ? (
            <CardContent>
              <div className="text-center py-12">
                <ClipboardDocumentCheckIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">No stock counts yet</p>
                <Button onClick={() => setShowModal(true)}>Start First Count</Button>
              </div>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockCounts.map((count) => (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium">{count.name}</TableCell>
                    <TableCell className="capitalize">{count.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          count.status === 'posted' ? 'success' :
                          count.status === 'in_progress' ? 'warning' :
                          count.status === 'approved' ? 'info' :
                          'default'
                        }
                      >
                        {count.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{count.items.length}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {count.startedAt ? formatDateTime(count.startedAt) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {count.completedAt ? formatDateTime(count.completedAt) : '-'}
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
            <Input
              label="Count Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Inventory Count"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Count Type</label>
              <select
                value={formData.countType}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value as any })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="full">Full Count</option>
                <option value="partial">Partial Count</option>
                <option value="cycle">Cycle Count</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Optional notes about this count"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                This count will include <strong>{products.length}</strong> products
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleStartCount}>
            <PlayIcon className="w-4 h-4 mr-1" />
            Start Count
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
