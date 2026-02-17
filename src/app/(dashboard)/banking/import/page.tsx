'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/appStore';

const SUPPORTED_FORMATS = [
  { extension: 'CSV', description: 'Comma-separated values' },
  { extension: 'OFX', description: 'Open Financial Exchange' },
  { extension: 'QFX', description: 'Quicken Financial Exchange' },
];

const SUPPORTED_BANKS = [
  'NCB Jamaica',
  'Scotiabank Jamaica',
  'CIBC First Caribbean',
  'JN Bank',
  'Sagicor Bank',
  'JMMB Bank',
  'Bank of Nova Scotia',
];

export default function ImportTransactionsPage() {
  const bankAccounts = useAppStore((state) => state.bankAccounts);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    imported?: number;
    duplicates?: number;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAccount) {
      alert('Please select an account and file');
      return;
    }

    setIsUploading(true);

    // Simulate import process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setUploadResult({
      success: true,
      message: 'Transactions imported successfully',
      imported: 25,
      duplicates: 3,
    });

    setIsUploading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/banking" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Transactions</h1>
          <p className="text-gray-500">Upload bank statements to import transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Select Account</h2>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Choose a bank account...</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} - {account.bankName} (****{account.accountNumber.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Upload File</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-500 transition-colors">
              <input
                type="file"
                accept=".csv,.ofx,.qfx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {selectedFile ? (
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-gray-900">Drop your file here or click to browse</p>
                    <p className="text-sm text-gray-500 mt-1">Supports CSV, OFX, and QFX formats</p>
                  </>
                )}
              </label>
            </div>

            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={isUploading || !selectedAccount}
                className="w-full mt-4 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {isUploading ? 'Importing...' : 'Import Transactions'}
              </button>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {uploadResult.success ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  ) : (
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {uploadResult.message}
                  </span>
                </div>
                {uploadResult.success && (
                  <div className="text-sm text-green-700">
                    <p>{uploadResult.imported} transactions imported</p>
                    {uploadResult.duplicates && uploadResult.duplicates > 0 && (
                      <p>{uploadResult.duplicates} duplicates skipped</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supported Formats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Supported Formats</h2>
            <div className="space-y-3">
              {SUPPORTED_FORMATS.map((format) => (
                <div key={format.extension} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">.{format.extension}</p>
                    <p className="text-sm text-gray-500">{format.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supported Banks */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Supported Banks</h2>
            <ul className="space-y-2">
              {SUPPORTED_BANKS.map((bank) => (
                <li key={bank} className="flex items-center gap-2 text-gray-700">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  {bank}
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h2 className="font-semibold text-blue-900 mb-3">Tips</h2>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Download statements from your bank's online portal</li>
              <li>• OFX/QFX formats preserve more transaction details</li>
              <li>• Duplicate transactions are automatically detected</li>
              <li>• Review imported transactions before reconciling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
