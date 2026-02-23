'use client';

import React, { useEffect, useState } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';

export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Check for queued mutations
    if ('caches' in window) {
      caches.open('yaadbooks-queue').then((cache) => {
        cache.match('/queue').then((response) => {
          if (response) {
            response.json().then((queue: unknown[]) => {
              setPendingCount(queue.length);
            });
          }
        });
      });
    }

    // Auto-reload when back online
    const handleOnline = () => window.location.replace('/dashboard');
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold text-3xl mb-6">
          YB
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium mb-6">
          <WifiIcon className="h-4 w-4" />
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          Offline
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          You&apos;re offline
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Don&apos;t worry — any changes you made while offline have been saved
          and will sync automatically when you reconnect.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Try Again
        </button>

        {pendingCount > 0 && (
          <div className="mt-6 p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-600">
            <strong className="text-gray-900">Pending changes:</strong>{' '}
            {pendingCount} action{pendingCount !== 1 ? 's' : ''} waiting to sync
          </div>
        )}
      </div>
    </div>
  );
}
