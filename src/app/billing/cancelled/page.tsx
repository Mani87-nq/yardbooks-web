'use client';

import Link from 'next/link';
import { XCircleIcon } from '@heroicons/react/24/solid';

export default function BillingCancelledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <XCircleIcon className="w-10 h-10 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Cancelled
          </h1>
          
          <p className="text-gray-600 mb-6">
            No worries! Your payment was cancelled and you haven't been charged. You can try again whenever you're ready.
          </p>

          <div className="space-y-3">
            <Link
              href="/#pricing"
              className="block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              View Pricing Plans
            </Link>
            
            <Link
              href="/"
              className="block w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Back to Home
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Have questions?{' '}
            <a href="mailto:support@yaadbooks.com" className="text-emerald-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
