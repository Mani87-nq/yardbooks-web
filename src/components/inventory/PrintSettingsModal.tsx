'use client';

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui';
import { PrinterIcon, TagIcon, DocumentIcon } from '@heroicons/react/24/outline';
import type { LabelProduct, LabelPrintSettings } from '@/lib/barcode';
import { getDefaultLabelPrintSettings, LETTER_GRID } from '@/lib/barcode';

interface PrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (settings: LabelPrintSettings) => void;
  /** For single product print */
  product?: LabelProduct;
  /** For bulk print (multiple products) */
  products?: LabelProduct[];
}

export function PrintSettingsModal({
  isOpen,
  onClose,
  onPrint,
  product,
  products,
}: PrintSettingsModalProps) {
  const [settings, setSettings] = useState<LabelPrintSettings>(getDefaultLabelPrintSettings());

  const isBulk = !!products && products.length > 0;
  const itemCount = isBulk ? products!.length : 1;
  const displayTitle = isBulk
    ? `Print Labels (${itemCount} product${itemCount !== 1 ? 's' : ''})`
    : 'Print Barcode Label';

  // Calculate totals for info display
  const totalLabels = itemCount * settings.copies;
  const pagesNeeded = settings.printerMode === 'letter'
    ? Math.ceil(totalLabels / LETTER_GRID.labelsPerPage)
    : totalLabels;

  const handlePrint = () => {
    onPrint(settings);
    onClose();
    // Reset to defaults for next open
    setSettings(getDefaultLabelPrintSettings());
  };

  const handleClose = () => {
    onClose();
    setSettings(getDefaultLabelPrintSettings());
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={displayTitle} size="sm">
      <ModalBody>
        <div className="space-y-5">
          {/* ── Quantity ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {isBulk ? 'Copies per Product' : 'Number of Labels'}
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={settings.copies}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                copies: Math.max(1, Math.min(500, parseInt(e.target.value) || 1))
              }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total: {totalLabels} label{totalLabels !== 1 ? 's' : ''}
              {settings.printerMode === 'letter' && totalLabels > 0
                ? ` across ${pagesNeeded} page${pagesNeeded !== 1 ? 's' : ''}`
                : ''}
            </p>
          </div>

          {/* ── Printer Type ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Printer Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, printerMode: 'label' }))}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  settings.printerMode === 'label'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <TagIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 mb-1" />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Label Printer</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Continuous roll</div>
              </button>

              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, printerMode: 'letter' }))}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  settings.printerMode === 'letter'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <DocumentIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 mb-1" />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Regular Paper</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">8.5&quot; &times; 11&quot; sheet</div>
              </button>
            </div>
          </div>

          {/* ── Content Toggles ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label Content
            </label>
            <div className="space-y-3">
              {/* Product Name Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Product Name</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showProductName}
                    onChange={(e) => setSettings(prev => ({ ...prev, showProductName: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* Price Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Price</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPrice}
                    onChange={(e) => setSettings(prev => ({ ...prev, showPrice: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600" />
                </label>
              </div>
            </div>
          </div>

          {/* ── Preview Summary ── */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Summary
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {totalLabels} label{totalLabels !== 1 ? 's' : ''}
              {isBulk && ` (${settings.copies} each for ${itemCount} product${itemCount !== 1 ? 's' : ''})`}
              {' '}&mdash;{' '}
              {settings.printerMode === 'label'
                ? 'continuous roll'
                : `${pagesNeeded} sheet${pagesNeeded !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shows: barcode
              {settings.showProductName ? ' + name' : ''}
              {settings.showPrice ? ' + price' : ''}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handlePrint} icon={<PrinterIcon className="w-4 h-4" />}>
          Print
        </Button>
      </ModalFooter>
    </Modal>
  );
}
