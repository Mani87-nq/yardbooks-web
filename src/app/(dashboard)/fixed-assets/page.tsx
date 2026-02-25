'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Modal, ModalBody, ModalFooter } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useFixedAssets,
  useAssetCategories,
  useCreateFixedAsset,
  useUpdateFixedAsset,
  useDeleteFixedAsset,
  useRunDepreciation,
} from '@/hooks/api/useFixedAssets';
import type { FixedAssetAPI, AssetCategoryAPI } from '@/hooks/api/useFixedAssets';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CalculatorIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  TruckIcon,
  ComputerDesktopIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line' },
  { value: 'REDUCING_BALANCE', label: 'Reducing Balance' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Units of Production' },
  { value: 'NONE', label: 'None' },
];

// Jamaica Capital Allowance Classes (Income Tax Act)
const JAMAICA_CAPITAL_ALLOWANCE_CLASSES = [
  { class: 'A', name: 'Industrial Buildings', initialAllowance: 0.20, annualAllowance: 0.04, notes: 'Includes factory, mill, dock' },
  { class: 'B', name: 'Commercial Buildings', initialAllowance: 0.10, annualAllowance: 0.02, notes: 'Offices, retail spaces' },
  { class: 'C', name: 'Motor Vehicles', initialAllowance: 0.25, annualAllowance: 0.25, notes: 'Cars, vans, trucks. Cost cap: J$5M' },
  { class: 'D', name: 'Plant & Machinery', initialAllowance: 0.25, annualAllowance: 0.125, notes: 'General equipment' },
  { class: 'E', name: 'Computer Equipment', initialAllowance: 0.50, annualAllowance: 0.50, notes: 'IT hardware, software' },
  { class: 'F', name: 'Furniture & Fixtures', initialAllowance: 0.20, annualAllowance: 0.10, notes: 'Office furniture' },
  { class: 'G', name: 'Farm Works', initialAllowance: 0.33, annualAllowance: 0.167, notes: 'Agricultural improvements' },
];

// Fallback categories for the form when API categories haven't been set up yet
const FALLBACK_CATEGORIES = [
  { name: 'Buildings', usefulLife: 240, depreciationMethod: 'STRAIGHT_LINE' },
  { name: 'Vehicles', usefulLife: 60, depreciationMethod: 'REDUCING_BALANCE' },
  { name: 'Computer Equipment', usefulLife: 36, depreciationMethod: 'STRAIGHT_LINE' },
  { name: 'Furniture & Fixtures', usefulLife: 84, depreciationMethod: 'STRAIGHT_LINE' },
  { name: 'Machinery & Equipment', usefulLife: 120, depreciationMethod: 'STRAIGHT_LINE' },
  { name: 'Land', usefulLife: 0, depreciationMethod: 'NONE' },
];

const getCategoryIcon = (categoryName: string) => {
  if (categoryName?.includes('Building')) return BuildingOfficeIcon;
  if (categoryName?.includes('Vehicle') || categoryName?.includes('Motor')) return TruckIcon;
  if (categoryName?.includes('Computer')) return ComputerDesktopIcon;
  if (categoryName?.includes('Machinery') || categoryName?.includes('Plant')) return WrenchScrewdriverIcon;
  return CubeIcon;
};

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  IDLE: 'idle',
  UNDER_MAINTENANCE: 'under_maintenance',
  DISPOSED: 'disposed',
  LOST: 'lost',
  TRANSFERRED: 'transferred',
};

const getStatusDisplay = (status: string) => {
  return status.toLowerCase().replace(/_/g, ' ');
};

const getStatusVariant = (status: string): 'success' | 'warning' | 'default' | 'info' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DISPOSED' || status === 'LOST') return 'default';
  return 'warning';
};

