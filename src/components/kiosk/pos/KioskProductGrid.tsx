'use client';

import { useState, useMemo, useCallback } from 'react';
import { useKioskPosStore } from '@/store/kioskPosStore';

interface KioskProductGridProps {
  isLoading: boolean;
  onRefresh: () => void;
}

export default function KioskProductGrid({ isLoading, onRefresh }: KioskProductGridProps) {
  const { products, categories, addToCart } = useKioskPosStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Filter products ───────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory) {
      result = result.filter(
        (p) => p.categoryName?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [products, selectedCategory, searchQuery]);

  const handleProductTap = useCallback(
    (product: (typeof products)[0]) => {
      addToCart({
        productId: product.id,
        name: product.name,
        unitPrice: product.unitPrice,
        sku: product.sku ?? undefined,
        barcode: product.barcode ?? undefined,
        isGctExempt: product.isGctExempt,
      });
    },
    [addToCart]
  );

  const formatPrice = (price: number) =>
    `J$${price.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-full">
      {/* ── Search Bar ───────────────────────────────────────────── */}
      <div className="p-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 touch-manipulation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Category Filter Chips ────────────────────────────────── */}
      <div className="px-3 pb-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-min">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${
              !selectedCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-manipulation transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery ? 'No products match your search' : 'No products available'}
            </p>
            <button
              onClick={onRefresh}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
            >
              Refresh Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => product.quantity > 0 && handleProductTap(product)}
                disabled={product.quantity <= 0}
                className={`flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl touch-manipulation transition-all min-h-[100px] ${
                  product.quantity <= 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm active:scale-95'
                }`}
              >
                {product.imageUrl ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden mb-2 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2 flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white text-center line-clamp-2 leading-tight">
                  {product.name}
                </span>
                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {formatPrice(product.unitPrice)}
                </span>
                {product.quantity <= 0 && (
                  <span className="text-xs text-red-500 mt-0.5">Out of stock</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
