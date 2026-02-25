'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { searchProducts, type SearchableProduct, type SearchResult } from '@/lib/productSearch';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface SmartSearchProps<T extends SearchableProduct = SearchableProduct> {
  products: T[];
  onSelectProduct: (product: T) => void;
  placeholder?: string;
  className?: string;
  recentProductIds?: string[];
}

/**
 * Smart Product Search Component
 *
 * Features:
 * - Auto-complete as you type
 * - Fuzzy matching (typo tolerant)
 * - Barcode/SKU instant lookup
 * - Recent products
 * - Keyboard navigation
 * - Touch-friendly
 */
export function SmartSearch<T extends SearchableProduct>({
  products,
  onSelectProduct,
  placeholder = 'Search by name, SKU, or scan barcode...',
  className,
  recentProductIds = [],
}: SmartSearchProps<T>) {
  const { fc } = useCurrency();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent products when no query
      if (recentProductIds.length > 0) {
        return recentProductIds
          .map((id) => products.find((p) => p.id === id))
          .filter(Boolean)
          .slice(0, 5)
          .map((product) => ({
            product: product as SearchableProduct,
            matchType: 'partial' as const,
            score: 0.5,
          }));
      }
      return [];
    }
    return searchProducts(products, query, { limit: 8 });
  }, [query, products, recentProductIds]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].product);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle product selection
  const handleSelect = (product: SearchableProduct) => {
    onSelectProduct(product as T);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Get match type badge
  const getMatchBadge = (matchType: SearchResult['matchType']) => {
    switch (matchType) {
      case 'barcode':
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Barcode</span>;
      case 'sku':
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">SKU</span>;
      case 'exact':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Exact</span>;
      default:
        return null;
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 300)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-12 px-2 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <QrCodeIcon className="h-6 w-6 text-emerald-500" />
        </div>
      </div>

      {/* Search hint */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">&#8593;&#8595;</kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> select
        </span>
        <span className="flex items-center gap-1">
          <QrCodeIcon className="h-3 w-3" /> scan barcode
        </span>
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-96 overflow-y-auto"
        >
          {!query && recentProductIds.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <ClockIcon className="h-3 w-3" /> Recent Products
              </span>
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={result.product.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(result.product);
              }}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-3 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-emerald-50 border-l-4 border-emerald-500'
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              )}
            >
              {/* Product Icon/Thumbnail */}
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📦</span>
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">{result.product.name}</span>
                  {getMatchBadge(result.matchType)}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>SKU: {result.product.sku}</span>
                  <span>&#183;</span>
                  <span className={cn(result.product.quantity <= 5 ? 'text-red-600 font-medium' : '')}>
                    {result.product.quantity} in stock
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-emerald-600">{fc(typeof result.product.unitPrice === 'number' && !isNaN(result.product.unitPrice) ? result.product.unitPrice : 0)}</div>
                {result.product.category && <div className="text-xs text-gray-400">{result.product.category}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-8 z-50 text-center">
          <div className="text-gray-400 mb-2">
            <MagnifyingGlassIcon className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-gray-600 font-medium">No products found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search term or check the spelling</p>
        </div>
      )}
    </div>
  );
}
