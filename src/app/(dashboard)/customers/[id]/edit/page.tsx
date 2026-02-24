'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Card, Button } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useCustomer, useUpdateCustomer } from '@/hooks/api/useCustomers';
import type { JamaicanParish } from '@/types';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const JAMAICAN_PARISHES: JamaicanParish[] = [
  'Kingston',
  'St. Andrew',
  'St. Thomas',
  'Portland',
  'St. Mary',
  'St. Ann',
  'Trelawny',
  'St. James',
  'Hanover',
  'Westmoreland',
  'St. Elizabeth',
  'Manchester',
  'Clarendon',
  'St. Catherine',
];

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;
  const { can } = usePermissions();

  const { data: customerData, isLoading: customerLoading } = useCustomer(customerId);
  const updateCustomerMutation = useUpdateCustomer();

  // Handle both direct and nested response shapes
  const customer = (customerData as any)?.data ?? customerData;

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    type: 'customer' as 'customer' | 'vendor' | 'both',
    trnNumber: '',
    street: '',
    city: '',
    parish: '' as JamaicanParish | '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Map Prisma enum parish values back to human-readable names
  const PARISH_ENUM_TO_NAME: Record<string, JamaicanParish> = {
    'KINGSTON': 'Kingston',
    'ST_ANDREW': 'St. Andrew',
    'ST_THOMAS': 'St. Thomas',
    'PORTLAND': 'Portland',
    'ST_MARY': 'St. Mary',
    'ST_ANN': 'St. Ann',
    'TRELAWNY': 'Trelawny',
    'ST_JAMES': 'St. James',
    'HANOVER': 'Hanover',
    'WESTMORELAND': 'Westmoreland',
    'ST_ELIZABETH': 'St. Elizabeth',
    'MANCHESTER': 'Manchester',
    'CLARENDON': 'Clarendon',
    'ST_CATHERINE': 'St. Catherine',
  };

  // Load customer data into form
  useEffect(() => {
    if (customer) {
      // API returns flat address fields (addressStreet, addressCity, etc.)
      const parishRaw = customer.addressParish as string | null | undefined;
      const parishName = parishRaw ? (PARISH_ENUM_TO_NAME[parishRaw] ?? parishRaw as JamaicanParish) : '';

      setFormData({
        name: customer.name || '',
        companyName: customer.companyName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        type: customer.type || 'customer',
        trnNumber: customer.trnNumber || '',
        street: customer.addressStreet || '',
        city: customer.addressCity || '',
        parish: parishName,
        notes: customer.notes || '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  // Permission check
  if (!can('customers:update')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-4">You do not have permission to edit customers.</p>
        <Link href="/customers" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Back to Customers
        </Link>
      </div>
    );
  }

  if (customerLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <div className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">Customer not found</p>
            <Button onClick={() => router.push('/customers')}>
              Back to Customers
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.phone) {
      const phonePattern = /^876-?\d{3}-?\d{4}$/;
      if (!phonePattern.test(formData.phone.replace(/\s/g, ''))) {
        newErrors.phone = 'Phone must be in 876-XXX-XXXX format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length <= 3) {
      setFormData({ ...formData, phone: cleaned });
    } else if (cleaned.length <= 6) {
      setFormData({ ...formData, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` });
    } else if (cleaned.length <= 10) {
      setFormData({ ...formData, phone: `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: Record<string, unknown> = {
      type: formData.type,
      name: formData.name.trim(),
      companyName: formData.companyName.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      trnNumber: formData.trnNumber.trim() || null,
      notes: formData.notes.trim() || null,
    };

    if (formData.street || formData.city || formData.parish) {
      payload.address = {
        street: formData.street.trim(),
        city: formData.city.trim(),
        parish: formData.parish || null,
        country: 'Jamaica',
      };
    }

    try {
      await updateCustomerMutation.mutateAsync({ id: customer.id, data: payload });
      router.push(`/customers/${customer.id}`);
    } catch {
      // handled by React Query
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          icon={<ArrowLeftIcon className="w-4 h-4" />}
        >
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Customer</h1>
          <p className="text-gray-500 dark:text-gray-400">Update customer information</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name or business name"
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Optional company/trading name"
                  autoComplete="organization"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    autoComplete="email"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="876-XXX-XXXX"
                    autoComplete="tel"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Street address"
                  autoComplete="street-address"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City/Town</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City or town"
                    autoComplete="address-level2"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parish
                  </label>
                  <select
                    value={formData.parish}
                    onChange={(e) => setFormData({ ...formData, parish: e.target.value as JamaicanParish })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">Select parish...</option>
                    {JAMAICAN_PARISHES.map((parish) => (
                      <option key={parish} value={parish}>
                        {parish}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Business Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'customer' | 'vendor' | 'both' })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  >
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                    <option value="both">Both (Customer & Vendor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TRN (Tax Registration Number)</label>
                  <input
                    type="text"
                    value={formData.trnNumber}
                    onChange={(e) => setFormData({ ...formData, trnNumber: e.target.value })}
                    placeholder="000-000-000"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              rows={4}
              placeholder="Additional notes or special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateCustomerMutation.isPending}>
              {updateCustomerMutation.isPending ? 'Updating...' : 'Update Customer'}
            </Button>
          </div>

          {updateCustomerMutation.isError && (
            <p className="text-sm text-red-600 mt-2">
              Failed to update customer. Please try again.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
