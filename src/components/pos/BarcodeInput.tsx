'use client';

import React, { useState } from 'react';
import { QrCodeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Manual barcode input component
 * For when USB scanner isn't available or for manual entry
 */
export function BarcodeInput({ onScan, placeholder = 'Scan or enter barcode...', autoFocus = false }: BarcodeInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onScan(value.trim());
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <QrCodeIcon className="w-5 h-5 text-emerald-500" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-14 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

interface ScannerStatusProps {
  isScanning: boolean;
  lastScan: string | null;
  lastScanTime: string | null;
}

/**
 * Visual indicator for barcode scanner status
 */
export function ScannerStatus({ isScanning, lastScan }: ScannerStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`} />
      <span className="text-gray-500">
        {isScanning ? 'Scanning...' : lastScan ? `Last: ${lastScan}` : 'Scanner ready'}
      </span>
    </div>
  );
}
