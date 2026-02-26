'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea } from '@/components/ui';
import {
  usePosSettings,
  useUpdatePosSettings,
  type ApiPosSettings,
} from '@/hooks/api/usePos';
import { generateReceiptHTML } from '@/lib/pos-receipt';
import type { ReceiptData } from '@/lib/pos-receipt';
import {
  ArrowLeftIcon,
  PrinterIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  SignalIcon,
  SignalSlashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// ── Toggle Switch Component ────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        role="switch"
        aria-checked={checked}
        type="button"
        onClick={() => onChange(!checked)}
        className={`
          relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2
          dark:focus:ring-offset-gray-900
          ${checked ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-600'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
          {label}
        </span>
        {description && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
        )}
      </div>
    </label>
  );
}

// ── Sample receipt data for live preview ────────────────────────────

function buildSampleReceiptData(settings: Record<string, any>): ReceiptData {
  return {
    businessName: settings.receiptHeader || settings.businessName || 'Sample Business',
    businessAddress: settings.businessAddress || '123 Main Street, Kingston',
    businessPhone: settings.businessPhone || '876-555-0123',
    businessTRN: settings.receiptShowTrn ? (settings.businessTRN || '123-456-789') : undefined,
    gctRegistrationNumber: settings.receiptShowGctNumber
      ? (settings.gctRegistrationNumber || 'GCT-001234567')
      : undefined,
    logoUrl: settings.businessLogo,
    showLogo: settings.receiptShowLogo ?? true,
    orderNumber: 'POS-0001',
    date: new Date(),
    customerName: 'Walk-in',
    terminalName: 'Terminal 1',
    cashierName: settings.receiptShowCashierName ? 'Jane Smith' : undefined,
    items: [
      {
        name: '2x4 Lumber 8ft',
        quantity: 5,
        unitPrice: 850,
        lineTotal: 4250,
        discountAmount: settings.receiptShowDiscountDetails ? 250 : 0,
      },
      {
        name: 'PVC Pipe 1/2" 20ft',
        quantity: 3,
        unitPrice: 1200,
        lineTotal: 3600,
        isGctExempt: true,
      },
      {
        name: 'Portland Cement 42.5kg',
        quantity: 10,
        unitPrice: 2100,
        lineTotal: 21000,
      },
    ],
    subtotal: 28850,
    discountAmount: settings.receiptShowDiscountDetails ? 250 : 0,
    discountLabel: settings.receiptShowDiscountDetails ? 'Line Discount' : undefined,
    taxableAmount: 25250,
    exemptAmount: 3600,
    gctRate: 0.15,
    gctAmount: 3787.5,
    total: 32387.5,
    payments: settings.receiptShowPaymentMethod
      ? [
          { method: 'CASH', amount: 35000, amountTendered: 35000, changeGiven: 2612.5 },
        ]
      : [],
    changeGiven: 2612.5,
    receiptFooter: settings.receiptFooter || 'Thank you for your business!',
    paperWidth: settings.printerPaperWidth || 80,
    showBarcode: settings.receiptShowBarcode ?? false,
  };
}

// ── Main Page Component ────────────────────────────────────────────

export default function ReceiptPrinterSettingsPage() {
  // ---- API hooks ----
  const { data: settingsData, isLoading, error: settingsError, refetch } = usePosSettings();
  const updateSettingsMutation = useUpdatePosSettings();

  // ---- Local form state ----
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize local state from API data
  useEffect(() => {
    if (settingsData) {
      setLocalSettings({
        // Business info (for preview)
        businessName: settingsData.businessName,
        businessAddress: settingsData.businessAddress ?? '',
        businessPhone: settingsData.businessPhone ?? '',
        businessTRN: settingsData.businessTRN ?? '',
        businessLogo: settingsData.businessLogo ?? '',
        gctRegistrationNumber: settingsData.gctRegistrationNumber ?? '',

        // Printer config
        printerPaperWidth: (settingsData as any).printerPaperWidth ?? 80,
        printerType: (settingsData as any).printerType ?? 'browser',
        printerName: (settingsData as any).printerName ?? '',
        printerAddress: (settingsData as any).printerAddress ?? '',

        // Receipt header
        receiptHeader: (settingsData as any).receiptHeader ?? '',
        receiptShowLogo: (settingsData as any).receiptShowLogo ?? settingsData.showLogo ?? true,
        receiptShowGctNumber: (settingsData as any).receiptShowGctNumber ?? true,
        receiptShowTrn: (settingsData as any).receiptShowTrn ?? true,

        // Receipt body
        receiptShowItemDescription: (settingsData as any).receiptShowItemDescription ?? true,
        receiptShowGctBreakdown: (settingsData as any).receiptShowGctBreakdown ?? true,
        receiptShowDiscountDetails: (settingsData as any).receiptShowDiscountDetails ?? true,
        receiptShowPaymentMethod: (settingsData as any).receiptShowPaymentMethod ?? true,
        receiptShowCashierName: (settingsData as any).receiptShowCashierName ?? true,

        // Receipt footer
        receiptFooter: settingsData.receiptFooter ?? '',
        receiptShowBarcode: (settingsData as any).receiptShowBarcode ?? false,

        // Print settings
        receiptDefaultCopies: (settingsData as any).receiptDefaultCopies ?? 1,
        receiptAskBeforePrint: (settingsData as any).receiptAskBeforePrint ?? true,
        receiptAutoPrint: (settingsData as any).receiptAutoPrint ?? false,

        // Cash drawer
        cashDrawerOpenOnPayment: (settingsData as any).cashDrawerOpenOnPayment ?? true,
        cashDrawerOpenOnSessionStart: (settingsData as any).cashDrawerOpenOnSessionStart ?? false,
        cashDrawerTriggerType: (settingsData as any).cashDrawerTriggerType ?? 'printer_trigger',
      });
    }
  }, [settingsData]);

  const updateLocal = useCallback((updates: Record<string, any>) => {
    setLocalSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Save all receipt settings
  const handleSave = async () => {
    setSaveSuccess(false);
    try {
      await updateSettingsMutation.mutateAsync({
        receiptHeader: localSettings.receiptHeader || null,
        receiptFooter: localSettings.receiptFooter || null,
        receiptShowLogo: localSettings.receiptShowLogo,
        receiptShowGctNumber: localSettings.receiptShowGctNumber,
        receiptShowTrn: localSettings.receiptShowTrn,
        receiptShowItemDescription: localSettings.receiptShowItemDescription,
        receiptShowGctBreakdown: localSettings.receiptShowGctBreakdown,
        receiptShowDiscountDetails: localSettings.receiptShowDiscountDetails,
        receiptShowPaymentMethod: localSettings.receiptShowPaymentMethod,
        receiptShowCashierName: localSettings.receiptShowCashierName,
        receiptShowBarcode: localSettings.receiptShowBarcode,
        receiptDefaultCopies: localSettings.receiptDefaultCopies,
        receiptAskBeforePrint: localSettings.receiptAskBeforePrint,
        receiptAutoPrint: localSettings.receiptAutoPrint,
        cashDrawerOpenOnPayment: localSettings.cashDrawerOpenOnPayment,
        cashDrawerOpenOnSessionStart: localSettings.cashDrawerOpenOnSessionStart,
        cashDrawerTriggerType: localSettings.cashDrawerTriggerType,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save receipt printer settings:', err);
    }
  };

  // Build live preview HTML
  const previewHtml = useMemo(() => {
    if (!Object.keys(localSettings).length) return '';
    try {
      return generateReceiptHTML(buildSampleReceiptData(localSettings));
    } catch {
      return '<p style="padding:16px;color:#999;">Preview unavailable</p>';
    }
  }, [localSettings]);

  // Printer type options
  const printerTypeOptions = [
    { value: 'browser', label: 'Browser (Print Dialog)' },
    { value: 'usb', label: 'USB Printer' },
    { value: 'bluetooth', label: 'Bluetooth Printer' },
    { value: 'network', label: 'Network Printer' },
    { value: 'none', label: 'None (Disabled)' },
  ];

  const cashDrawerTriggerOptions = [
    { value: 'printer_trigger', label: 'Printer Trigger' },
    { value: 'usb', label: 'USB' },
    { value: 'none', label: 'None' },
  ];

  const showPrinterDetails = ['usb', 'bluetooth', 'network'].includes(localSettings.printerType);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receipt Printer Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Configure receipt printing and cash drawer</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (settingsError) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receipt Printer Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Configure receipt printing and cash drawer</p>
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ExclamationCircleIcon className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">Failed to load settings</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {settingsError instanceof Error ? settingsError.message : 'Please try again.'}
              </p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PrinterIcon className="w-7 h-7 text-emerald-500" />
              Receipt Printer Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Configure receipt layout, printing, and cash drawer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? (
              <>
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save All Changes'
            )}
          </Button>
          {saveSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4" />
              Saved
            </span>
          )}
          {updateSettingsMutation.error && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {updateSettingsMutation.error instanceof Error
                ? updateSettingsMutation.error.message
                : 'Save failed'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* A. Printer Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Printer Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Paper Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paper Width
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paperWidth"
                      value={58}
                      checked={localSettings.printerPaperWidth === 58}
                      onChange={() => updateLocal({ printerPaperWidth: 58 })}
                      className="text-emerald-600 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">58mm</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paperWidth"
                      value={80}
                      checked={localSettings.printerPaperWidth === 80}
                      onChange={() => updateLocal({ printerPaperWidth: 80 })}
                      className="text-emerald-600 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">80mm (default)</span>
                  </label>
                </div>
              </div>

              {/* Printer Type */}
              <Select
                label="Printer Type"
                options={printerTypeOptions}
                value={localSettings.printerType ?? 'browser'}
                onChange={(e) => updateLocal({ printerType: e.target.value })}
              />

              {/* Connection details for USB/Bluetooth/Network */}
              {showPrinterDetails && (
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Input
                    label="Printer Name"
                    value={localSettings.printerName ?? ''}
                    onChange={(e) => updateLocal({ printerName: e.target.value })}
                    placeholder="e.g. Epson TM-T88V"
                  />
                  <Input
                    label="Printer Address"
                    value={localSettings.printerAddress ?? ''}
                    onChange={(e) => updateLocal({ printerAddress: e.target.value })}
                    placeholder={
                      localSettings.printerType === 'network'
                        ? '192.168.1.100:9100'
                        : localSettings.printerType === 'bluetooth'
                        ? 'XX:XX:XX:XX:XX:XX'
                        : '/dev/usb/lp0'
                    }
                  />
                </div>
              )}

              {/* Connection Status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {localSettings.printerType === 'browser' ? (
                  <>
                    <SignalIcon className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">- Uses browser print dialog</span>
                  </>
                ) : localSettings.printerType === 'none' ? (
                  <>
                    <SignalSlashIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Printing Disabled</span>
                  </>
                ) : (
                  <>
                    <SignalSlashIcon className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Not Connected</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">- Configure printer details above</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* B. Receipt Header */}
          <Card>
            <CardHeader>
              <CardTitle>Receipt Header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Custom Header Text"
                value={localSettings.receiptHeader ?? ''}
                onChange={(e) => updateLocal({ receiptHeader: e.target.value })}
                placeholder={localSettings.businessName || 'Company name auto-filled from store settings'}
                rows={2}
              />
              <div className="space-y-3">
                <Toggle
                  checked={localSettings.receiptShowLogo ?? true}
                  onChange={(val) => updateLocal({ receiptShowLogo: val })}
                  label="Show Company Logo on Receipt"
                  description="Display your business logo at the top of each receipt"
                />
                <Toggle
                  checked={localSettings.receiptShowGctNumber ?? true}
                  onChange={(val) => updateLocal({ receiptShowGctNumber: val })}
                  label="Show GCT Registration Number"
                  description="Required for GCT compliance on tax receipts"
                />
                <Toggle
                  checked={localSettings.receiptShowTrn ?? true}
                  onChange={(val) => updateLocal({ receiptShowTrn: val })}
                  label="Show Business TRN"
                  description="Display Tax Registration Number in header"
                />
              </div>
            </CardContent>
          </Card>

          {/* C. Receipt Body Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Receipt Body Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Toggle
                checked={localSettings.receiptShowItemDescription ?? true}
                onChange={(val) => updateLocal({ receiptShowItemDescription: val })}
                label="Show Item Descriptions"
              />
              <Toggle
                checked={localSettings.receiptShowGctBreakdown ?? true}
                onChange={(val) => updateLocal({ receiptShowGctBreakdown: val })}
                label="Show GCT Breakdown per Item"
                description="Display tax amount next to each line item"
              />
              <Toggle
                checked={localSettings.receiptShowDiscountDetails ?? true}
                onChange={(val) => updateLocal({ receiptShowDiscountDetails: val })}
                label="Show Discount Details"
                description="Display discount amounts on receipt"
              />
              <Toggle
                checked={localSettings.receiptShowPaymentMethod ?? true}
                onChange={(val) => updateLocal({ receiptShowPaymentMethod: val })}
                label="Show Payment Method"
                description="Display how the customer paid"
              />
              <Toggle
                checked={localSettings.receiptShowCashierName ?? true}
                onChange={(val) => updateLocal({ receiptShowCashierName: val })}
                label="Show Cashier Name"
                description="Display the name of the cashier on the receipt"
              />
            </CardContent>
          </Card>

          {/* D. Receipt Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Receipt Footer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Custom Footer Message"
                value={localSettings.receiptFooter ?? ''}
                onChange={(e) => updateLocal({ receiptFooter: e.target.value })}
                placeholder="Thank you for your business!"
                rows={2}
              />
              <Toggle
                checked={localSettings.receiptShowBarcode ?? false}
                onChange={(val) => updateLocal({ receiptShowBarcode: val })}
                label="Show Order Number Barcode"
                description="Print a scannable barcode of the order number at the bottom"
              />
            </CardContent>
          </Card>

          {/* E. Print Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Print Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs">
                <Input
                  label="Default Copies"
                  type="number"
                  min={1}
                  max={5}
                  value={localSettings.receiptDefaultCopies ?? 1}
                  onChange={(e) => {
                    const val = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                    updateLocal({ receiptDefaultCopies: val });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Number of copies to print (1-5)</p>
              </div>
              <Toggle
                checked={localSettings.receiptAskBeforePrint ?? true}
                onChange={(val) => updateLocal({ receiptAskBeforePrint: val })}
                label="Ask before printing"
                description="Show a confirmation dialog before printing each receipt"
              />
              <Toggle
                checked={localSettings.receiptAutoPrint ?? false}
                onChange={(val) => updateLocal({ receiptAutoPrint: val })}
                label="Auto-print on payment completion"
                description="Automatically print receipt when payment is completed"
              />
            </CardContent>
          </Card>

          {/* F. Cash Drawer */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Drawer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                checked={localSettings.cashDrawerOpenOnPayment ?? true}
                onChange={(val) => updateLocal({ cashDrawerOpenOnPayment: val })}
                label="Open cash drawer on cash payment"
                description="Automatically open the cash drawer when a cash payment is received"
              />
              <Toggle
                checked={localSettings.cashDrawerOpenOnSessionStart ?? false}
                onChange={(val) => updateLocal({ cashDrawerOpenOnSessionStart: val })}
                label="Open cash drawer on session start"
                description="Open the drawer when a new POS session begins"
              />
              <Select
                label="Trigger Type"
                options={cashDrawerTriggerOptions}
                value={localSettings.cashDrawerTriggerType ?? 'printer_trigger'}
                onChange={(e) => updateLocal({ cashDrawerTriggerType: e.target.value })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column: Live Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <EyeIcon className="w-5 h-5 text-emerald-500" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  This preview updates as you change settings. Sample data is used.
                </p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    title="Receipt Preview"
                    className="w-full border-0"
                    style={{
                      height: '600px',
                      maxWidth: localSettings.printerPaperWidth === 58 ? '240px' : '320px',
                      margin: '0 auto',
                      display: 'block',
                    }}
                    sandbox="allow-same-origin"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom save bar */}
      <Card>
        <CardFooter>
          <div className="flex items-center gap-3 w-full">
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save All Changes'
              )}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                Settings saved successfully
              </span>
            )}
            {updateSettingsMutation.error && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {updateSettingsMutation.error instanceof Error
                  ? updateSettingsMutation.error.message
                  : 'Save failed'}
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
