'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import {
  ArrowLeftIcon,
  PlusIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function POSSettingsPage() {
  const { settings, updateSettings, terminals, addTerminal } = usePosStore();
  const [newTerminalName, setNewTerminalName] = useState('');

  const handleAddTerminal = () => {
    if (!newTerminalName.trim()) return;
    addTerminal({
      name: newTerminalName,
      location: 'Main Location',
      isActive: true,
      isOnline: true,
      defaultPaymentMethods: ['cash', 'jam_dex', 'card_visa'],
      allowNegativeInventory: false,
      requireCustomer: false,
      allowDiscounts: true,
      maxDiscountPercent: 20,
      barcodeScanner: true,
    });
    setNewTerminalName('');
  };

  const paymentMethods = [
    { id: 'cash', label: 'Cash' },
    { id: 'jam_dex', label: 'JAM-DEX (CBDC)' },
    { id: 'lynk_wallet', label: 'Lynk Wallet' },
    { id: 'wipay', label: 'WiPay' },
    { id: 'card_visa', label: 'Visa' },
    { id: 'card_mastercard', label: 'Mastercard' },
    { id: 'bank_transfer', label: 'Bank Transfer' },
  ];

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
              value={settings.orderPrefix}
              onChange={(e) => updateSettings({ orderPrefix: e.target.value })}
            />
            <Input
              label="Next Order Number"
              type="number"
              value={settings.nextOrderNumber}
              onChange={(e) => updateSettings({ nextOrderNumber: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Business Name"
              value={settings.businessName}
              onChange={(e) => updateSettings({ businessName: e.target.value })}
            />
            <Input
              label="Business Phone"
              value={settings.businessPhone || ''}
              onChange={(e) => updateSettings({ businessPhone: e.target.value })}
            />
          </div>
          <Input
            label="Business Address"
            value={settings.businessAddress || ''}
            onChange={(e) => updateSettings({ businessAddress: e.target.value })}
          />
          <Input
            label="TRN (Tax Registration Number)"
            value={settings.businessTRN || ''}
            onChange={(e) => updateSettings({ businessTRN: e.target.value })}
          />
          <Input
            label="Receipt Footer Message"
            value={settings.receiptFooter || ''}
            onChange={(e) => updateSettings({ receiptFooter: e.target.value })}
            placeholder="Thank you for your business!"
          />
        </CardContent>
        <CardFooter>
          <Button>Save Changes</Button>
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
              value={settings.gctRate * 100}
              onChange={(e) => updateSettings({ gctRate: (parseFloat(e.target.value) || 15) / 100 })}
            />
            <Input
              label="GCT Registration Number"
              value={settings.gctRegistrationNumber || ''}
              onChange={(e) => updateSettings({ gctRegistrationNumber: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="taxIncluded"
              checked={settings.taxIncludedInPrice}
              onChange={(e) => updateSettings({ taxIncludedInPrice: e.target.checked })}
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
                  checked={settings.enabledPaymentMethods?.includes(method.id as any) ?? true}
                  onChange={(e) => {
                    const current = settings.enabledPaymentMethods || paymentMethods.map(m => m.id);
                    const updated = e.target.checked
                      ? [...current, method.id]
                      : current.filter(m => m !== method.id);
                    updateSettings({ enabledPaymentMethods: updated as any });
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
          {terminals.length === 0 ? (
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
            <Button onClick={handleAddTerminal} disabled={!newTerminalName.trim()}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Terminal
            </Button>
          </div>
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
                checked={settings[option.key as keyof typeof settings] as boolean}
                onChange={(e) => updateSettings({ [option.key]: e.target.checked })}
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
