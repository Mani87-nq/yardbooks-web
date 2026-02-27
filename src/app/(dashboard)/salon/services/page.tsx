'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SparklesIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PencilIcon,
  TagIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────

interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  services?: SalonService[];
}

interface SalonService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  bufferTime: number;
  categoryId: string;
  category?: ServiceCategory;
  isActive: boolean;
  isPopular: boolean;
  commissionType: string;
  commissionRate: number;
  sortOrder: number;
}

// ─── Component ────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<SalonService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // ── Service modal ──
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<SalonService | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    price: '',
    duration: '30',
    bufferTime: '0',
    isActive: true,
  });
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [serviceFormLoading, setServiceFormLoading] = useState(false);

  // ── Category modal ──
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [categoryFormLoading, setCategoryFormLoading] = useState(false);

  // ── Fetch data ──
  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [servicesRes, categoriesRes] = await Promise.all([
        fetch('/api/modules/salon/services'),
        fetch('/api/modules/salon/services/categories'),
      ]);

      if (!servicesRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to load services');
      }

      const servicesData = await servicesRes.json();
      const categoriesData = await categoriesRes.json();

      setServices(servicesData.data || []);
      setCategories(categoriesData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // ── Filter services ──
  const filteredServices = activeCategory === 'all'
    ? services
    : services.filter((s) => s.categoryId === activeCategory);

  // ── Service CRUD ──
  const openServiceModal = (service?: SalonService) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || '',
        categoryId: service.categoryId,
        price: String(Number(service.price)),
        duration: String(service.duration),
        bufferTime: String(service.bufferTime || 0),
        isActive: service.isActive,
      });
    } else {
      setEditingService(null);
      setServiceForm({
        name: '',
        description: '',
        categoryId: categories[0]?.id || '',
        price: '',
        duration: '30',
        bufferTime: '0',
        isActive: true,
      });
    }
    setServiceFormError(null);
    setShowServiceModal(true);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim()) {
      setServiceFormError('Service name is required');
      return;
    }
    if (!serviceForm.categoryId) {
      setServiceFormError('Please select a category');
      return;
    }

    try {
      setServiceFormLoading(true);
      setServiceFormError(null);

      const payload = {
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        categoryId: serviceForm.categoryId,
        price: parseFloat(serviceForm.price) || 0,
        duration: parseInt(serviceForm.duration) || 30,
        bufferTime: parseInt(serviceForm.bufferTime) || 0,
        isActive: serviceForm.isActive,
      };

      const url = editingService
        ? `/api/modules/salon/services/${editingService.id}`
        : '/api/modules/salon/services';

      const res = await fetch(url, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save service');
      }

      setShowServiceModal(false);
      setEditingService(null);
      await fetchServices();
    } catch (err) {
      setServiceFormError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setServiceFormLoading(false);
    }
  };

  // ── Category CRUD ──
  const openCategoryModal = (category?: ServiceCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '' });
    }
    setCategoryFormError(null);
    setShowCategoryModal(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryFormError('Category name is required');
      return;
    }

    try {
      setCategoryFormLoading(true);
      setCategoryFormError(null);

      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
      };

      const url = editingCategory
        ? `/api/modules/salon/services/categories/${editingCategory.id}`
        : '/api/modules/salon/services/categories';

      const res = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save category');
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      await fetchServices();
    } catch (err) {
      setCategoryFormError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setCategoryFormLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service Catalog</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCategoryModal()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <FolderIcon className="w-4 h-4" />
            Add Category
          </button>
          <button
            onClick={() => openServiceModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Service
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All Services
          <span className="text-xs opacity-70">({services.length})</span>
        </button>
        {categories.map((cat) => {
          const count = services.filter((s) => s.categoryId === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.name}
              <span className="text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Categories management row */}
      {categories.length > 0 && activeCategory !== 'all' && (
        <div className="flex items-center gap-2">
          {(() => {
            const cat = categories.find((c) => c.id === activeCategory);
            if (!cat) return null;
            return (
              <button
                onClick={() => openCategoryModal(cat)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <PencilIcon className="w-3.5 h-3.5" />
                Edit category
              </button>
            );
          })()}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={fetchServices}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <SparklesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No services found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {categories.length === 0
              ? 'Create a category first, then add services.'
              : 'Add your first service to get started.'}
          </p>
          <button
            onClick={() => categories.length > 0 ? openServiceModal() : openCategoryModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium mt-2"
          >
            <PlusIcon className="w-4 h-4" />
            {categories.length > 0 ? 'Add Service' : 'Add Category'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow ${
                !service.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{service.name}</h3>
                    {service.isPopular && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                        Popular
                      </span>
                    )}
                    {!service.isActive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  {service.category && (
                    <div className="flex items-center gap-1 mt-1">
                      <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{service.category.name}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openServiceModal(service)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>

              {service.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{service.description}</p>
              )}

              <div className="flex items-center gap-4 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollarIcon className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ${Number(service.price).toLocaleString('en-JM', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{service.duration} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Service Modal ── */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingService ? 'Edit Service' : 'Add Service'}
              </h2>
              <button
                onClick={() => { setShowServiceModal(false); setServiceFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleServiceSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {serviceFormError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {serviceFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Women's Haircut"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                <select
                  value={serviceForm.categoryId}
                  onChange={(e) => setServiceForm({ ...serviceForm, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (mins) *</label>
                  <input
                    type="number"
                    value={serviceForm.duration}
                    onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="5"
                    max="480"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (JMD) *</label>
                  <input
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Describe the service..."
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceForm.isActive}
                    onChange={(e) => setServiceForm({ ...serviceForm, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>

              </div>
              <div className="flex-shrink-0 flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowServiceModal(false); setServiceFormError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={serviceFormLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {serviceFormLoading ? 'Saving...' : editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={() => { setShowCategoryModal(false); setCategoryFormError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCategorySubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {categoryFormError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {categoryFormError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Hair, Nails, Skincare"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                  placeholder="Brief description of this category..."
                />
              </div>

              </div>
              <div className="flex-shrink-0 flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowCategoryModal(false); setCategoryFormError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categoryFormLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {categoryFormLoading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