export default function FixedAssetsPage() {
  const { fc } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDepreciationModal, setShowDepreciationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'allowances'>('assets');
  const [editingAsset, setEditingAsset] = useState<FixedAssetAPI | null>(null);
  const [saveError, setSaveError] = useState('');

  // API hooks
  const apiStatus = statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined;
  const { data: assetsResponse, isLoading, error: fetchError, refetch } = useFixedAssets({
    search: searchQuery || undefined,
    status: apiStatus,
    limit: 100,
  });
  const { data: categoriesResponse } = useAssetCategories();
  const createAsset = useCreateFixedAsset();
  const updateAsset = useUpdateFixedAsset();
  const deleteAsset = useDeleteFixedAsset();
  const runDepreciation = useRunDepreciation();

  const fixedAssets = assetsResponse?.data ?? [];
  const apiCategories = categoriesResponse?.data ?? [];

  // Use API categories if available, otherwise use fallback
  const categoryOptions = apiCategories.length > 0
    ? apiCategories.map(c => ({ id: c.id, name: c.name, usefulLife: c.defaultBookUsefulLifeMonths, depreciationMethod: c.defaultBookMethod }))
    : FALLBACK_CATEGORIES.map((c, i) => ({ id: `fallback-${i}`, name: c.name, usefulLife: c.usefulLife, depreciationMethod: c.depreciationMethod }));

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assetTag: '',
    categoryId: '',
    categoryName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: '',
    salvageValue: '',
    usefulLife: '',
    depreciationMethod: 'STRAIGHT_LINE',
    location: '',
    serialNumber: '',
    vendor: '',
  });

  // Client-side filtering for category (if needed beyond API search)
  const filteredAssets = fixedAssets.filter((asset) => {
    const matchesCategory = categoryFilter === 'all' ||
      asset.categoryName === categoryFilter ||
      asset.category?.name === categoryFilter;
    return matchesCategory;
  });

  const handleOpenModal = useCallback((asset?: FixedAssetAPI) => {
    setSaveError('');
    if (asset) {
      setEditingAsset(asset);
      setFormData({
        name: asset.name || asset.description || '',
        description: asset.description || '',
        assetTag: asset.assetTag || '',
        categoryId: asset.categoryId || '',
        categoryName: asset.categoryName || asset.category?.name || '',
        purchaseDate: asset.purchaseDate
          ? new Date(asset.purchaseDate).toISOString().split('T')[0]
          : asset.acquisitionDate
            ? new Date(asset.acquisitionDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        purchaseCost: (asset.purchaseCost ?? asset.acquisitionCost ?? '').toString(),
        salvageValue: (asset.bookResidualValue ?? '').toString(),
        usefulLife: (asset.bookUsefulLifeMonths ?? '').toString(),
        depreciationMethod: asset.bookDepreciationMethod || 'STRAIGHT_LINE',
        location: asset.location || asset.locationName || '',
        serialNumber: asset.serialNumber || '',
        vendor: asset.vendor || asset.supplierName || '',
      });
    } else {
      setEditingAsset(null);
      setFormData({
        name: '',
        description: '',
        assetTag: '',
        categoryId: '',
        categoryName: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseCost: '',
        salvageValue: '',
        usefulLife: '',
        depreciationMethod: 'STRAIGHT_LINE',
        location: '',
        serialNumber: '',
        vendor: '',
      });
    }
    setShowModal(true);
  }, []);

  const handleSave = async () => {
    setSaveError('');
    if (!formData.name.trim()) {
      setSaveError('Please enter an asset name');
      return;
    }
    if (!formData.purchaseCost || parseFloat(formData.purchaseCost) <= 0) {
      setSaveError('Please enter a valid purchase cost');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formData.name,
      description: formData.description || formData.name,
      assetTag: formData.assetTag || undefined,
      purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : undefined,
      purchaseCost: parseFloat(formData.purchaseCost),
      acquisitionCost: parseFloat(formData.purchaseCost),
      bookResidualValue: formData.salvageValue ? parseFloat(formData.salvageValue) : 0,
      bookUsefulLifeMonths: formData.usefulLife ? parseInt(formData.usefulLife) : undefined,
      bookDepreciationMethod: formData.depreciationMethod,
      location: formData.location || undefined,
      serialNumber: formData.serialNumber || undefined,
      vendor: formData.vendor || undefined,
    };

    // If an API category was selected, include categoryId
    if (formData.categoryId && !formData.categoryId.startsWith('fallback-')) {
      payload.categoryId = formData.categoryId;
    }

    try {
      if (editingAsset) {
        await updateAsset.mutateAsync({ id: editingAsset.id, data: payload });
      } else {
        payload.status = 'ACTIVE';
        await createAsset.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save asset';
      setSaveError(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to dispose of this asset?')) {
      try {
        await deleteAsset.mutateAsync(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete asset';
        alert(message);
      }
    }
  };

  const handleRunDepreciation = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    try {
      const result = await runDepreciation.mutateAsync({
        fiscalYear: year,
        periodNumber: month,
        periodStartDate: periodStart.toISOString(),
        periodEndDate: periodEnd.toISOString(),
      });
      alert(`Depreciation calculated for ${result.summary.assetsProcessed} assets.\nBook: ${fc(result.summary.totalBookDepreciation)}\nTax: ${fc(result.summary.totalTaxAllowance)}`);
      setShowDepreciationModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run depreciation';
      alert(message);
    }
  };

  // Stats
  const totalCost = fixedAssets.reduce((sum, a) => sum + (a.purchaseCost ?? a.acquisitionCost ?? 0), 0);
  const totalBookValue = fixedAssets.reduce((sum, a) => sum + (a.bookNetBookValue ?? 0), 0);
  const totalDepreciation = fixedAssets.reduce((sum, a) => sum + (a.bookAccumulatedDepreciation ?? 0), 0);

  // Capital Allowance stats
  const totalTaxWDV = fixedAssets.reduce((sum, a) => sum + (a.taxWrittenDownValue ?? 0), 0);
  const totalInitialAllowanceClaimed = fixedAssets.reduce((sum, a) => sum + (a.taxInitialAllowanceClaimed ?? 0), 0);
  const totalAccumulatedAllowances = fixedAssets.reduce((sum, a) => sum + (a.taxAccumulatedAllowances ?? 0), 0);

  // Group assets by capital allowance class
  const allowanceClassSummary = JAMAICA_CAPITAL_ALLOWANCE_CLASSES.map(cls => {
    const classAssets = fixedAssets.filter(a => a.taxCapitalAllowanceClass === cls.class);
    return {
      ...cls,
      assetCount: classAssets.length,
      totalCost: classAssets.reduce((sum, a) => sum + (a.purchaseCost ?? a.acquisitionCost ?? 0), 0),
      totalWDV: classAssets.reduce((sum, a) => sum + (a.taxWrittenDownValue ?? 0), 0),
      totalClaimed: classAssets.reduce((sum, a) => sum + (a.taxAccumulatedAllowances ?? 0), 0),
    };
  }).filter(cls => cls.assetCount > 0);

  const activeAssetCount = fixedAssets.filter(a => a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
          <p className="text-gray-500">Track and depreciate capital assets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<CalculatorIcon className="w-4 h-4" />} onClick={() => setShowDepreciationModal(true)}>
            Run Depreciation
          </Button>
          <Button icon={<PlusIcon className="w-4 h-4" />} onClick={() => handleOpenModal()}>
            Add Asset
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assets'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Asset Register
          </button>
          <button
            onClick={() => setActiveTab('allowances')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'allowances'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Capital Allowances (Tax)
          </button>
        </nav>
      </div>

      {/* Error State */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">Failed to load fixed assets. {fetchError instanceof Error ? fetchError.message : ''}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {activeTab === 'assets' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Assets</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? '-' : fixedAssets.length}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-2xl font-bold text-blue-600">{isLoading ? '-' : fc(totalCost)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Book Value</p>
                <p className="text-2xl font-bold text-emerald-600">{isLoading ? '-' : fc(totalBookValue)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Depreciation</p>
                <p className="text-2xl font-bold text-orange-600">{isLoading ? '-' : fc(totalDepreciation)}</p>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'allowances' && (
        <>
          {/* Capital Allowance Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Cost (Tax Base)</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading ? '-' : fc(totalCost)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Written Down Value</p>
                <p className="text-2xl font-bold text-blue-600">{isLoading ? '-' : fc(totalTaxWDV)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Initial Allowances</p>
                <p className="text-2xl font-bold text-emerald-600">{isLoading ? '-' : fc(totalInitialAllowanceClaimed)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-sm text-gray-500">Total Claimed</p>
                <p className="text-2xl font-bold text-orange-600">{isLoading ? '-' : fc(totalAccumulatedAllowances)}</p>
              </div>
            </Card>
          </div>

          {/* Jamaica Capital Allowance Reference */}
          <Card>
            <CardHeader>
              <CardTitle>Jamaica Capital Allowance Classes (Income Tax Act)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                      <th className="px-4 py-3 font-medium">Class</th>
                      <th className="px-4 py-3 font-medium">Asset Type</th>
                      <th className="px-4 py-3 font-medium text-right">Initial Allowance</th>
                      <th className="px-4 py-3 font-medium text-right">Annual Allowance</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {JAMAICA_CAPITAL_ALLOWANCE_CLASSES.map((cls) => (
                      <tr key={cls.class} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-emerald-600">{cls.class}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{cls.name}</td>
                        <td className="px-4 py-3 text-right">{(cls.initialAllowance * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-right">{(cls.annualAllowance * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-gray-500">{cls.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Capital Allowance Summary by Class */}
          {allowanceClassSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Capital Allowance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 bg-gray-50">
                        <th className="px-4 py-3 font-medium">Class</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium text-right">Assets</th>
                        <th className="px-4 py-3 font-medium text-right">Total Cost</th>
                        <th className="px-4 py-3 font-medium text-right">Written Down Value</th>
                        <th className="px-4 py-3 font-medium text-right">Claimed to Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allowanceClassSummary.map((cls) => (
                        <tr key={cls.class} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-emerald-600">{cls.class}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{cls.name}</td>
                          <td className="px-4 py-3 text-right">{cls.assetCount}</td>
                          <td className="px-4 py-3 text-right">{fc(cls.totalCost)}</td>
                          <td className="px-4 py-3 text-right font-medium text-blue-600">{fc(cls.totalWDV)}</td>
                          <td className="px-4 py-3 text-right font-medium text-orange-600">{fc(cls.totalClaimed)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 font-semibold">Total</td>
                        <td className="px-4 py-3 text-right font-semibold">{allowanceClassSummary.reduce((sum, c) => sum + c.assetCount, 0)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fc(allowanceClassSummary.reduce((sum, c) => sum + c.totalCost, 0))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">{fc(allowanceClassSummary.reduce((sum, c) => sum + c.totalWDV, 0))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600">{fc(allowanceClassSummary.reduce((sum, c) => sum + c.totalClaimed, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent>
              <div className="flex gap-3">
                <CalculatorIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900">Understanding Capital Allowances</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Capital Allowances are tax deductions for business assets under Jamaica Income Tax Act.
                    They differ from book depreciation (used for financial statements).
                    Initial allowances are claimed in the year of purchase, while annual allowances are claimed each subsequent year on the reducing Written Down Value (WDV).
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>Note:</strong> Motor vehicles have a cost cap of J$5,000,000 for capital allowance purposes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'assets' && (
        <>
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search assets..."
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
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="disposed">Disposed</option>
            <option value="idle">Idle</option>
            <option value="under_maintenance">Under Maintenance</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
            <p className="text-gray-500">Loading assets...</p>
          </div>
        </Card>
      )}

      {/* Table */}
      {!isLoading && (
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Depreciation</TableHead>
              <TableHead>Book Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  <p className="mb-4">No fixed assets found</p>
                  <Button onClick={() => handleOpenModal()}>Add your first asset</Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => {
                const catName = asset.categoryName || asset.category?.name || '';
                const CategoryIcon = getCategoryIcon(catName);
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <CategoryIcon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{asset.name || asset.description}</p>
                          <p className="text-sm text-gray-500">{asset.assetNumber || asset.assetTag}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{catName || '-'}</TableCell>
                    <TableCell className="text-gray-500">
                      {asset.purchaseDate ? formatDate(new Date(asset.purchaseDate)) : asset.acquisitionDate ? formatDate(new Date(asset.acquisitionDate)) : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{fc(asset.purchaseCost ?? asset.acquisitionCost ?? 0)}</TableCell>
                    <TableCell className="text-orange-600">
                      {fc(asset.bookAccumulatedDepreciation ?? 0)}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600">
                      {fc(asset.bookNetBookValue ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(asset.status)}>
                        {getStatusDisplay(asset.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(asset)}>
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(asset.id)}
                          disabled={deleteAsset.isPending}
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </Button>
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
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAsset ? 'Edit Asset' : 'Add Asset'}
        size="lg"
      >
        <ModalBody>
          <div className="space-y-4">
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                {saveError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Asset Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Delivery Van"
              />
              <Input
                label="Asset Tag"
                value={formData.assetTag}
                onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                placeholder="Optional identifier"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => {
                    const cat = categoryOptions.find(c => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      categoryId: e.target.value,
                      categoryName: cat?.name || '',
                      usefulLife: cat?.usefulLife?.toString() || '',
                      depreciationMethod: cat?.depreciationMethod || 'STRAIGHT_LINE',
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Purchase Date *"
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Purchase Cost *"
                type="number"
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Salvage Value"
                type="number"
                value={formData.salvageValue}
                onChange={(e) => setFormData({ ...formData, salvageValue: e.target.value })}
                placeholder="0.00"
              />
              <Input
                label="Useful Life (months)"
                type="number"
                value={formData.usefulLife}
                onChange={(e) => setFormData({ ...formData, usefulLife: e.target.value })}
                placeholder="60"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                <select
                  value={formData.depreciationMethod}
                  onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {DEPRECIATION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Warehouse"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Serial Number"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
              <Input
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createAsset.isPending || updateAsset.isPending}
          >
            {(createAsset.isPending || updateAsset.isPending) ? 'Saving...' : editingAsset ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Depreciation Modal */}
      <Modal
        isOpen={showDepreciationModal}
        onClose={() => setShowDepreciationModal(false)}
        title="Run Depreciation"
      >
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-600">
              This will calculate and record depreciation for all active assets based on their depreciation method and useful life
              for the current month.
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>{activeAssetCount}</strong> active assets will be processed
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Period: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDepreciationModal(false)}>Cancel</Button>
          <Button onClick={handleRunDepreciation} disabled={runDepreciation.isPending}>
            <CalculatorIcon className="w-4 h-4 mr-1" />
            {runDepreciation.isPending ? 'Calculating...' : 'Calculate Depreciation'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
