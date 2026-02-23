'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/store/appStore';
import type { CustomerPOItem } from '@/types/customerPO';

export default function CreateCustomerPOPage() {
  const router = useRouter();
  const customers = useAppStore((state) => state.customers);
  const products = useAppStore((state) => state.products);

  const [formData, setFormData] = useState({
    customerId: '',
    poNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    requestedDeliveryDate: '',
    customerReference: '',
    notes: '',
    internalNotes: '',
  });

  const [items, setItems] = useState<Partial<CustomerPOItem>[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const selectedCustomer = customers.find((c) => c.id === formData.customerId);

  const addItem = (product: typeof products[0]) => {
    const newItem: Partial<CustomerPOItem> = {
      id: `item-${Date.now()}`,
      productId: product.id,
      description: product.name,
      orderedQuantity: 1,
      invoicedQuantity: 0,
      remainingQuantity: 1,
      uomShortCode: product.unit || 'EA',
      agreedUnitPrice: product.unitPrice,
      lineNumber: items.length + 1,
    };
    setItems([...items, newItem]);
    setShowProductSearch(false);
    setSearchProduct('');
  };

  const updateItem = (index: number, updates: Partial<CustomerPOItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    if (updates.orderedQuantity !== undefined) {
      newItems[index].remainingQuantity = updates.orderedQuantity - (newItems[index].invoicedQuantity || 0);
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!formData.customerId || !formData.poNumber || items.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const totalOrdered = items.reduce((sum, item) => sum + (item.orderedQuantity || 0), 0);

      const payload = {
        customerId: formData.customerId,
        customer: selectedCustomer ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          companyName: selectedCustomer.companyName,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
        } : undefined,
        poNumber: formData.poNumber,
        status: asDraft ? 'draft' : 'open',
        orderDate: formData.orderDate,
        requestedDeliveryDate: formData.requestedDeliveryDate || undefined,
        customerReference: formData.customerReference || undefined,
        notes: formData.notes || undefined,
        internalNotes: formData.internalNotes || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          orderedQuantity: item.orderedQuantity || 1,
          invoicedQuantity: 0,
          remainingQuantity: item.orderedQuantity || 1,
          uomShortCode: item.uomShortCode || 'EA',
          agreedUnitPrice: item.agreedUnitPrice || 0,
          lineNumber: item.lineNumber,
        })),
        totalOrderedQuantity: totalOrdered,
        totalInvoicedQuantity: 0,
        totalRemainingQuantity: totalOrdered,
      };

      await api.post('/api/v1/customer-pos', payload);
      router.push('/customer-po');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create purchase order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/customer-po"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Customer PO</h1>
          <p className="text-gray-500">Record a new customer purchase order</p>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Customer & PO Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              >
                <option value="">Select customer...</option>
                {customers.filter(c => c.type === 'customer' || c.type === 'both').map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.companyName ? `(${customer.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.poNumber}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                placeholder="Customer's PO number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requested Delivery Date
              </label>
              <input
                type="date"
                value={formData.requestedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, requestedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Reference / Attention To
              </label>
              <input
                type="text"
                value={formData.customerReference}
                onChange={(e) => setFormData({ ...formData, customerReference: e.target.value })}
                placeholder="Buyer name or reference"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={() => setShowProductSearch(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Add Item
            </button>
          </div>

          {showProductSearch && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredProducts.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="w-full text-left px-3 py-2 hover:bg-white rounded-lg transition-colors"
                  >
                    <span className="font-medium text-gray-900">{product.name}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {product.sku} - ${product.unitPrice.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowProductSearch(false)}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items added yet. Click &quot;Add Item&quot; to start.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="pb-3 font-medium">Item</th>
                    <th className="pb-3 font-medium w-24">Qty</th>
                    <th className="pb-3 font-medium w-20">UOM</th>
                    <th className="pb-3 font-medium w-32">Unit Price</th>
                    <th className="pb-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.orderedQuantity || 1}
                          onChange={(e) => updateItem(index, { orderedQuantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="text"
                          value={item.uomShortCode || 'EA'}
                          onChange={(e) => updateItem(index, { uomShortCode: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.agreedUnitPrice || 0}
                          onChange={(e) => updateItem(index, { agreedUnitPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (visible to customer)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Special instructions..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Notes
              </label>
              <textarea
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Internal notes..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/customer-po"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create & Open'}
          </button>
        </div>
      </form>
    </div>
  );
}
