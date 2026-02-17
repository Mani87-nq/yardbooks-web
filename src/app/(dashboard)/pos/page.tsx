'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { usePosStore, useTodayOrders } from '@/store/posStore';
import { useAppStore, useActiveProducts } from '@/store/appStore';
import { formatJMD, cn } from '@/lib/utils';
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
} from '@heroicons/react/24/outline';

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

// Product Grid Item
function ProductCard({
  product,
  onAdd,
}: {
  product: { id: string; name: string; unitPrice: number; quantity: number; category?: string; sku: string };
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      className="p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
    >
      <div className="aspect-square mb-3 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
        <ShoppingCartIcon className="w-8 h-8 text-gray-400 group-hover:text-emerald-500" />
      </div>
      <h3 className="font-medium text-gray-900 text-sm truncate">{product.name}</h3>
      <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
      <div className="flex items-center justify-between">
        <span className="font-bold text-emerald-600">{formatJMD(product.unitPrice)}</span>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          product.quantity <= 0 ? "bg-red-100 text-red-700" :
          product.quantity <= 10 ? "bg-yellow-100 text-yellow-700" :
          "bg-emerald-100 text-emerald-700"
        )}>
          {product.quantity} left
        </span>
      </div>
    </button>
  );
}

// Cart Item
function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: { tempId: string; name: string; quantity: number; unitPrice: number; uomCode: string };
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const total = item.quantity * item.unitPrice;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
        <p className="text-xs text-gray-500">{formatJMD(item.unitPrice)} / {item.uomCode}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 hover:bg-gray-100"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 hover:bg-gray-100"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="text-right min-w-[80px]">
        <p className="font-medium text-gray-900">{formatJMD(total)}</p>
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
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

  const products = useActiveProducts();
  const customers = useAppStore((state) => state.customers);
  const todayOrders = useTodayOrders();

  const currentCart = usePosStore((state) => state.currentCart);
  const addToCart = usePosStore((state) => state.addToCart);
  const updateCartItem = usePosStore((state) => state.updateCartItem);
  const removeFromCart = usePosStore((state) => state.removeFromCart);
  const clearCart = usePosStore((state) => state.clearCart);
  const setCartCustomer = usePosStore((state) => state.setCartCustomer);
  const createOrderFromCart = usePosStore((state) => state.createOrderFromCart);
  const addPayment = usePosStore((state) => state.addPayment);
  const completeOrder = usePosStore((state) => state.completeOrder);
  const posSettings = usePosStore((state) => state.settings);
  const holdOrder = usePosStore((state) => state.holdOrder);
  const orders = usePosStore((state) => state.orders);
  const sessions = usePosStore((state) => state.sessions);
  const currentSessionId = usePosStore((state) => state.currentSessionId);

  // Derived state - calculated outside store to avoid infinite loops
  const currentSession = useMemo(() => {
    if (!currentSessionId) return undefined;
    return sessions.find((s) => s.id === currentSessionId);
  }, [currentSessionId, sessions]);

  const heldOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'held');
  }, [orders]);

  const cartTotals = useMemo(() => {
    const gctRate = posSettings.gctRate;
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
  }, [currentCart, posSettings.gctRate]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Handle add to cart
  const handleAddToCart = (product: typeof products[0]) => {
    addToCart({
      productId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.unitPrice,
      uomCode: product.unit || 'EA',
      isGctExempt: product.gctRate === 'exempt',
    });
  };

  // Handle checkout
  const handleCheckout = () => {
    if (currentCart.items.length === 0) return;
    setShowPaymentModal(true);
  };

  // Process payment
  const handleProcessPayment = () => {
    // Create order from cart
    const order = createOrderFromCart({
      cart: currentCart,
      sessionId: currentSession?.id,
    });

    // Add payment
    const tenderedAmount = parseFloat(cashTendered) || cartTotals.total;
    addPayment({
      orderId: order.id,
      method: paymentMethod as 'cash' | 'jam_dex' | 'card_visa',
      amount: cartTotals.total,
      amountTendered: paymentMethod === 'cash' ? tenderedAmount : undefined,
    });

    // Complete order
    completeOrder(order.id);

    // Reset
    setShowPaymentModal(false);
    setCashTendered('');
    setPaymentMethod('cash');
  };

  // Hold order
  const handleHoldOrder = () => {
    if (currentCart.items.length === 0) return;
    const order = createOrderFromCart({
      cart: currentCart,
      sessionId: currentSession?.id,
    });
    holdOrder(order.id, 'Parked from POS');
  };

  const changeAmount = paymentMethod === 'cash' && cashTendered
    ? parseFloat(cashTendered) - cartTotals.total
    : 0;

  // Quick cash amounts
  const quickCashAmounts = [1000, 2000, 5000, 10000];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0">
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
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                !selectedCategory
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  selectedCategory === category
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => handleAddToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Current Order</h2>
            <div className="flex gap-2">
              <Link href="/pos/held">
                <Button variant="ghost" size="sm">
                  <ClockIcon className="w-4 h-4" />
                  <span className="ml-1">{heldOrders.length}</span>
                </Button>
              </Link>
              <Link href="/pos/settings">
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
              <CartItem
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
            <span className="text-gray-500">GCT (15%)</span>
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
              disabled={currentCart.items.length === 0}
            >
              <PauseIcon className="w-4 h-4 mr-1" />
              Hold
            </Button>
          </div>
          <Button
            className="w-full"
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
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      paymentMethod === method.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <method.icon className={cn(
                      "w-6 h-6",
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
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcessPayment}
            disabled={paymentMethod === 'cash' && (!cashTendered || parseFloat(cashTendered) < cartTotals.total)}
          >
            Complete Payment
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
            {customers
              .filter((c) => c.type === 'customer' || c.type === 'both')
              .map((customer) => (
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
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}
