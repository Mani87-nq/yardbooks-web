'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter } from '@/components/ui';
import {
  useStockTransfers,
  useCreateStockTransfer,
  useApproveStockTransfer,
  useShipStockTransfer,
  useReceiveStockTransfer,
  useWarehouses,
  type ApiStockTransfer,
} from '@/hooks/api/useStockTransfers';
import { useProducts } from '@/hooks/api/useProducts';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
  ClockIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  IN_TRANSIT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

interface NewTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantityRequested: number;
  unitCost: number;
  uomCode: string;
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-JM', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StockTransfersPage() {
  const { fc } = useCurrency();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<ApiStockTransfer | null>(null);

  // New transfer form state
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<NewTransferItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Queries
  const { data: transfersData, isLoading } = useStockTransfers({
    ...(statusFilter ? { status: statusFilter } : {}),
    limit: 50,
  });
  const { data: warehousesData } = useWarehouses({ isActive: true });
  const { data: productsData } = useProducts({ limit: 200 });

  // Mutations
  const createTransfer = useCreateStockTransfer();
  const approveTransfer = useApproveStockTransfer();
  const shipTransfer = useShipStockTransfer();
  const receiveTransfer = useReceiveStockTransfer();

  const transfers = transfersData?.data ?? [];
  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  // Filter products for adding
  const filteredProducts = productSearch.length >= 2
    ? products.filter((p: any) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  const addProductToTransfer = (product: any) => {
    if (transferItems.find((i) => i.productId === product.id)) return;
    setTransferItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantityRequested: 1,
        unitCost: Number(product.costPrice ?? 0),
        uomCode: product.unit || 'EA',
      },
    ]);
    setProductSearch('');
  };

  const updateTransferItemQty = (productId: string, qty: number) => {
    setTransferItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantityRequested: Math.max(1, qty) } : i))
    );
  };

  const removeTransferItem = (productId: string) => {
    setTransferItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleCreateTransfer = async () => {
    if (!fromWarehouseId || !toWarehouseId || transferItems.length === 0) return;
    try {
      await createTransfer.mutateAsync({
        fromWarehouseId,
        toWarehouseId,
        items: transferItems,
        notes: transferNotes || undefined,
        status: 'PENDING',
      });
      setShowCreateModal(false);
      setFromWarehouseId('');
      setToWarehouseId('');
      setTransferNotes('');
      setTransferItems([]);
    } catch {
      // Error displayed via mutation
    }
  };

  const handleAction = async (transfer: ApiStockTransfer, action: string) => {
    try {
      if (action === 'approve') await approveTransfer.mutateAsync(transfer.id);
      if (action === 'ship') await shipTransfer.mutateAsync({ id: transfer.id });
      if (action === 'receive') await receiveTransfer.mutateAsync({ id: transfer.id });
      setShowDetailModal(null);
    } catch {
      // Error via mutation state
    }
  };

  const statusFilters = ['', 'DRAFT', 'PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'];
  const activeMutation = approveTransfer.isPending || shipTransfer.isPending || receiveTransfer.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Transfers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Move inventory between warehouse locations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === s
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            {s ? statusLabels[s] : 'All'}
          </button>
        ))}
      </div>

      {/* Transfers List */}
      <Card>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="text-center py-12">
              <ArrowsRightLeftIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No stock transfers found.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create a transfer to move inventory between locations.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <button
                  key={transfer.id}
                  onClick={() => setShowDetailModal(transfer)}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    <TruckIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{transfer.transferNumber}</span>
                      <Badge className={cn('text-xs', statusColors[transfer.status])}>
                        {statusLabels[transfer.status] ?? transfer.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{transfer.fromWarehouse?.name ?? '?'}</span>
                      <ArrowRightIcon className="w-3 h-3" />
                      <span>{transfer.toWarehouse?.name ?? '?'}</span>
                      <span className="mx-1">&middot;</span>
                      <span>{transfer._count?.items ?? transfer.totalItems} items</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{fc(transfer.totalValue)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(transfer.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== Create Transfer Modal ====== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Stock Transfer" size="lg">
        <ModalBody>
          <div className="space-y-5">
            {/* Warehouse Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Warehouse</label>
                <select
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select source...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Warehouse</label>
                <select
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select destination...</option>
                  {warehouses.filter((wh) => wh.id !== fromWarehouseId).map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {fromWarehouseId === toWarehouseId && fromWarehouseId && (
              <div className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                Source and destination must be different.
              </div>
            )}

            {/* Product Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Products</label>
              <div className="relative">
                <Input
                  placeholder="Search by name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/20 max-h-48 overflow-y-auto">
                    {filteredProducts.map((product: any) => (
                      <button
                        key={product.id}
                        onClick={() => addProductToTransfer(product)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm"
                      >
                        <CubeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{product.sku} · Stock: {product.quantity}</p>
                        </div>
                        <span className="text-xs text-gray-400">{fc(product.costPrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Transfer Items */}
            {transferItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Items ({transferItems.length})
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {transferItems.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.sku} · {fc(item.unitCost)} / {item.uomCode}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.quantityRequested}
                        onChange={(e) => updateTransferItemQty(item.productId, parseInt(e.target.value) || 1)}
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 px-2 py-1 text-sm text-center"
                      />
                      <button
                        onClick={() => removeTransferItem(item.productId)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Value</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {fc(transferItems.reduce((s, i) => s + i.quantityRequested * i.unitCost, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
              <Input
                placeholder="Transfer notes..."
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
              />
            </div>

            {createTransfer.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {createTransfer.error instanceof Error ? createTransfer.error.message : 'Failed to create transfer'}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTransfer}
            disabled={
              createTransfer.isPending ||
              !fromWarehouseId ||
              !toWarehouseId ||
              fromWarehouseId === toWarehouseId ||
              transferItems.length === 0
            }
          >
            {createTransfer.isPending ? (
              <><ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />Creating...</>
            ) : (
              <><PlusIcon className="w-4 h-4 mr-2" />Create Transfer</>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ====== Detail / Action Modal ====== */}
      <Modal
        isOpen={!!showDetailModal}
        onClose={() => setShowDetailModal(null)}
        title={showDetailModal ? `Transfer ${showDetailModal.transferNumber}` : ''}
        size="lg"
      >
        {showDetailModal && (
          <>
            <ModalBody>
              <div className="space-y-5">
                {/* Status and Route */}
                <div className="flex items-center justify-between">
                  <Badge className={cn('text-sm', statusColors[showDetailModal.status])}>
                    {statusLabels[showDetailModal.status] ?? showDetailModal.status}
                  </Badge>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(showDetailModal.createdAt)}</span>
                </div>

                {/* Route */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex-1 text-center">
                    <BuildingStorefrontIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{showDetailModal.fromWarehouse?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{showDetailModal.fromWarehouse?.code}</p>
                  </div>
                  <ArrowRightIcon className="w-5 h-5 text-emerald-500" />
                  <div className="flex-1 text-center">
                    <BuildingStorefrontIcon className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{showDetailModal.toWarehouse?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{showDetailModal.toWarehouse?.code}</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                    <p className="font-semibold">{showDetailModal.totalItems}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Quantity</p>
                    <p className="font-semibold">{showDetailModal.totalQuantity}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Value</p>
                    <p className="font-semibold">{fc(showDetailModal.totalValue)}</p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Timeline</h3>
                  {[
                    { label: 'Requested', date: showDetailModal.requestedAt },
                    { label: 'Approved', date: showDetailModal.approvedAt },
                    { label: 'Shipped', date: showDetailModal.shippedAt },
                    { label: 'Received', date: showDetailModal.receivedAt },
                  ].filter((e) => e.date).map((event) => (
                    <div key={event.label} className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                      <span className="text-gray-600 dark:text-gray-400">{event.label}</span>
                      <span className="text-gray-400 dark:text-gray-500 ml-auto">{formatDate(event.date!)}</span>
                    </div>
                  ))}
                </div>

                {showDetailModal.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">{showDetailModal.notes}</p>
                  </div>
                )}

                {/* Action errors */}
                {(approveTransfer.error || shipTransfer.error || receiveTransfer.error) && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {[approveTransfer.error, shipTransfer.error, receiveTransfer.error]
                        .find(Boolean) instanceof Error
                        ? ([approveTransfer.error, shipTransfer.error, receiveTransfer.error].find(Boolean) as Error).message
                        : 'Action failed'}
                    </p>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowDetailModal(null)}>Close</Button>
              {['DRAFT', 'PENDING'].includes(showDetailModal.status) && (
                <Button onClick={() => handleAction(showDetailModal, 'approve')} disabled={activeMutation}>
                  {approveTransfer.isPending ? (
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
              )}
              {showDetailModal.status === 'APPROVED' && (
                <Button onClick={() => handleAction(showDetailModal, 'ship')} disabled={activeMutation}>
                  {shipTransfer.isPending ? (
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TruckIcon className="w-4 h-4 mr-2" />
                  )}
                  Mark Shipped
                </Button>
              )}
              {showDetailModal.status === 'IN_TRANSIT' && (
                <Button onClick={() => handleAction(showDetailModal, 'receive')} disabled={activeMutation}>
                  {receiveTransfer.isPending ? (
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                  )}
                  Receive
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
