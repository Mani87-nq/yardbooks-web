'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { formatJMD, formatDate } from '@/lib/utils';
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
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';
import { printContent, generateTable, generateStatCards, formatPrintCurrency, downloadAsCSV } from '@/lib/print';
import { useAppStore } from '@/store/appStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import type { PaymentMethodType, PosOrder, SupervisorApproval } from '@/types/pos';
import { SupervisorPinModal } from '@/components/pos/SupervisorPinModal';
import { useToast } from '@/components/ui/Toast';

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
  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: { quantity: number; condition: 'resellable' | 'damaged' | 'defective' } }>({});
  const [reasonCategory, setReasonCategory] = useState<'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other'>('changed_mind');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethodType>('cash');
  const { toast } = useToast();

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
      toast.warning('Please select at least one item to return');
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
          {/* Show all document references */}
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            <span className="flex items-center gap-1 text-gray-600">
              <ReceiptPercentIcon className="w-4 h-4 text-blue-500" />
              Receipt: <span className="font-medium text-gray-900">{order.orderNumber}</span>
            </span>
            {order.invoiceNumber && (
              <span className="flex items-center gap-1 text-gray-600">
                <DocumentTextIcon className="w-4 h-4 text-purple-500" />
                Invoice: <span className="font-medium text-gray-900">{order.invoiceNumber}</span>
              </span>
            )}
            {order.customerPONumber && (
              <span className="text-gray-600">
                PO: <span className="font-medium text-gray-900">{order.customerPONumber}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Customer: {order.customerName}</p>
        </div>

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
                          {formatJMD(item.unitPrice)} × {item.quantity} = {formatJMD(item.lineTotal)}
                        </p>
                        {alreadyReturned > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            ⚠️ {alreadyReturned} already returned • {returnableQty} remaining
                          </p>
                        )}
                        {isFullyReturned && (
                          <p className="text-xs text-red-600 font-medium mt-1">
                            ✓ Fully returned
                          </p>
                        )}
                      </div>

                      {!isFullyReturned && (
                        <div className="flex flex-col items-end gap-2">
                          {/* Quantity selector */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, selectedQty - 1, returnableQty, selectedCondition)}
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                              disabled={selectedQty <= 0}
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-medium">
                              {selectedQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, selectedQty + 1, returnableQty, selectedCondition)}
                              className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 flex items-center justify-center cursor-pointer transition-colors"
                              disabled={selectedQty >= returnableQty}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, returnableQty, returnableQty, selectedCondition)}
                              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ml-2 cursor-pointer"
                            >
                              Max ({returnableQty})
                            </button>
                          </div>

                          {/* Condition selector - only show if item is selected */}
                          {selectedQty > 0 && (
                            <div className="flex gap-1 text-xs">
                              <button
                                type="button"
                                onClick={() => handleConditionChange(item.id, 'resellable')}
                                className={`px-2 py-1 rounded cursor-pointer transition-colors ${selectedCondition === 'resellable' ? 'bg-green-100 text-green-700 font-medium dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                              >
                                ✓ Resellable
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConditionChange(item.id, 'damaged')}
                                className={`px-2 py-1 rounded cursor-pointer transition-colors ${selectedCondition === 'damaged' ? 'bg-orange-100 text-orange-700 font-medium dark:bg-orange-900/50 dark:text-orange-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                              >
                                ⚠ Damaged
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConditionChange(item.id, 'defective')}
                                className={`px-2 py-1 rounded cursor-pointer transition-colors ${selectedCondition === 'defective' ? 'bg-red-100 text-red-700 font-medium dark:bg-red-900/50 dark:text-red-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                              >
                                ✗ Defective
                              </button>
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
              <span className="text-2xl font-bold text-emerald-600">{formatJMD(refundTotal)}</span>
            </div>
            <p className="text-sm text-emerald-700 mt-1">
              {Object.keys(selectedItems).length} item(s) selected for return
            </p>
            {/* Show restock info */}
            {Object.values(selectedItems).some(s => s.condition !== 'resellable') && (
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ Items marked as Damaged/Defective will NOT be restocked to inventory
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Supervisor approval state
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [pendingReturn, setPendingReturn] = useState<{
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[];
    reason: string;
    reasonCategory: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other';
    refundMethod: PaymentMethodType;
    refundAmount: number;
  } | null>(null);

  // Barcode scanning state
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error' | 'scanning';
    message: string;
    orderNumber?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { orders, getRefundedOrders, processReturn, getReturnableQuantity, getAllReturns, settings } = usePosStore();
  const { activeCompany, products, invoices } = useAppStore();
  const { toast } = useToast();

  // Build a lookup of products by barcode/SKU for faster scanning
  const productLookup = useMemo(() => {
    const lookup: Record<string, { id: string; name: string; sku: string; barcode?: string }> = {};
    products.forEach(p => {
      if (p.barcode) lookup[p.barcode] = { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode };
      if (p.sku) lookup[p.sku.toLowerCase()] = { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode };
    });
    return lookup;
  }, [products]);

  // Build a lookup of orders by order number for receipt barcode scanning
  const orderLookup = useMemo(() => {
    const lookup: Record<string, PosOrder> = {};
    orders.forEach(o => {
      // Index by order number (receipt number)
      lookup[o.orderNumber.toUpperCase()] = o;
      lookup[o.orderNumber.toLowerCase()] = o;
      // Also index by invoice number if exists
      if (o.invoiceNumber) {
        lookup[o.invoiceNumber.toUpperCase()] = o;
        lookup[o.invoiceNumber.toLowerCase()] = o;
      }
    });
    return lookup;
  }, [orders]);

  // Check if scanned barcode looks like a receipt/invoice number
  const isReceiptBarcode = useCallback((barcode: string): boolean => {
    const upper = barcode.toUpperCase();
    // Common receipt/invoice/order number patterns:
    // POS-2024-0001, POS-202402-0001, RCP-001, INV-2024-001, ORD-001, etc.
    const receiptPatterns = [
      /^POS-/i,      // POS order numbers
      /^RCP-/i,      // Receipt numbers
      /^INV-/i,      // Invoice numbers
      /^ORD-/i,      // Order numbers
      /^RTN-/i,      // Return numbers (shouldn't be scanned but just in case)
      /^\d{4}-\d{2}-\d{4}$/,  // YYYY-MM-#### format
      /^[A-Z]{2,4}-\d{4,}/i,  // 2-4 letter prefix followed by numbers
    ];
    return receiptPatterns.some(pattern => pattern.test(upper));
  }, []);

  // Barcode scanner integration - handles BOTH receipt barcodes AND product barcodes
  const handleBarcodeScan = useCallback((barcode: string) => {
    // FIRST: Check if this is a receipt/invoice barcode
    if (isReceiptBarcode(barcode)) {
      // Look up the order directly by receipt/invoice number
      const order = orderLookup[barcode.toUpperCase()] || orderLookup[barcode.toLowerCase()];

      if (order) {
        // Check if order can be returned
        if (order.status === 'completed' || order.status === 'partially_refunded') {
          setScanFeedback({
            type: 'success',
            message: '📄 Receipt found!',
            orderNumber: order.orderNumber
          });
          try { new Audio('/sounds/beep.mp3').play().catch(() => {}); } catch {}
          setSelectedOrder(order);
          setShowReturnModal(true);
          setTimeout(() => setScanFeedback(null), 2000);
          return;
        } else if (order.status === 'refunded') {
          setScanFeedback({
            type: 'error',
            message: `Receipt ${barcode} has already been fully refunded`
          });
          try { new Audio('/sounds/error.mp3').play().catch(() => {}); } catch {}
          setTimeout(() => setScanFeedback(null), 3000);
          return;
        } else {
          setScanFeedback({
            type: 'error',
            message: `Order ${barcode} cannot be returned (status: ${order.status})`
          });
          try { new Audio('/sounds/error.mp3').play().catch(() => {}); } catch {}
          setTimeout(() => setScanFeedback(null), 3000);
          return;
        }
      } else {
        // Receipt number not found - might be old or from another system
        setScanFeedback({
          type: 'error',
          message: `Receipt/Invoice not found: ${barcode}`
        });
        try { new Audio('/sounds/error.mp3').play().catch(() => {}); } catch {}
        // Also set search term so user can see if partial match exists
        setSearchTerm(barcode);
        setTimeout(() => setScanFeedback(null), 3000);
        return;
      }
    }

    // SECOND: Try to look up as a product barcode
    const product = productLookup[barcode] || productLookup[barcode.toLowerCase()];

    if (!product) {
      // Not a receipt and not a known product
      setScanFeedback({ type: 'error', message: `Unknown barcode: ${barcode}` });
      try { new Audio('/sounds/error.mp3').play().catch(() => {}); } catch {}
      // Set as search term in case user wants to search
      setSearchTerm(barcode);
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    // Found a product - find orders containing this product
    const ordersWithProduct = orders.filter(o =>
      (o.status === 'completed' || o.status === 'partially_refunded') &&
      o.items.some(item => item.productId === product.id)
    );

    if (ordersWithProduct.length === 0) {
      setScanFeedback({
        type: 'error',
        message: `No returnable orders found for "${product.name}"`
      });
      try { new Audio('/sounds/error.mp3').play().catch(() => {}); } catch {}
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    if (ordersWithProduct.length === 1) {
      // Only one order - open it directly
      const order = ordersWithProduct[0];
      setScanFeedback({
        type: 'success',
        message: `Found "${product.name}" in order`,
        orderNumber: order.orderNumber
      });
      try { new Audio('/sounds/beep.mp3').play().catch(() => {}); } catch {}
      setSelectedOrder(order);
      setShowReturnModal(true);
      setTimeout(() => setScanFeedback(null), 2000);
    } else {
      // Multiple orders - show in search results
      setScanFeedback({
        type: 'success',
        message: `Found "${product.name}" in ${ordersWithProduct.length} orders`
      });
      try { new Audio('/sounds/beep.mp3').play().catch(() => {}); } catch {}
      // Set the search term to the product name to show related orders
      setSearchTerm(product.name);
      setTimeout(() => setScanFeedback(null), 3000);
    }
  }, [orders, productLookup, orderLookup, isReceiptBarcode]);

  // Initialize barcode scanner
  const { isScanning, lastScan } = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: 4,
  });

  // Clear feedback on scan state change
  useEffect(() => {
    if (isScanning) {
      setScanFeedback({ type: 'scanning', message: 'Scanning...' });
    }
  }, [isScanning]);

  // Get completed orders (available for return) and refunded orders
  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'completed');
  }, [orders]);

  const refundedOrders = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return orders
      .filter((o) => o.status === 'refunded')
      .filter((o) => {
        const date = new Date(o.updatedAt);
        return date >= start && date <= end;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [orders, dateRange]);

  // Fuzzy search helper - calculate similarity score
  const fuzzyMatch = useCallback((query: string, target: string): number => {
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();

    // Exact match
    if (targetLower === queryLower) return 1;

    // Contains match
    if (targetLower.includes(queryLower)) return 0.8;

    // Word prefix match
    const words = targetLower.split(/\s+/);
    if (words.some(word => word.startsWith(queryLower))) return 0.7;

    // Fuzzy character match (Levenshtein-like)
    let matches = 0;
    let lastIndex = -1;
    for (const char of queryLower) {
      const index = targetLower.indexOf(char, lastIndex + 1);
      if (index > lastIndex) {
        matches++;
        lastIndex = index;
      }
    }
    return matches / query.length * 0.5;
  }, []);

  // Search for orders to process return - with fuzzy matching
  // Supports: Order #, Receipt #, Invoice #, Customer PO #, Customer Name, Product Name, SKU
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();

    // Score and filter orders
    const scoredOrders = completedOrders.map(order => {
      let score = 0;
      let matchedDoc: string | null = null; // Track what document number matched

      // 1. EXACT/PARTIAL ORDER NUMBER MATCH (highest priority - POS receipt number)
      if (order.orderNumber.toLowerCase().includes(term)) {
        score = Math.max(score, 1.0);
        matchedDoc = 'order';
      }

      // 2. INVOICE NUMBER MATCH (from linked invoice or stored invoiceNumber)
      if (order.invoiceNumber?.toLowerCase().includes(term)) {
        score = Math.max(score, 1.0);
        matchedDoc = 'invoice';
      }

      // 3. CUSTOMER PO NUMBER MATCH
      if (order.customerPONumber?.toLowerCase().includes(term)) {
        score = Math.max(score, 0.98);
        matchedDoc = 'customerPO';
      }

      // 4. Match customer name
      const customerScore = fuzzyMatch(term, order.customerName);
      if (customerScore > score) {
        score = customerScore * 0.9;
      }

      // 5. Match items in the order (search by product name, SKU, barcode)
      order.items.forEach(item => {
        const nameScore = fuzzyMatch(term, item.name);
        score = Math.max(score, nameScore * 0.85);

        // Check if search matches the SKU
        if (item.sku?.toLowerCase().includes(term)) {
          score = Math.max(score, 0.95);
        }

        // Check if search matches the barcode
        if (item.barcode?.toLowerCase().includes(term)) {
          score = Math.max(score, 0.95);
        }
      });

      return { order, score, matchedDoc };
    });

    // Also search invoices for document number matches
    // If we find an invoice, look for linked POS orders
    const invoiceMatches = invoices
      .filter(inv =>
        inv.status === 'paid' && (
          inv.invoiceNumber.toLowerCase().includes(term) ||
          inv.customerPONumber?.toLowerCase().includes(term)
        )
      )
      .map(inv => {
        // Find POS orders linked to this invoice
        const linkedOrder = completedOrders.find(o =>
          o.invoiceId === inv.id || o.invoiceNumber === inv.invoiceNumber
        );
        return linkedOrder ? { order: linkedOrder, score: 1.0, matchedDoc: 'invoice' as const } : null;
      })
      .filter(Boolean) as typeof scoredOrders;

    // Merge results, removing duplicates
    const allResults = [...scoredOrders, ...invoiceMatches];
    const uniqueResults = allResults.reduce((acc, curr) => {
      const existing = acc.find(r => r.order.id === curr.order.id);
      if (!existing || curr.score > existing.score) {
        return [...acc.filter(r => r.order.id !== curr.order.id), curr];
      }
      return acc;
    }, [] as typeof allResults);

    // Filter by minimum score and sort by score
    return uniqueResults
      .filter(({ score }) => score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ order, matchedDoc }) => ({ ...order, _matchedDoc: matchedDoc }));
  }, [completedOrders, invoices, searchTerm, fuzzyMatch]);

  // Return summary
  const returnSummary = useMemo(() => {
    const totalReturns = refundedOrders.length;
    const totalRefundAmount = refundedOrders.reduce((sum, o) => {
      const refundPayment = o.payments.find((p) => p.status === 'refunded');
      return sum + Math.abs(refundPayment?.amount || 0);
    }, 0);
    const avgRefund = totalReturns > 0 ? totalRefundAmount / totalReturns : 0;

    // Group by reason
    const reasonMap: Record<string, number> = {};
    refundedOrders.forEach((o) => {
      const reason = o.refundReason || 'Unknown';
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });

    return { totalReturns, totalRefundAmount, avgRefund, reasonMap };
  }, [refundedOrders]);

  // Calculate refund amount for a set of items
  const calculateRefundAmount = useCallback((
    order: PosOrder,
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[]
  ): number => {
    let total = 0;
    itemsToReturn.forEach(({ itemId, quantity }) => {
      const item = order.items.find(i => i.id === itemId);
      if (item) {
        const unitPrice = item.lineTotal / item.quantity;
        total += unitPrice * quantity;
      }
    });
    return total;
  }, []);

  const handleProcessReturn = (
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[],
    reason: string,
    reasonCategory: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other',
    refundMethod: PaymentMethodType
  ) => {
    if (!selectedOrder) return;

    // Calculate refund amount
    const refundAmount = calculateRefundAmount(selectedOrder, itemsToReturn);

    // Check if supervisor approval is required (defaults to TRUE for security)
    const requiresSupervisor = settings.requireSupervisorForReturns ?? true;
    const exceedsThreshold = settings.returnApprovalThreshold && refundAmount >= settings.returnApprovalThreshold;

    if (requiresSupervisor || exceedsThreshold) {
      // Store pending return data and show supervisor modal
      setPendingReturn({
        itemsToReturn,
        reason,
        reasonCategory,
        refundMethod,
        refundAmount,
      });
      setShowReturnModal(false);
      setShowSupervisorModal(true);
      return;
    }

    // No supervisor needed, process directly
    executeReturn(itemsToReturn, reason, reasonCategory, refundMethod);
  };

  // Execute the actual return (called after supervisor approval if needed)
  const executeReturn = (
    itemsToReturn: { itemId: string; quantity: number; condition?: 'resellable' | 'damaged' | 'defective' }[],
    reason: string,
    reasonCategory: 'defective' | 'wrong_item' | 'changed_mind' | 'price_adjustment' | 'duplicate' | 'other',
    refundMethod: PaymentMethodType,
    supervisorApproval?: SupervisorApproval
  ) => {
    if (!selectedOrder) return;

    const processedBy = supervisorApproval
      ? `Approved by ${supervisorApproval.supervisorEmployeeNumber ? `#${supervisorApproval.supervisorEmployeeNumber}` : supervisorApproval.supervisorName}`
      : 'Cashier';

    const result = processReturn(
      selectedOrder.id,
      itemsToReturn,
      reason,
      reasonCategory,
      refundMethod,
      processedBy
    );

    if (result) {
      setShowReturnModal(false);
      setShowSupervisorModal(false);
      setSelectedOrder(null);
      setSearchTerm('');
      setPendingReturn(null);

      toast.success(`Return processed successfully! Return: ${result.returnNumber}, Refund: ${formatJMD(result.totalRefund)}`);
    } else {
      toast.error('Failed to process return. Please check the items and quantities.');
    }
  };

  // Handle supervisor approval for returns
  const handleSupervisorApproval = (approval: SupervisorApproval) => {
    if (pendingReturn) {
      executeReturn(
        pendingReturn.itemsToReturn,
        pendingReturn.reason,
        pendingReturn.reasonCategory,
        pendingReturn.refundMethod,
        approval
      );
    }
  };

  // Handle supervisor modal close (cancel)
  const handleSupervisorModalClose = () => {
    setShowSupervisorModal(false);
    // Re-open the return modal so user can try again or cancel
    if (selectedOrder) {
      setShowReturnModal(true);
    }
    setPendingReturn(null);
  };

  const handlePrint = () => {
    const dateSubtitle = `${formatDate(new Date(dateRange.start))} - ${formatDate(new Date(dateRange.end))}`;

    const content =
      generateStatCards([
        { label: 'Total Returns', value: String(returnSummary.totalReturns), color: '#dc2626' },
        { label: 'Total Refunded', value: formatPrintCurrency(returnSummary.totalRefundAmount), color: '#ea580c' },
        { label: 'Average Refund', value: formatPrintCurrency(returnSummary.avgRefund), color: '#7c3aed' },
      ]) +
      '<h3 style="margin:30px 0 15px;font-weight:600;">Returns by Reason</h3>' +
      generateTable(
        [
          { key: 'reason', label: 'Reason' },
          { key: 'count', label: 'Count', align: 'right' },
          { key: 'percentage', label: '%', align: 'right' },
        ],
        Object.entries(returnSummary.reasonMap).map(([reason, count]) => ({
          reason,
          count,
          percentage: returnSummary.totalReturns > 0
            ? ((count / returnSummary.totalReturns) * 100).toFixed(1) + '%'
            : '0%',
        })),
        {}
      ) +
      '<h3 style="margin:30px 0 15px;font-weight:600;">Return Transactions</h3>' +
      generateTable(
        [
          { key: 'date', label: 'Date' },
          { key: 'orderNumber', label: 'Order #' },
          { key: 'customer', label: 'Customer' },
          { key: 'reason', label: 'Reason' },
          { key: 'amount', label: 'Refund', align: 'right' },
        ],
        refundedOrders.slice(0, 50).map((o) => ({
          date: formatDate(new Date(o.updatedAt)),
          orderNumber: o.orderNumber,
          customer: o.customerName,
          reason: o.refundReason || 'N/A',
          amount: Math.abs(o.payments.find((p) => p.status === 'refunded')?.amount || 0),
        })),
        {
          formatters: { amount: formatPrintCurrency },
        }
      );

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
      refundedOrders.map((o) => ({
        Date: formatDate(new Date(o.updatedAt)),
        'Order Number': o.orderNumber,
        Customer: o.customerName,
        'Return Reason': o.refundReason || 'N/A',
        'Items Returned': o.items.map((i) => `${i.name} (${i.quantity})`).join('; '),
        'Refund Amount': Math.abs(o.payments.find((p) => p.status === 'refunded')?.amount || 0),
        'Refund Method':
          o.payments.find((p) => p.status === 'refunded')?.method || 'N/A',
      })),
      filename
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns & Refunds</h1>
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

      {/* Scan Feedback Banner */}
      {scanFeedback && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse ${
            scanFeedback.type === 'success'
              ? 'bg-green-500 text-white'
              : scanFeedback.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          {scanFeedback.type === 'scanning' && (
            <QrCodeIcon className="w-5 h-5 animate-pulse" />
          )}
          {scanFeedback.type === 'success' && (
            <CheckCircleIcon className="w-5 h-5" />
          )}
          {scanFeedback.type === 'error' && (
            <ExclamationTriangleIcon className="w-5 h-5" />
          )}
          <span className="font-medium">{scanFeedback.message}</span>
          {scanFeedback.orderNumber && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              {scanFeedback.orderNumber}
            </span>
          )}
        </div>
      )}

      {/* Process Return Section */}
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
          {/* Smart Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by receipt #, invoice #, PO #, customer name, product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-200 rounded-xl
                         focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                         transition-all outline-none bg-white"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-12 px-2 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <QrCodeIcon className={`h-6 w-6 ${isScanning ? 'text-emerald-500 animate-pulse' : 'text-emerald-400'}`} />
            </div>
          </div>

          {/* Search hints */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ReceiptPercentIcon className="h-3 w-3 text-blue-500" /> Receipt #
            </span>
            <span className="flex items-center gap-1">
              <DocumentTextIcon className="h-3 w-3 text-purple-500" /> Invoice #
            </span>
            <span className="flex items-center gap-1 text-orange-500">
              PO #
            </span>
            <span className="flex items-center gap-1">
              <QrCodeIcon className="h-3 w-3 text-emerald-500" /> Scan barcode
            </span>
            <span className="text-gray-400">|</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> select
            </span>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500">
                  Found {searchResults.length} transaction{searchResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {searchResults.map((order) => {
                  // Cast to get the matched doc type we added
                  const orderWithMatch = order as PosOrder & { _matchedDoc?: string };
                  const matchedDoc = orderWithMatch._matchedDoc;

                  return (
                    <div
                      key={order.id}
                      className="p-4 flex items-center justify-between hover:bg-emerald-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowReturnModal(true);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {/* Document numbers row */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {/* Receipt/Order Number - always show */}
                          <div className="flex items-center gap-1">
                            <ReceiptPercentIcon className="w-4 h-4 text-blue-500" />
                            <span className={`font-semibold ${matchedDoc === 'order' ? 'text-blue-600 bg-blue-50 px-1 rounded' : 'text-gray-900'}`}>
                              {order.orderNumber}
                            </span>
                          </div>

                          {/* Invoice Number - if exists */}
                          {order.invoiceNumber && (
                            <div className="flex items-center gap-1">
                              <DocumentTextIcon className="w-4 h-4 text-purple-500" />
                              <span className={`text-sm ${matchedDoc === 'invoice' ? 'text-purple-600 bg-purple-50 px-1 rounded font-medium' : 'text-gray-600'}`}>
                                {order.invoiceNumber}
                              </span>
                            </div>
                          )}

                          {/* Customer PO Number - if exists */}
                          {order.customerPONumber && (
                            <div className="flex items-center gap-1">
                              <span className={`text-sm ${matchedDoc === 'customerPO' ? 'text-orange-600 bg-orange-50 px-1 rounded font-medium' : 'text-gray-500'}`}>
                                PO: {order.customerPONumber}
                              </span>
                            </div>
                          )}

                          <Badge variant="info" className="text-xs">{order.items.length} items</Badge>
                        </div>

                        {/* Customer and date */}
                        <p className="text-sm text-gray-500">
                          {order.customerName} • {formatDate(new Date(order.completedAt || order.createdAt))}
                        </p>

                        {/* Show matching items */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.items.slice(0, 3).map(item => (
                            <span key={item.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name}
                            </span>
                          ))}
                          {order.items.length > 3 && (
                            <span className="text-xs text-gray-400">+{order.items.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-emerald-600">{formatJMD(order.total)}</p>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setShowReturnModal(true);
                          }}
                        >
                          Return Items
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No results message */}
          {searchTerm && searchResults.length === 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No transactions found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try searching by receipt #, invoice #, customer PO #, customer name, or product
              </p>
            </div>
          )}

          {/* Empty state - no search yet */}
          {!searchTerm && (
            <div className="mt-4 bg-white/50 rounded-xl border-2 border-dashed border-emerald-200 p-8 text-center">
              <div className="flex justify-center gap-2 mb-3">
                <ReceiptPercentIcon className="w-10 h-10 text-blue-300" />
                <DocumentTextIcon className="w-10 h-10 text-purple-300" />
                <QrCodeIcon className="w-10 h-10 text-emerald-300" />
              </div>
              <p className="text-emerald-700 font-medium">Ready to Process Returns</p>
              <p className="text-sm text-emerald-600/70 mt-1">
                Enter a receipt #, invoice #, customer PO # or scan a product barcode
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Return History:</span>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setDateRange({
                  start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0],
                });
              }}
            >
              This Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
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
            <p className="text-2xl font-bold text-orange-600">
              {formatJMD(returnSummary.totalRefundAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Average Refund</p>
            <p className="text-2xl font-bold text-purple-600">{formatJMD(returnSummary.avgRefund)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Returns by Reason */}
      <Card>
        <CardHeader>
          <CardTitle>Returns by Reason</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(returnSummary.reasonMap).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(returnSummary.reasonMap).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-gray-700">{reason}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width:
                            returnSummary.totalReturns > 0
                              ? `${(count / returnSummary.totalReturns) * 100}%`
                              : '0%',
                        }}
                      />
                    </div>
                    <span className="font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No returns in this period</p>
          )}
        </CardContent>
      </Card>

      {/* Return History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Return History ({refundedOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {refundedOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Order #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Reason</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Refund</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {refundedOrders.map((order) => {
                    const refundPayment = order.payments.find((p) => p.status === 'refunded');
                    return (
                      <tr key={order.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">
                          {formatDate(new Date(order.updatedAt))}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{order.orderNumber}</td>
                        <td className="py-3 px-4 text-gray-700">{order.customerName}</td>
                        <td className="py-3 px-4 text-gray-700">{order.refundReason || 'N/A'}</td>
                        <td className="py-3 px-4 text-right font-medium text-red-600">
                          {formatJMD(Math.abs(refundPayment?.amount || 0))}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="danger">
                            <CheckCircleIcon className="w-3 h-3 mr-1 inline" />
                            Refunded
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No returns recorded in this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return Modal */}
      {showReturnModal && selectedOrder && (
        <ProcessReturnModal
          order={selectedOrder}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedOrder(null);
          }}
          onProcessReturn={handleProcessReturn}
          getReturnableQuantity={getReturnableQuantity}
        />
      )}

      {/* Supervisor PIN Modal for Return Authorization */}
      <SupervisorPinModal
        isOpen={showSupervisorModal}
        onClose={handleSupervisorModalClose}
        onApprove={handleSupervisorApproval}
        action="return"
        actionDescription={pendingReturn
          ? `Process refund of ${formatJMD(pendingReturn.refundAmount)} for order ${selectedOrder?.orderNumber || ''}`
          : 'Authorize return'
        }
        amount={pendingReturn?.refundAmount}
        currency="JMD"
      />
    </div>
  );
}
