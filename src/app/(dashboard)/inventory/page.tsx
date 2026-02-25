'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  QrCodeIcon,
  TagIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PermissionGate } from '@/components/PermissionGate';

interface ProductAPI {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  reorderLevel: number;
  unit: string;
  taxable: boolean;
  gctRate: string;
  barcode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function InventoryPage() {
  const { fc } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductAPI | null>(null);
  const [saveError, setSaveError] = useState('');
  const [showCostOfGoods, setShowCostOfGoods] = useState(false);

  // API hooks
  const { data: productsResponse, isLoading, error: fetchError, refetch } = useProducts({
    search: searchQuery || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    limit: 100,
  });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const products: ProductAPI[] = (productsResponse as any)?.data ?? [];

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    category: '',
    unitPrice: '',
    costPrice: '',
    quantity: '',
    reorderLevel: '',
    unit: 'EACH',
    gctApplicable: true,
    isActive: true,
  });

  // Get unique categories from fetched products
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  // Client-side filtering for stock level (API doesn't provide this filter)
  const filteredProducts = products.filter((product) => {
    const matchesStock = stockFilter === 'all' ||
      (stockFilter === 'low' && product.quantity <= (product.reorderLevel || 0) && product.quantity > 0) ||
      (stockFilter === 'out' && product.quantity === 0) ||
      (stockFilter === 'in' && product.quantity > 0);

    return matchesStock;
  });

  const handleOpenModal = (product?: ProductAPI) => {
    setSaveError('');
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || '',
        barcode: product.barcode || '',
        description: product.description || '',
        category: product.category || '',
        unitPrice: product.unitPrice.toString(),
        costPrice: product.costPrice?.toString() || '',
        quantity: product.quantity.toString(),
        reorderLevel: product.reorderLevel?.toString() || '',
        unit: product.unit || 'EACH',
        gctApplicable: product.taxable,
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        description: '',
        category: '',
        unitPrice: '',
        costPrice: '',
        quantity: '',
        reorderLevel: '',
        unit: 'EACH',
        gctApplicable: true,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!formData.name.trim()) {
      setSaveError('Please enter a product name');
      return;
    }
    if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
      setSaveError('Please enter a valid price');
      return;
    }
    if (!formData.sku.trim()) {
      setSaveError('Please enter a SKU');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined,
      category: formData.category || undefined,
      unitPrice: parseFloat(formData.unitPrice),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : 0,
      quantity: parseInt(formData.quantity) || 0,
      reorderLevel: formData.reorderLevel ? parseInt(formData.reorderLevel) : 0,
      unit: formData.unit,
      taxable: formData.gctApplicable,
      gctRate: formData.gctApplicable ? 'STANDARD' : 'EXEMPT',
      isActive: formData.isActive,
    };

    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data: payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save product';
      setSaveError(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct.mutateAsync(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete product';
        alert(message);
      }
    }
  };

  const stats = {
    total: products.length,
    active: products.filter(p => p.isActive).length,
    lowStock: products.filter(p => p.quantity <= (p.reorderLevel || 0) && p.quantity > 0).length,
    outOfStock: products.filter(p => p.quantity === 0).length,
    totalValue: products.reduce((sum, p) => sum + (Number(p.unitPrice || 0) * Number(p.quantity || 0)), 0),
  };

  const unitDisplay = (unit: string) => unit?.toLowerCase() || 'each';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={showCostOfGoods}
              onChange={(e) => setShowCostOfGoods(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            COGS
          </label>
          <PermissionGate permission="inventory:create">
            <Link href="/inventory/stock-count">
              <Button variant="outline" icon={<ArrowPathIcon className="w-4 h-4" />}>
                Stock Count
              </Button>
            </Link>
          </PermissionGate>
          <PermissionGate permission="inventory:create">
            <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
              Add Product
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Error State */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">Failed to load products. {fetchError instanceof Error ? fetchError.message : ''}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Products</p>
            <p className="text-2xl font-bold text-gray-900">{isLoading ? '-' : stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{isLoading ? '-' : stats.active}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Low Stock</p>
            <p className="text-2xl font-bold text-orange-600">{isLoading ? '-' : stats.lowStock}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600">{isLoading ? '-' : stats.outOfStock}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-blue-600">{isLoading ? '-' : fc(stats.totalValue)}</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            rightIcon={searchQuery ? (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            ) : undefined}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="all">All Stock</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500">Loading products...</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU/Barcode</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              {showCostOfGoods && <TableHead>Cost</TableHead>}
              {showCostOfGoods && <TableHead>Margin</TableHead>}
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showCostOfGoods ? 9 : 7} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No products found</p>
                  <PermissionGate permission="inventory:create">
                    <Button onClick={() => handleOpenModal()}>Add your first product</Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const isLowStock = product.quantity <= (product.reorderLevel || 0) && product.quantity > 0;
                const isOutOfStock = product.quantity === 0;

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{product.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {product.sku && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <TagIcon className="w-3 h-3" />
                            {product.sku}
                          </div>
                        )}
                        {product.barcode && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <QrCodeIcon className="w-3 h-3" />
                            {product.barcode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{product.category || '-'}</TableCell>
                    <TableCell className="font-medium">{fc(product.unitPrice)}</TableCell>
                    {showCostOfGoods && (
                      <TableCell className="text-gray-500">
                        {product.costPrice ? fc(product.costPrice) : '-'}
                      </TableCell>
                    )}
                    {showCostOfGoods && (
                      <TableCell>
                        {product.costPrice && product.unitPrice ? (
                          <span className={
                            ((product.unitPrice - product.costPrice) / product.unitPrice) * 100 > 30
                              ? 'text-emerald-600 font-medium'
                              : ((product.unitPrice - product.costPrice) / product.unitPrice) * 100 > 10
                              ? 'text-orange-600 font-medium'
                              : 'text-red-600 font-medium'
                          }>
                            {(((product.unitPrice - product.costPrice) / product.unitPrice) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={
                          isOutOfStock ? 'text-red-600 font-medium' :
                          isLowStock ? 'text-orange-600 font-medium' :
                          'text-gray-900'
                        }>
                          {product.quantity} {unitDisplay(product.unit)}
                        </span>
                        {isLowStock && <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />}
                        {isOutOfStock && <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={product.isActive ? 'success' : 'default'}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {product.taxable && (
                          <Badge variant="info">GCT</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <PermissionGate permission="inventory:update">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(product)}>
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="inventory:delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                            disabled={deleteProduct.isPending}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {saveError}
              </div>
            )}
            <Input
              label="Product Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter product name"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU *"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Stock keeping unit"
              />
              <Input
                label="Barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Barcode number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                rows={2}
              />
            </div>
            <Input
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Hardware, Plants, Tools"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Selling Price *"
                type="number"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Cost Price"
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
              />
              <Input
                label="Reorder Level"
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                placeholder="0"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="EACH">Each</option>
                  <option value="KG">Kilogram</option>
                  <option value="LB">Pound</option>
                  <option value="METRE">Meter</option>
                  <option value="FOOT">Foot</option>
                  <option value="BOX">Box</option>
                  <option value="CASE">Case</option>
                  <option value="DOZEN">Dozen</option>
                  <option value="LITRE">Litre</option>
                  <option value="GALLON">Gallon</option>
                  <option value="HOUR">Hour</option>
                  <option value="DAY">Day</option>
                </select>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.gctApplicable}
                  onChange={(e) => setFormData({ ...formData, gctApplicable: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">GCT Applicable (15%)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createProduct.isPending || updateProduct.isPending}
          >
            {(createProduct.isPending || updateProduct.isPending) ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
