'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select } from '@/components/ui';
import {
  usePosSettings,
  useUpdatePosSettings,
  usePosTerminals,
  useCreatePosTerminal,
  type ApiPosSettings,
} from '@/hooks/api/usePos';
import {
  ArrowLeftIcon,
  PlusIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function POSSettingsPage() {
  // ---- API hooks ----
  const { data: settingsData, isLoading: settingsLoading, error: settingsError, refetch: refetchSettings } = usePosSettings();
  const updateSettingsMutation = useUpdatePosSettings();
  const { data: terminalsData, isLoading: terminalsLoading } = usePosTerminals({ limit: 50 });
  const createTerminalMutation = useCreatePosTerminal();

  const terminals = terminalsData?.data ?? [];

  // ---- Local form state (initialized from API data) ----
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [newTerminalName, setNewTerminalName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize local state from API data once loaded
  useEffect(() => {
    if (settingsData) {
      setLocalSettings({
        orderPrefix: settingsData.orderPrefix,
        nextOrderNumber: settingsData.nextOrderNumber,
        businessName: settingsData.businessName,
        businessPhone: settingsData.businessPhone ?? '',
        businessAddress: settingsData.businessAddress ?? '',
        businessTRN: settingsData.businessTRN ?? '',
        receiptFooter: settingsData.receiptFooter ?? '',
        gctRate: Number(settingsData.gctRate),
        gctRegistrationNumber: settingsData.gctRegistrationNumber ?? '',
        taxIncludedInPrice: settingsData.taxIncludedInPrice,
        showLogo: settingsData.showLogo,
        requireOpenSession: settingsData.requireOpenSession,
        allowOfflineSales: settingsData.allowOfflineSales,
        autoDeductInventory: settingsData.autoDeductInventory,
        autoPostToGL: settingsData.autoPostToGL,
        defaultToWalkIn: settingsData.defaultToWalkIn,
        enabledPaymentMethods: settingsData.enabledPaymentMethods ?? ['CASH'],
      });
    }
  }, [settingsData]);

  const updateLocal = useCallback((updates: Record<string, any>) => {
    setLocalSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Save settings to API
  const handleSaveSettings = async () => {
    setSaveSuccess(false);
    try {
      await updateSettingsMutation.mutateAsync({
        orderPrefix: localSettings.orderPrefix,
        nextOrderNumber: localSettings.nextOrderNumber,
        businessName: localSettings.businessName,
        businessPhone: localSettings.businessPhone || null,
        businessAddress: localSettings.businessAddress || null,
        businessTRN: localSettings.businessTRN || null,
        receiptFooter: localSettings.receiptFooter || null,
        gctRate: localSettings.gctRate,
        gctRegistrationNumber: localSettings.gctRegistrationNumber || null,
        taxIncludedInPrice: localSettings.taxIncludedInPrice,
        showLogo: localSettings.showLogo,
        requireOpenSession: localSettings.requireOpenSession,
        allowOfflineSales: localSettings.allowOfflineSales,
        autoDeductInventory: localSettings.autoDeductInventory,
        autoPostToGL: localSettings.autoPostToGL,
        defaultToWalkIn: localSettings.defaultToWalkIn,
        enabledPaymentMethods: localSettings.enabledPaymentMethods,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleAddTerminal = async () => {
    if (!newTerminalName.trim()) return;
    try {
      await createTerminalMutation.mutateAsync({
        name: newTerminalName,
        location: 'Main Location',
        isActive: true,
        defaultPaymentMethods: ['CASH', 'JAM_DEX', 'CARD_VISA'],
        allowNegativeInventory: false,
        requireCustomer: false,
        allowDiscounts: true,
        maxDiscountPercent: 20,
        barcodeScanner: true,
      });
      setNewTerminalName('');
    } catch (err) {
      console.error('Failed to create terminal:', err);
    }
  };

  const paymentMethods = [
    { id: 'CASH', label: 'Cash' },
    { id: 'JAM_DEX', label: 'JAM-DEX (CBDC)' },
    { id: 'LYNK_WALLET', label: 'Lynk Wallet' },
    { id: 'WIPAY', label: 'WiPay' },
    { id: 'CARD_VISA', label: 'Visa' },
    { id: 'CARD_MASTERCARD', label: 'Mastercard' },
    { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ];

  if (settingsLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Settings</h1>
            <p className="text-gray-500">Configure your point of sale system</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS Settings</h1>
            <p className="text-gray-500">Configure your point of sale system</p>
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 font-medium mb-2">Failed to load settings</p>
              <p className="text-gray-500 text-sm mb-4">
                {settingsError instanceof Error ? settingsError.message : 'Please try again.'}
              </p>
              <Button onClick={() => refetchSettings()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pos">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to POS
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Settings</h1>
          <p className="text-gray-500">Configure your point of sale system</p>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order Prefix"
              value={localSettings.orderPrefix ?? ''}
              onChange={(e) => updateLocal({ orderPrefix: e.target.value })}
            />
            <Input
              label="Next Order Number"
              type="number"
              value={localSettings.nextOrderNumber ?? 1}
              onChange={(e) => updateLocal({ nextOrderNumber: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Business Name"
              value={localSettings.businessName ?? ''}
              onChange={(e) => updateLocal({ businessName: e.target.value })}
            />
            <Input
              label="Business Phone"
              value={localSettings.businessPhone ?? ''}
              onChange={(e) => updateLocal({ businessPhone: e.target.value })}
            />
          </div>
          <Input
            label="Business Address"
            value={localSettings.businessAddress ?? ''}
            onChange={(e) => updateLocal({ businessAddress: e.target.value })}
          />
          <Input
            label="TRN (Tax Registration Number)"
            value={localSettings.businessTRN ?? ''}
            onChange={(e) => updateLocal({ businessTRN: e.target.value })}
          />
          <Input
            label="Receipt Footer Message"
            value={localSettings.receiptFooter ?? ''}
            onChange={(e) => updateLocal({ receiptFooter: e.target.value })}
            placeholder="Thank you for your business!"
          />
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                Saved
              </span>
            )}
            {updateSettingsMutation.error && (
              <span className="text-sm text-red-600">
                {updateSettingsMutation.error instanceof Error
                  ? updateSettingsMutation.error.message
                  : 'Save failed'}
              </span>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Settings (GCT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="GCT Rate (%)"
              type="number"
              value={(localSettings.gctRate ?? 0.15) * 100}
              onChange={(e) => updateLocal({ gctRate: (parseFloat(e.target.value) || 15) / 100 })}
            />
            <Input
              label="GCT Registration Number"
              value={localSettings.gctRegistrationNumber ?? ''}
              onChange={(e) => updateLocal({ gctRegistrationNumber: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="taxIncluded"
              checked={localSettings.taxIncludedInPrice ?? false}
              onChange={(e) => updateLocal({ taxIncludedInPrice: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="taxIncluded" className="text-sm text-gray-700">
              Prices include GCT
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  checked={(localSettings.enabledPaymentMethods ?? []).includes(method.id)}
                  onChange={(e) => {
                    const current = localSettings.enabledPaymentMethods || ['CASH'];
                    const updated = e.target.checked
                      ? [...current, method.id]
                      : current.filter((m: string) => m !== method.id);
                    updateLocal({ enabledPaymentMethods: updated });
                  }}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-gray-700">{method.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Terminals */}
      <Card>
        <CardHeader>
          <CardTitle>POS Terminals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {terminalsLoading ? (
            <div className="flex items-center justify-center py-4">
              <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : terminals.length === 0 ? (
            <p className="text-gray-500 text-sm">No terminals configured yet.</p>
          ) : (
            <div className="space-y-3">
              {terminals.map((terminal) => (
                <div
                  key={terminal.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ComputerDesktopIcon className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{terminal.name}</p>
                      <p className="text-sm text-gray-500">{terminal.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {terminal.isActive && terminal.isOnline ? (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircleIcon className="w-4 h-4" />
                        Online
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Offline</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Input
              placeholder="Terminal name"
              value={newTerminalName}
              onChange={(e) => setNewTerminalName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAddTerminal}
              disabled={!newTerminalName.trim() || createTerminalMutation.isPending}
            >
              {createTerminalMutation.isPending ? (
                <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <PlusIcon className="w-4 h-4 mr-1" />
              )}
              Add Terminal
            </Button>
          </div>
          {createTerminalMutation.error && (
            <p className="text-sm text-red-600">
              {createTerminalMutation.error instanceof Error
                ? createTerminalMutation.error.message
                : 'Failed to add terminal'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'requireOpenSession', label: 'Require open session to sell' },
            { key: 'allowOfflineSales', label: 'Allow offline sales' },
            { key: 'autoDeductInventory', label: 'Auto-deduct inventory on sale' },
            { key: 'autoPostToGL', label: 'Auto-post to General Ledger' },
            { key: 'defaultToWalkIn', label: 'Default to walk-in customer' },
            { key: 'showLogo', label: 'Show logo on receipts' },
          ].map((option) => (
            <label key={option.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings[option.key] ?? false}
                onChange={(e) => updateLocal({ [option.key]: e.target.checked })}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
