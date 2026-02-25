'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useProducts } from '@/hooks/api/useProducts';
import { useCustomers } from '@/hooks/api/useCustomers';
import {
  usePosSettings,
  usePosOrders,
  useCreatePosOrder,
  useAddPosPayment,
  useHoldPosOrder,
  frontendMethodToApi,
} from '@/hooks/api/usePos';
import { formatJMD, cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { printReceipt, type ReceiptData } from '@/lib/pos-receipt';
import {
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  UserIcon,
  TagIcon,
  ClockIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ReceiptRefundIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

// ---- Local cart types (client-only, not persisted to API until order creation) ----

interface CartItem {
  tempId: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  uomCode: string;
  unitPrice: number;
  isGctExempt: boolean;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  notes?: string;
}

interface LocalCart {
  items: CartItem[];
  customerId?: string;
  customerName: string;
  orderDiscountType?: 'percent' | 'amount';
  orderDiscountValue?: number;
  orderDiscountReason?: string;
  notes?: string;
}

const EMPTY_CART: LocalCart = {
  items: [],
  customerName: 'Walk-in',
};

let tempIdCounter = 0;
function nextTempId() {
  return `tmp_${++tempIdCounter}_${Date.now()}`;
}

// Payment method icons
const PaymentMethodIcon = ({ method }: { method: string }) => {
  switch (method) {
    case 'cash':
      return <BanknotesIcon className="w-5 h-5" />;
    case 'jam_dex':
    case 'lynk_wallet':
    case 'wipay':
      return <DevicePhoneMobileIcon className="w-5 h-5" />;
    default:
      return <CreditCardIcon className="w-5 h-5" />;
  }
};

// Product Grid Item — touch-optimized with min 48px tap target
function ProductCard({
  product,
  onAdd,
}: {
  product: { id: string; name: string; unitPrice: number; quantity: number; category?: string | null; sku: string };
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-400 active:border-emerald-500 active:scale-[0.97] hover:shadow-md transition-all text-left group touch-manipulation select-none min-h-[100px]"
    >
      <div className="aspect-square mb-2 sm:mb-3 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
        <ShoppingCartIcon className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400 group-hover:text-emerald-500" />
      </div>
      <h3 className="font-medium text-gray-900 text-sm leading-tight truncate">{product.name}</h3>
      <p className="text-xs text-gray-500 mb-1 sm:mb-2 truncate">{product.sku}</p>
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-emerald-600 text-sm">{formatJMD(product.unitPrice)}</span>
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap",
          product.quantity <= 0 ? "bg-red-100 text-red-700" :
          product.quantity <= 10 ? "bg-yellow-100 text-yellow-700" :
          "bg-emerald-100 text-emerald-700"
        )}>
          {product.quantity}
        </span>
      </div>
    </button>
  );
}

