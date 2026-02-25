'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QrCodeIcon,
  XMarkIcon,
  DocumentTextIcon,
  ReceiptRefundIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, generateStatCards, downloadAsCSV } from '@/lib/print';
import { useAppStore } from '@/store/appStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import type { PaymentMethodType, PosOrder } from '@/types/pos';

// Reason categories mapping
const REASON_CATEGORIES: { value: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other'; label: string }[] = [
  { value: 'defective', label: 'Defective product' },
  { value: 'wrong_item', label: 'Wrong item purchased' },
  { value: 'changed_mind', label: 'Customer changed mind' },
  { value: 'price_adjustment', label: 'Price adjustment' },
  { value: 'duplicate', label: 'Duplicate purchase' },
  { value: 'other', label: 'Other' },
];

// Return modal component
function ProcessReturnModal({
  order,
  onClose,
  onProcessReturn,
  getReturnableQuantity,
}: {
  order: PosOrder;
  onClose: () => void;
  onProcessReturn: (
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[],
    reason: string,
    reasonCategory: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other',
    refundMethod: PaymentMethodType
  ) => void;
  getReturnableQuantity: (orderId: string, itemId: string) => number;
}) {
  const { fc } = useCurrency();
  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: { quantity: number; condition: 'resellable' | 'damaged' | 'defective' } }>({});
  const [reasonCategory, setReasonCategory] = useState<'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other'>('changed_mind');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethodType>('cash');
  const [toastMessage, setToastMessage] = useState('');

  const handleQuantityChange = (itemId: string, quantity: number, maxQuantity: number, condition: 'resellable' | 'damaged' | 'defective' = 'resellable') => {
    if (quantity <= 0) {
      const newSelected = { ...selectedItems };
      delete newSelected[itemId];
      setSelectedItems(newSelected);
    } else {
      setSelectedItems({
        ...selectedItems,
        [itemId]: { quantity: Math.min(quantity, maxQuantity), condition },
      });
    }
  };

  const handleConditionChange = (itemId: string, condition: 'resellable' | 'damaged' | 'defective') => {
    if (selectedItems[itemId]) {
      setSelectedItems({
        ...selectedItems,
        [itemId]: { ...selectedItems[itemId], condition },
      });
    }
  };

  const calculateRefundTotal = () => {
    let total = 0;
    Object.entries(selectedItems).forEach(([itemId, { quantity }]) => {
      const item = order.items.find(i => i.id === itemId);
      if (item) {
        const unitPrice = item.lineTotal / item.quantity;
        total += unitPrice * quantity;
      }
    });
    return total;
  };

  const handleSubmit = () => {
    if (Object.keys(selectedItems).length === 0) {
      setToastMessage('Please select at least one item to return');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    const reason = reasonCategory === 'other' && customReason.trim()
      ? customReason.trim()
      : REASON_CATEGORIES.find(r => r.value === reasonCategory)?.label || reasonCategory;

    const itemsToReturn = Object.entries(selectedItems).map(([itemId, { quantity, condition }]) => ({
      itemId,
      quantity,
      condition,
    }));

    onProcessReturn(itemsToReturn, reason, reasonCategory, refundMethod);
  };

  const refundTotal = calculateRefundTotal();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Process Return</h2>
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            <span className="flex items-center gap-1 text-gray-600">
              <ReceiptRefundIcon className="w-4 h-4 text-blue-500" />
              Receipt: <span className="font-medium text-gray-900">{order.orderNumber}</span>
            </span>
            {order.invoiceNumber && (
              <span className="flex items-center gap-1 text-gray-600">
                <DocumentTextIcon className="w-4 h-4 text-purple-500" />
                Invoice: <span className="font-medium text-gray-900">{order.invoiceNumber}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Customer: {order.customerName}</p>
        </div>

        {toastMessage && (
          <div className="mx-6 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-600">
            {toastMessage}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Items to return */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Select Items to Return</h3>
            <div className="space-y-3">
              {order.items.map((item) => {
                const returnableQty = getReturnableQuantity(order.id, item.id);
                const alreadyReturned = item.quantity - returnableQty;
                const isFullyReturned = returnableQty === 0;
                const selectedQty = selectedItems[item.id]?.quantity || 0;
                const selectedCondition = selectedItems[item.id]?.condition || 'resellable';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg ${isFullyReturned ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {fc(item.unitPrice)} x {item.quantity} = {fc(item.lineTotal)}
                        </p>
                        {alreadyReturned > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            {alreadyReturned} already returned - {returnableQty} remaining
                          </p>
                        )}
                        {isFullyReturned && (
                          <p className="text-xs text-red-600 font-medium mt-1">Fully returned</p>
                        )}
                      </div>

                      {!isFullyReturned && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, selectedQty - 1, returnableQty, selectedCondition)}
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                              disabled={selectedQty <= 0}
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-medium">{selectedQty}</span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, selectedQty + 1, returnableQty, selectedCondition)}
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                              disabled={selectedQty >= returnableQty}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, returnableQty, returnableQty, selectedCondition)}
                              className="text-xs text-blue-600 hover:text-blue-700 ml-2"
                            >
                              Max ({returnableQty})
                            </button>
                          </div>

                          {selectedQty > 0 && (
                            <div className="flex gap-1 text-xs">
                              {(['resellable', 'damaged', 'defective'] as const).map((cond) => (
                                <button
                                  key={cond}
                                  type="button"
                                  onClick={() => handleConditionChange(item.id, cond)}
                                  className={`px-2 py-1 rounded transition-colors ${
                                    selectedCondition === cond
                                      ? cond === 'resellable' ? 'bg-green-100 text-green-700 font-medium'
                                        : cond === 'damaged' ? 'bg-orange-100 text-orange-700 font-medium'
                                        : 'bg-red-100 text-red-700 font-medium'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {cond.charAt(0).toUpperCase() + cond.slice(1)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Return Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value as typeof reasonCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {REASON_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {reasonCategory === 'other' && (
              <Input
                type="text"
                placeholder="Please specify the reason..."
                className="mt-2"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Refund method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Refund Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'jam_dex', 'store_credit'] as PaymentMethodType[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setRefundMethod(method)}
                  className={`p-3 rounded-lg border text-center ${
                    refundMethod === method
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {method === 'cash' ? 'Cash' : method === 'jam_dex' ? 'JAM-DEX' : 'Store Credit'}
                </button>
              ))}
            </div>
          </div>

          {/* Refund summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-emerald-800 font-medium">Total Refund Amount</span>
              <span className="text-2xl font-bold text-emerald-600">{fc(refundTotal)}</span>
            </div>
            <p className="text-sm text-emerald-700 mt-1">
              {Object.keys(selectedItems).length} item(s) selected for return
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(selectedItems).length === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Process Return
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  const { fc, fcp } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error' | 'scanning';
    message: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { orders, processReturn, getReturnableQuantity, settings } = usePosStore();
  const { activeCompany, products } = useAppStore();

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const productLookup = useMemo(() => {
    const lookup: Record<string, { id: string; name: string; sku: string; barcode?: string }> = {};
    products.forEach(p => {
      if (p.barcode) lookup[p.barcode] = { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode };
      if (p.sku) lookup[p.sku.toLowerCase()] = { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode };
    });
    return lookup;
  }, [products]);

  const orderLookup = useMemo(() => {
    const lookup: Record<string, PosOrder> = {};
    orders.forEach(o => {
      lookup[o.orderNumber.toUpperCase()] = o;
      lookup[o.orderNumber.toLowerCase()] = o;
      if (o.invoiceNumber) {
        lookup[o.invoiceNumber.toUpperCase()] = o;
        lookup[o.invoiceNumber.toLowerCase()] = o;
      }
    });
    return lookup;
  }, [orders]);

  const handleBarcodeScan = useCallback((barcode: string) => {
    const upper = barcode.toUpperCase();
    const order = orderLookup[upper] || orderLookup[barcode.toLowerCase()];
    if (order && order.status === 'completed') {
      setScanFeedback({ type: 'success', message: 'Receipt found!' });
      setSelectedOrder(order);
      setShowReturnModal(true);
      setTimeout(() => setScanFeedback(null), 2000);
      return;
    }

    const product = productLookup[barcode] || productLookup[barcode.toLowerCase()];
    if (product) {
      const ordersWithProduct = orders.filter(o =>
        o.status === 'completed' && o.items.some(item => item.productId === product.id)
      );
      if (ordersWithProduct.length === 1) {
        setScanFeedback({ type: 'success', message: `Found "${product.name}" in order` });
        setSelectedOrder(ordersWithProduct[0]);
        setShowReturnModal(true);
      } else {
        setSearchTerm(product.name);
        setScanFeedback({ type: 'success', message: `Found "${product.name}" in ${ordersWithProduct.length} orders` });
      }
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    setScanFeedback({ type: 'error', message: `Not found: ${barcode}` });
    setSearchTerm(barcode);
    setTimeout(() => setScanFeedback(null), 3000);
  }, [orders, productLookup, orderLookup]);

  const { isScanning } = useBarcodeScanner({ onScan: handleBarcodeScan, enabled: true, minLength: 4 });

  useEffect(() => {
    if (isScanning) setScanFeedback({ type: 'scanning', message: 'Scanning...' });
  }, [isScanning]);

  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const refundedOrders = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);
    return orders
      .filter(o => o.status === 'refunded')
      .filter(o => {
        const date = new Date(o.updatedAt);
        return date >= start && date <= end;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, dateRange]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return completedOrders
      .filter(order => {
        if (order.orderNumber.toLowerCase().includes(term)) return true;
        if (order.invoiceNumber?.toLowerCase().includes(term)) return true;
        if (order.customerName.toLowerCase().includes(term)) return true;
        if (order.items.some(i => i.name.toLowerCase().includes(term) || i.sku?.toLowerCase().includes(term))) return true;
        return false;
      })
      .slice(0, 10);
  }, [completedOrders, searchTerm]);

  const returnSummary = useMemo(() => {
    const totalReturns = refundedOrders.length;
    const totalRefundAmount = refundedOrders.reduce((sum, o) => {
      const refundPayment = o.payments.find(p => p.status === 'refunded');
      return sum + Math.abs(refundPayment?.amount || 0);
    }, 0);
    const avgRefund = totalReturns > 0 ? totalRefundAmount / totalReturns : 0;
    return { totalReturns, totalRefundAmount, avgRefund };
  }, [refundedOrders]);

  const handleProcessReturn = (
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[],
    reason: string,
    reasonCategory: string,
    refundMethod: PaymentMethodType
  ) => {
    if (!selectedOrder) return;

    const result = processReturn(selectedOrder.id, itemsToReturn, reason, reasonCategory, refundMethod, 'Cashier');

    if (result) {
      setShowReturnModal(false);
      setSelectedOrder(null);
      setSearchTerm('');
      showToast('success', `Return processed! Refund: ${fc(result.totalRefund)}`);
    } else {
      showToast('error', 'Failed to process return. Please check the items and quantities.');
    }
  };

  const handlePrint = () => {
    const dateSubtitle = `${formatDate(new Date(dateRange.start))} - ${formatDate(new Date(dateRange.end))}`;
    const content = generateStatCards([
      { label: 'Total Returns', value: String(returnSummary.totalReturns), color: '#dc2626' },
      { label: 'Total Refunded', value: fcp(returnSummary.totalRefundAmount), color: '#ea580c' },
      { label: 'Average Refund', value: fcp(returnSummary.avgRefund), color: '#7c3aed' },
    ]);
    printContent({
      title: 'Returns Report',
      subtitle: dateSubtitle,
      companyName: activeCompany?.businessName,
      content,
    });
  };

  const handleExportCSV = () => {
    const filename = `returns-report-${dateRange.start}-to-${dateRange.end}`;
    downloadAsCSV(
      refundedOrders.map(o => ({
        Date: formatDate(new Date(o.updatedAt)),
        'Order Number': o.orderNumber,
        Customer: o.customerName,
        'Return Reason': o.refundReason || 'N/A',
        'Items': o.items.map(i => `${i.name} (${i.quantity})`).join('; '),
        'Refund Amount': Math.abs(o.payments.find(p => p.status === 'refunded')?.amount || 0),
      })),
      filename
    );
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toastMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toastMessage.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns &amp; Refunds</h1>
            <p className="text-gray-500">Process returns and view refund history</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {scanFeedback && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          scanFeedback.type === 'success' ? 'bg-green-500 text-white' :
          scanFeedback.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
        }`}>
          {scanFeedback.type === 'scanning' && <QrCodeIcon className="w-5 h-5 animate-pulse" />}
          {scanFeedback.type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
          {scanFeedback.type === 'error' && <ExclamationTriangleIcon className="w-5 h-5" />}
          <span className="font-medium">{scanFeedback.message}</span>
        </div>
      )}

      <Card className="border-emerald-200 bg-emerald-50">
        <CardHeader>
          <CardTitle className="text-emerald-800 flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5" />
            Process New Return
            <span className="ml-auto flex items-center gap-2 text-sm font-normal text-emerald-600">
              <QrCodeIcon className="w-4 h-4" />
              Scan barcode or search
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by receipt #, invoice #, customer name, product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none bg-white"
              autoComplete="off"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-12 px-2 flex items-center text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <QrCodeIcon className={`h-6 w-6 ${isScanning ? 'text-emerald-500 animate-pulse' : 'text-emerald-400'}`} />
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500">
                  Found {searchResults.length} transaction{searchResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {searchResults.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 flex items-center justify-between hover:bg-emerald-50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedOrder(order); setShowReturnModal(true); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                        {order.invoiceNumber && (
                          <span className="text-sm text-gray-600">{order.invoiceNumber}</span>
                        )}
                        <Badge variant="info" className="text-xs">{order.items.length} items</Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {order.customerName} - {formatDate(new Date(order.completedAt || order.createdAt))}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-emerald-600">{fc(order.total)}</p>
                      <Button size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowReturnModal(true); }}>
                        Return Items
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!searchTerm && (
            <div className="mt-4 bg-white/50 rounded-xl border-2 border-dashed border-emerald-200 p-8 text-center">
              <QrCodeIcon className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-emerald-700 font-medium">Ready to Process Returns</p>
              <p className="text-sm text-emerald-600/70 mt-1">Enter a receipt # or scan a barcode</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Return History:</span>
            <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-40" />
            <span className="text-gray-400">to</span>
            <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-40" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Returns</p>
            <p className="text-2xl font-bold text-red-600">{returnSummary.totalReturns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Refunded</p>
            <p className="text-2xl font-bold text-orange-600">{fc(returnSummary.totalRefundAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Average Refund</p>
            <p className="text-2xl font-bold text-purple-600">{fc(returnSummary.avgRefund)}</p>
          </CardContent>
        </Card>
      </div>

      {showReturnModal && selectedOrder && (
        <ProcessReturnModal
          order={selectedOrder}
          onClose={() => { setShowReturnModal(false); setSelectedOrder(null); }}
          onProcessReturn={handleProcessReturn}
          getReturnableQuantity={getReturnableQuantity}
        />
      )}
    </div>
  );
}
