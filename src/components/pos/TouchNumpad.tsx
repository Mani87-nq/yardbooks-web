'use client';

import React from 'react';
import { BackspaceIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface TouchNumpadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  allowDecimal?: boolean;
  className?: string;
}

/**
 * Touch-optimized numpad for cash register operations
 * Large buttons for touch screens
 */
export function TouchNumpad({
  value,
  onChange,
  onSubmit,
  maxLength = 10,
  allowDecimal = true,
  className,
}: TouchNumpadProps) {
  const handleDigit = (digit: string) => {
    if (value.length >= maxLength) return;

    // Handle decimal
    if (digit === '.' && !allowDecimal) return;
    if (digit === '.' && value.includes('.')) return;

    // Handle leading zeros
    if (value === '0' && digit !== '.') {
      onChange(digit);
      return;
    }

    onChange(value + digit);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1) || '0');
  };

  const handleClear = () => {
    onChange('0');
  };

  const buttonClass =
    'flex items-center justify-center h-16 text-2xl font-semibold rounded-xl transition-all active:scale-95 select-none';

  return (
    <div className={cn('grid grid-cols-4 gap-2', className)}>
      {/* Row 1 */}
      <button type="button" onClick={() => handleDigit('7')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>7</button>
      <button type="button" onClick={() => handleDigit('8')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>8</button>
      <button type="button" onClick={() => handleDigit('9')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>9</button>
      <button type="button" onClick={handleBackspace} className={cn(buttonClass, 'bg-orange-100 hover:bg-orange-200 text-orange-700')}>
        <BackspaceIcon className="w-6 h-6" />
      </button>

      {/* Row 2 */}
      <button type="button" onClick={() => handleDigit('4')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>4</button>
      <button type="button" onClick={() => handleDigit('5')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>5</button>
      <button type="button" onClick={() => handleDigit('6')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>6</button>
      <button type="button" onClick={handleClear} className={cn(buttonClass, 'bg-red-100 hover:bg-red-200 text-red-700')}>C</button>

      {/* Row 3 */}
      <button type="button" onClick={() => handleDigit('1')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>1</button>
      <button type="button" onClick={() => handleDigit('2')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>2</button>
      <button type="button" onClick={() => handleDigit('3')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>3</button>
      <button type="button" onClick={onSubmit} className={cn(buttonClass, 'bg-emerald-500 hover:bg-emerald-600 text-white row-span-2')} style={{ height: '136px' }}>
        <CheckIcon className="w-8 h-8" />
      </button>

      {/* Row 4 */}
      <button type="button" onClick={() => handleDigit('0')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800 col-span-2')}>0</button>
      {allowDecimal && (
        <button type="button" onClick={() => handleDigit('.')} className={cn(buttonClass, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}>.</button>
      )}
    </div>
  );
}

interface QuickCashButtonsProps {
  amounts: number[];
  onSelect: (amount: number) => void;
  formatCurrency: (amount: number) => string;
  selectedAmount?: number;
}

/**
 * Quick cash amount buttons for common bills
 */
export function QuickCashButtons({ amounts, onSelect, formatCurrency, selectedAmount }: QuickCashButtonsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className={cn(
            'py-4 rounded-xl font-semibold text-lg transition-all active:scale-95',
            selectedAmount === amount
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          )}
        >
          {formatCurrency(amount)}
        </button>
      ))}
    </div>
  );
}
