'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import {
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface OrderRecoveryBannerProps {
  onDismiss: () => void;
}

export function OrderRecoveryBanner({ onDismiss }: OrderRecoveryBannerProps) {
  const currentCart = usePosStore((state) => state.currentCart);
  const clearCart = usePosStore((state) => state.clearCart);

  const itemCount = currentCart.items.length;

  // Don't render if there are no items
  if (itemCount === 0) {
    return null;
  }

  const handleContinue = () => {
    // Just dismiss the banner, keeping the cart as is
    onDismiss();
  };

  const handleClearAndStartFresh = () => {
    // Clear the cart and dismiss the banner
    clearCart();
    onDismiss();
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-900">
              Welcome back! You have an unfinished order with {itemCount} item{itemCount !== 1 ? 's' : ''}.
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Continue where you left off?
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-3 mt-4 ml-9">
        <Button
          variant="primary"
          size="sm"
          onClick={handleContinue}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Continue
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAndStartFresh}
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          <ArrowPathIcon className="w-4 h-4 mr-1" />
          Clear &amp; Start Fresh
        </Button>
      </div>
    </div>
  );
}