// Cart Item — touch-optimized with 44px+ tap targets
function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const total = item.quantity * item.unitPrice;

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
        <p className="text-xs text-gray-500">{formatJMD(item.unitPrice)} / {item.uomCode}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 touch-manipulation select-none"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 touch-manipulation select-none"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="text-right min-w-[72px]">
        <p className="font-medium text-gray-900 text-sm tabular-nums">{formatJMD(total)}</p>
      </div>
      <button
        onClick={onRemove}
        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 active:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors touch-manipulation select-none"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [currentCart, setCurrentCart] = useState<LocalCart>(EMPTY_CART);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

  // ---- API data fetching ----
  const { data: productsData, isLoading: productsLoading, error: productsError } = useProducts({ limit: 200 });
  const { data: customersData } = useCustomers({ type: 'CUSTOMER', limit: 100 });
  const { data: settingsData, isLoading: settingsLoading } = usePosSettings();
  const { data: heldOrdersData } = usePosOrders({ status: 'HELD', limit: 1 });
  const activeCompany = useAppStore((state) => state.activeCompany);

  const products = productsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const posSettings = settingsData;
  const gctRate = posSettings ? Number(posSettings.gctRate) : 0.15;
  const heldOrderCount = heldOrdersData?.pagination?.hasMore
    ? `${heldOrdersData.data.length}+`
    : String(heldOrdersData?.data?.length ?? 0);

  // ---- Mutations ----
  const createOrder = useCreatePosOrder();
  const addPayment = useAddPosPayment();
  const holdOrderMutation = useHoldPosOrder();

  // ---- Cart logic (local state) ----

  const addToCart = useCallback((product: typeof products[0]) => {
    setCurrentCart((prev) => {
      // Check if product is already in cart
      const existing = prev.items.find((i) => i.productId === product.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            tempId: nextTempId(),
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: Number(product.unitPrice),
            uomCode: product.unit || 'EA',
            isGctExempt: product.gctRate === 'exempt',
          },
        ],
      };
    });
  }, []);

  const updateCartItem = useCallback((tempId: string, updates: Partial<CartItem>) => {
    setCurrentCart((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.tempId === tempId ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  const removeFromCart = useCallback((tempId: string) => {
    setCurrentCart((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.tempId !== tempId),
    }));
  }, []);

  const clearCart = useCallback(() => setCurrentCart(EMPTY_CART), []);

  const setCartCustomer = useCallback((customerId: string | undefined, customerName: string) => {
    setCurrentCart((prev) => ({ ...prev, customerId, customerName }));
  }, []);

  // ---- Derived state ----

  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let taxableAmount = 0;
    let exemptAmount = 0;
    let gctAmount = 0;
    let itemCount = 0;

    currentCart.items.forEach((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      if (item.isGctExempt) {
        exemptAmount += lineTotal;
      } else {
        taxableAmount += lineTotal;
        gctAmount += lineTotal * gctRate;
      }
      itemCount += item.quantity;
    });

    let discountAmount = 0;
    if (currentCart.orderDiscountType === 'percent' && currentCart.orderDiscountValue) {
      discountAmount = subtotal * (currentCart.orderDiscountValue / 100);
    } else if (currentCart.orderDiscountType === 'amount' && currentCart.orderDiscountValue) {
      discountAmount = currentCart.orderDiscountValue;
    }

    const total = subtotal - discountAmount + gctAmount;

    return { subtotal, discountAmount, taxableAmount, exemptAmount, gctAmount, total, itemCount };
  }, [currentCart, gctRate]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p: any) => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product: any) => {
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Handle checkout
  const handleCheckout = () => {
    if (currentCart.items.length === 0) return;
    setShowPaymentModal(true);
  };

  // Process payment: create order via API, then add payment via API
  const handleProcessPayment = async () => {
    if (processingPayment) return;
    setProcessingPayment(true);

    try {
      // Build items in API format
      const apiItems = currentCart.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        uomCode: item.uomCode,
        unitPrice: item.unitPrice,
        isGctExempt: item.isGctExempt,
        ...(item.discountType ? {
          discountType: item.discountType === 'percent' ? 'PERCENTAGE' : 'FIXED',
          discountValue: item.discountValue,
        } : {}),
        notes: item.notes,
      }));

      // Create order via API
      const order = await createOrder.mutateAsync({
        customerId: currentCart.customerId,
        customerName: currentCart.customerName || 'Walk-in Customer',
        items: apiItems,
        ...(currentCart.orderDiscountType ? {
          orderDiscountType: currentCart.orderDiscountType === 'percent' ? 'PERCENTAGE' : 'FIXED',
          orderDiscountValue: currentCart.orderDiscountValue,
          orderDiscountReason: currentCart.orderDiscountReason,
        } : {}),
        notes: currentCart.notes,
        status: 'PENDING_PAYMENT',
      });

      // Add payment to the order
      const tenderedAmount = parseFloat(cashTendered) || cartTotals.total;
      const paymentResult = await addPayment.mutateAsync({
        orderId: order.id,
        method: frontendMethodToApi(paymentMethod),
        amount: Number(order.total),
        ...(paymentMethod === 'cash' ? { amountTendered: tenderedAmount } : {}),
        status: 'COMPLETED',
      });

      // Build receipt data for print
      const changeAmt = paymentMethod === 'cash' ? Math.max(0, tenderedAmount - Number(order.total)) : 0;
      const receiptData: ReceiptData = {
        businessName: posSettings?.businessName || activeCompany?.businessName || 'YaadBooks',
        businessAddress: posSettings?.businessAddress ?? undefined,
        businessPhone: posSettings?.businessPhone ?? undefined,
        businessTRN: posSettings?.businessTRN ?? undefined,
        gctRegistrationNumber: posSettings?.gctRegistrationNumber ?? undefined,
        logoUrl: posSettings?.businessLogo ?? undefined,
        showLogo: posSettings?.showLogo ?? false,
        orderNumber: order.orderNumber,
        date: order.createdAt,
        customerName: currentCart.customerName,
        items: currentCart.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice * (item.isGctExempt ? 1 : (1 + gctRate)),
          isGctExempt: item.isGctExempt,
        })),
        subtotal: cartTotals.subtotal,
        discountAmount: cartTotals.discountAmount > 0 ? cartTotals.discountAmount : undefined,
        discountLabel: currentCart.orderDiscountReason
          ? `Discount (${currentCart.orderDiscountReason})`
          : 'Discount',
        taxableAmount: cartTotals.taxableAmount,
        exemptAmount: cartTotals.exemptAmount,
        gctRate,
        gctAmount: cartTotals.gctAmount,
        total: Number(order.total),
        payments: [{
          method: paymentMethod,
          amount: Number(order.total),
          amountTendered: paymentMethod === 'cash' ? tenderedAmount : undefined,
          changeGiven: changeAmt > 0 ? changeAmt : undefined,
        }],
        changeGiven: changeAmt > 0 ? changeAmt : undefined,
        receiptFooter: posSettings?.receiptFooter ?? undefined,
      };

      // Show receipt confirmation modal
      setLastReceiptData(receiptData);
      setShowReceiptModal(true);

      // Reset cart
      setShowPaymentModal(false);
      setCashTendered('');
      setPaymentMethod('cash');
      setCurrentCart(EMPTY_CART);
    } catch (err) {
      console.error('Payment processing failed:', err);
      // The error will be visible in the UI through the mutation state
    } finally {
      setProcessingPayment(false);
    }
  };

  // Hold order: create order via API, then hold it
  const handleHoldOrder = async () => {
    if (currentCart.items.length === 0) return;

    try {
      const apiItems = currentCart.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        uomCode: item.uomCode,
        unitPrice: item.unitPrice,
        isGctExempt: item.isGctExempt,
        notes: item.notes,
      }));

      // Create as DRAFT, then hold
      const order = await createOrder.mutateAsync({
        customerId: currentCart.customerId,
        customerName: currentCart.customerName || 'Walk-in Customer',
        items: apiItems,
        notes: currentCart.notes,
        status: 'PENDING_PAYMENT',
      });

      await holdOrderMutation.mutateAsync({
        id: order.id,
        heldReason: 'Parked from POS',
      });

      setCurrentCart(EMPTY_CART);
    } catch (err) {
      console.error('Hold order failed:', err);
    }
  };

  const changeAmount = paymentMethod === 'cash' && cashTendered
    ? parseFloat(cashTendered) - cartTotals.total
    : 0;

  // Quick cash amounts
  const quickCashAmounts = [1000, 2000, 5000, 10000];

  // Error from mutations
  const mutationError = createOrder.error || addPayment.error || holdOrderMutation.error;

  // Loading state
  if (productsLoading || settingsLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-emerald-500 animate-spin" />
          <p className="text-gray-500">Loading POS...</p>
        </div>
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-gray-700 font-medium mb-1">Failed to load products</p>
          <p className="text-gray-500 text-sm">
            {productsError instanceof Error ? productsError.message : 'Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Mutation error banner */}
      {mutationError && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md shadow-lg">
          <div className="flex items-start gap-2">
            <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Operation failed</p>
              <p className="text-sm text-red-600 mt-1">
                {mutationError instanceof Error ? mutationError.message : 'An error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors touch-manipulation select-none",
                !selectedCategory
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              )}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors touch-manipulation select-none",
                  selectedCategory === category
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ShoppingCartIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No products found</p>
                <Link href="/inventory/new" className="text-emerald-600 hover:underline text-sm">
                  Add your first product
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product: any) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-96 lg:max-w-96 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[300px] lg:min-h-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Current Order</h2>
            <div className="flex gap-2">
              <Link href="/pos/held" title="Held Orders">
                <Button variant="ghost" size="sm">
                  <ClockIcon className="w-4 h-4" />
                  <span className="ml-1">{heldOrderCount}</span>
                </Button>
              </Link>
              <Link href="/pos/returns" title="Returns">
                <Button variant="ghost" size="sm">
                  <ReceiptRefundIcon className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/pos/sessions" title="Sessions">
                <Button variant="ghost" size="sm">
                  <DocumentTextIcon className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/pos/grid-settings" title="Grid Settings">
                <Button variant="ghost" size="sm">
                  <Cog6ToothIcon className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Customer Selection */}
          <button
            onClick={() => setShowCustomerModal(true)}
            className="w-full flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-left hover:bg-gray-100 transition-colors"
          >
            <UserIcon className="w-5 h-5 text-gray-400" />
            <span className="flex-1 text-sm text-gray-600">
              {currentCart.customerName || 'Walk-in Customer'}
            </span>
            <span className="text-xs text-emerald-600">Change</span>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {currentCart.items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Cart is empty</p>
              </div>
            </div>
          ) : (
            currentCart.items.map((item) => (
              <CartItemRow
                key={item.tempId}
                item={item}
                onUpdateQuantity={(qty) => updateCartItem(item.tempId, { quantity: qty })}
                onRemove={() => removeFromCart(item.tempId)}
              />
            ))
          )}
        </div>

        {/* Cart Summary */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatJMD(cartTotals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">GCT ({Math.round(gctRate * 100)}%)</span>
            <span className="text-gray-900">{formatJMD(cartTotals.gctAmount)}</span>
          </div>
          {cartTotals.discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="text-red-600">-{formatJMD(cartTotals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-100">
            <span>Total</span>
            <span className="text-emerald-600">{formatJMD(cartTotals.total)}</span>
          </div>
        </div>

        {/* Cart Actions */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={currentCart.items.length === 0}
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={handleHoldOrder}
              disabled={currentCart.items.length === 0 || holdOrderMutation.isPending}
            >
              {holdOrderMutation.isPending ? (
                <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <PauseIcon className="w-4 h-4 mr-1" />
              )}
              Hold
            </Button>
          </div>
          <Button
            className="w-full touch-manipulation min-h-[52px]"
            size="lg"
            onClick={handleCheckout}
            disabled={currentCart.items.length === 0}
          >
            <CreditCardIcon className="w-5 h-5 mr-2" />
            Pay {formatJMD(cartTotals.total)}
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Process Payment"
        size="lg"
      >
        <ModalBody>
          <div className="space-y-6">
            {/* Amount Due */}
            <div className="text-center py-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Amount Due</p>
              <p className="text-4xl font-bold text-emerald-600">{formatJMD(cartTotals.total)}</p>
            </div>

            {/* Payment Methods */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'cash', label: 'Cash', icon: BanknotesIcon },
                  { id: 'jam_dex', label: 'JAM-DEX', icon: DevicePhoneMobileIcon },
                  { id: 'card_visa', label: 'Card', icon: CreditCardIcon },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl border-2 transition-all touch-manipulation select-none min-h-[80px]",
                      paymentMethod === method.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                    )}
                  >
                    <method.icon className={cn(
                      "w-7 h-7",
                      paymentMethod === method.id ? "text-emerald-600" : "text-gray-400"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      paymentMethod === method.id ? "text-emerald-700" : "text-gray-700"
                    )}>
                      {method.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered */}
            {paymentMethod === 'cash' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cash Tendered
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  leftIcon={<span className="text-gray-400">$</span>}
                />
                <div className="flex gap-2 mt-3">
                  {quickCashAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCashTendered(amount.toString())}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors touch-manipulation select-none"
                    >
                      {formatJMD(amount)}
                    </button>
                  ))}
                </div>
                {changeAmount > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-xl text-center">
                    <p className="text-sm text-emerald-600 mb-1">Change Due</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatJMD(changeAmount)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {(createOrder.error || addPayment.error) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  {createOrder.error instanceof Error
                    ? createOrder.error.message
                    : addPayment.error instanceof Error
                    ? addPayment.error.message
                    : 'Payment failed. Please try again.'}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            disabled={
              processingPayment ||
              (paymentMethod === 'cash' && (!cashTendered || parseFloat(cashTendered) < cartTotals.total))
            }
          >
            {processingPayment ? (
              <>
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Complete Payment'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Customer Selection Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Select Customer"
        size="md"
      >
        <ModalBody>
          <div className="space-y-3">
            <button
              onClick={() => {
                setCartCustomer(undefined, 'Walk-in');
                setShowCustomerModal(false);
              }}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <UserIcon className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-900">Walk-in Customer</span>
            </button>
            {customers.map((customer: any) => (
              <button
                key={customer.id}
                onClick={() => {
                  setCartCustomer(customer.id, customer.name);
                  setShowCustomerModal(false);
                }}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <UserIcon className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.phone || customer.email}</p>
                </div>
              </button>
            ))}
            {customers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No customers found</p>
            )}
          </div>
        </ModalBody>
      </Modal>

      {/* Receipt Confirmation Modal (post-payment) */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => { setShowReceiptModal(false); setLastReceiptData(null); }}
        title="Payment Successful"
        size="sm"
      >
        <ModalBody>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Order Complete!</h3>
            {lastReceiptData && (
              <p className="text-2xl font-bold text-emerald-600 mb-1">{formatJMD(Number(lastReceiptData.total))}</p>
            )}
            {lastReceiptData && Number(lastReceiptData.changeGiven || 0) > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                Change: <span className="font-semibold">{formatJMD(Number(lastReceiptData.changeGiven))}</span>
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => { setShowReceiptModal(false); setLastReceiptData(null); }}
            className="flex-1"
          >
            No Receipt
          </Button>
          <Button
            onClick={() => {
              if (lastReceiptData) printReceipt(lastReceiptData);
              setShowReceiptModal(false);
              setLastReceiptData(null);
            }}
            className="flex-1"
          >
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
