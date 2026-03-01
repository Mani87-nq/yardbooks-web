'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { useProducts } from '@/hooks/api/useProducts';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { DEFAULT_GRID_SETTINGS, SHORTCUT_COLOR_PRESETS, SHORTCUT_ICON_PRESETS, type ProductShortcut } from '@/types/pos';
import {
  ChevronLeftIcon,
  Squares2X2Icon,
  EyeIcon,
  SwatchIcon,
  XMarkIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

// Color palette component
function ColorPalette({
  selectedColor,
  onSelect,
  size = 'normal',
}: {
  selectedColor?: string;
  onSelect: (color: string) => void;
  size?: 'small' | 'normal';
}) {
  const colors = Object.entries(SHORTCUT_COLOR_PRESETS);
  const sizeClass = size === 'small' ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(([name, hex]) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={cn(
            sizeClass,
            'rounded-full border-2 transition-all hover:scale-110',
            selectedColor === name
              ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-400'
              : 'border-transparent'
          )}
          style={{ backgroundColor: hex }}
          title={name.charAt(0).toUpperCase() + name.slice(1)}
        />
      ))}
    </div>
  );
}

// Icon picker component
function IconPicker({
  selectedIcon,
  onSelect,
  onClose,
}: {
  selectedIcon?: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  const icons = Object.entries(SHORTCUT_ICON_PRESETS);

  return (
    <div className="absolute right-0 top-8 z-20 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-64">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Select Icon</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {icons.map(([name, { emoji, label }]) => (
          <button
            key={name}
            onClick={() => {
              onSelect(name);
              onClose();
            }}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
              selectedIcon === name && 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
            )}
            title={label}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Shortcut tile component
function ShortcutTile({
  shortcut,
  productName,
  onRemove,
  onColorChange,
  onIconChange,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  shortcut: ProductShortcut;
  productName: string;
  onRemove: () => void;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const bgColor = SHORTCUT_COLOR_PRESETS[shortcut.color || 'blue'] || shortcut.color || '#3B82F6';
  const currentIcon = shortcut.icon && SHORTCUT_ICON_PRESETS[shortcut.icon]
    ? SHORTCUT_ICON_PRESETS[shortcut.icon].emoji
    : '🛠️';

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-xl text-white"
      style={{ backgroundColor: bgColor }}
    >
      {/* Drag handle / reorder buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={cn(
            'p-0.5 rounded hover:bg-white/20',
            isFirst && 'opacity-30 cursor-not-allowed'
          )}
        >
          <ArrowUpIcon className="w-4 h-4 text-white/80" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={cn(
            'p-0.5 rounded hover:bg-white/20',
            isLast && 'opacity-30 cursor-not-allowed'
          )}
        >
          <ArrowDownIcon className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Icon selector */}
      <div className="relative">
        <button
          onClick={() => {
            setShowIconPicker(!showIconPicker);
            setShowColorPicker(false);
          }}
          className="w-8 h-8 rounded-lg bg-white/30 hover:bg-white/40 flex items-center justify-center text-lg transition-colors"
          title="Change icon"
        >
          {currentIcon}
        </button>
        {showIconPicker && (
          <IconPicker
            selectedIcon={shortcut.icon}
            onSelect={onIconChange}
            onClose={() => setShowIconPicker(false)}
          />
        )}
      </div>

      {/* Product name */}
      <span className="flex-1 font-medium text-white text-sm truncate drop-shadow-sm">
        {productName}
      </span>

      {/* Color selector */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowIconPicker(false);
          }}
          className="w-6 h-6 rounded-full border-2 border-white/50 hover:border-white transition-colors"
          style={{ backgroundColor: bgColor }}
          title="Change color"
        />
        {showColorPicker && (
          <div className="absolute right-0 top-8 z-10 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <ColorPalette
              selectedColor={shortcut.color}
              onSelect={(color) => {
                onColorChange(color);
                setShowColorPicker(false);
              }}
              size="small"
            />
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
}

// Preview tile component
function PreviewTile({
  name,
  price,
  stock,
  gridSettings,
  shortcutColor,
  shortcutIcon,
}: {
  name: string;
  price: number;
  stock: number;
  gridSettings: typeof DEFAULT_GRID_SETTINGS;
  shortcutColor?: string;
  shortcutIcon?: string;
}) {
  const { fc } = useCurrency();
  const bgColor = shortcutColor ? (SHORTCUT_COLOR_PRESETS[shortcutColor] || shortcutColor) : undefined;
  const isShortcut = !!shortcutColor;
  const iconEmoji = shortcutIcon && SHORTCUT_ICON_PRESETS[shortcutIcon]
    ? SHORTCUT_ICON_PRESETS[shortcutIcon].emoji
    : '🛠️';

  const fontSizeClass = {
    small: 'text-[10px]',
    normal: 'text-xs',
    large: 'text-sm',
  }[gridSettings.fontSize];

  const fontWeightClass = {
    normal: 'font-normal',
    medium: 'font-medium',
    bold: 'font-bold',
  }[gridSettings.fontWeight];

  const tileSizeClass = {
    compact: 'p-2 min-h-[60px]',
    normal: 'p-3 min-h-[80px]',
    large: 'p-4 min-h-[100px]',
  }[gridSettings.tileSize];

  return (
    <div
      className={cn(
        'rounded-xl border-2 flex flex-col overflow-hidden',
        tileSizeClass,
        isShortcut
          ? 'border-transparent'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      )}
      style={isShortcut && bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="flex items-start gap-2 flex-1">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-sm",
          isShortcut
            ? "bg-white/30"
            : "bg-orange-100 dark:bg-orange-900/30"
        )}>
          {iconEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn(
            'line-clamp-2',
            fontSizeClass,
            fontWeightClass,
            isShortcut ? 'text-white drop-shadow-sm' : 'text-gray-900 dark:text-gray-100'
          )}>
            {name}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        {gridSettings.showPrice && (
          <span className={cn(
            fontSizeClass,
            fontWeightClass,
            isShortcut ? 'text-white/90' : 'text-orange-600 dark:text-orange-400'
          )}>
            {fc(price)}
          </span>
        )}
        {gridSettings.showStock && (
          <span className={cn(
            'px-1.5 py-0.5 rounded-full text-[9px]',
            isShortcut
              ? 'bg-white/30 text-white'
              : 'bg-green-100 text-green-700'
          )}>
            {stock}
          </span>
        )}
      </div>
    </div>
  );
}

export default function GridSettingsPage() {
  const { data: productsData } = useProducts({ limit: 100 });
  const products = useMemo(
    () => (productsData?.data ?? []).filter((p) => p.isActive),
    [productsData]
  );
  const gridSettings = usePosStore((state) => state.gridSettings);
  const gridShortcuts = usePosStore((state) => state.gridShortcuts);
  const updateGridSettings = usePosStore((state) => state.updateGridSettings);
  const addProductShortcut = usePosStore((state) => state.addProductShortcut);
  const removeProductShortcut = usePosStore((state) => state.removeProductShortcut);
  const reorderShortcuts = usePosStore((state) => state.reorderShortcuts);
  const updateShortcutColor = usePosStore((state) => state.updateShortcutColor);
  const updateShortcutIcon = usePosStore((state) => state.updateShortcutIcon);
  const resetGridToDefaults = usePosStore((state) => state.resetGridToDefaults);

  const [selectedColor, setSelectedColor] = useState<string>('blue');
  const [selectedIcon, setSelectedIcon] = useState<string>('tools');
  const [searchQuery, setSearchQuery] = useState('');

  // Get products that are not shortcuts
  const shortcutProductIds = useMemo(
    () => new Set(gridShortcuts.map((s) => s.productId)),
    [gridShortcuts]
  );

  const availableProducts = useMemo(
    () =>
      products
        .filter((p) => !shortcutProductIds.has(p.id))
        .filter(
          (p) =>
            !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 20),
    [products, shortcutProductIds, searchQuery]
  );

  // Move shortcut up/down
  const moveShortcut = (index: number, direction: 'up' | 'down') => {
    const sortedShortcuts = [...gridShortcuts].sort((a, b) => a.position - b.position);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedShortcuts.length) return;

    [sortedShortcuts[index], sortedShortcuts[newIndex]] = [sortedShortcuts[newIndex], sortedShortcuts[index]];
    // Reassign positions
    const reordered = sortedShortcuts.map((s, i) => ({ ...s, position: i }));
    reorderShortcuts(reordered);
  };

  const sortedShortcuts = useMemo(
    () => [...gridShortcuts].sort((a, b) => a.position - b.position),
    [gridShortcuts]
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pos">
          <Button variant="ghost" size="sm">
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Back to POS
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Grid Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Customize your POS product grid layout, accessibility, and shortcuts
          </p>
        </div>
        <Button variant="outline" onClick={resetGridToDefaults}>
          Reset to Defaults
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Grid Density */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Squares2X2Icon className="w-5 h-5 text-blue-600" />
                Grid Density
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Columns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tiles per row (Desktop)
                </label>
                <div className="flex gap-2">
                  {[4, 6, 8, 10, 12].map((cols) => (
                    <button
                      key={cols}
                      onClick={() => updateGridSettings({ columnsDesktop: cols })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                        gridSettings.columnsDesktop === cols
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Columns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tiles per row (Mobile)
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4].map((cols) => (
                    <button
                      key={cols}
                      onClick={() => updateGridSettings({ columnsMobile: cols })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                        gridSettings.columnsMobile === cols
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tile Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tile Size
                </label>
                <div className="flex gap-2">
                  {(['compact', 'normal', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateGridSettings({ tileSize: size })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 font-medium capitalize transition-all',
                        gridSettings.tileSize === size
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accessibility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeIcon className="w-5 h-5 text-green-600" />
                Accessibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Font Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Weight
                </label>
                <div className="flex gap-2">
                  {(['normal', 'medium', 'bold'] as const).map((weight) => (
                    <button
                      key={weight}
                      onClick={() => updateGridSettings({ fontWeight: weight })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 capitalize transition-all',
                        weight === 'normal' && 'font-normal',
                        weight === 'medium' && 'font-medium',
                        weight === 'bold' && 'font-bold',
                        gridSettings.fontWeight === weight
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {weight}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Size
                </label>
                <div className="flex gap-2">
                  {(['small', 'normal', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateGridSettings({ fontSize: size })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 capitalize transition-all',
                        size === 'small' && 'text-sm',
                        size === 'normal' && 'text-base',
                        size === 'large' && 'text-lg',
                        gridSettings.fontSize === size
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show/Hide Options */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridSettings.showPrice}
                    onChange={(e) => updateGridSettings({ showPrice: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Prices</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gridSettings.showStock}
                    onChange={(e) => updateGridSettings({ showStock: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show Stock</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview & Shortcuts */}
        <div className="space-y-6">
          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(gridSettings.columnsDesktop, 4)}, 1fr)`,
                }}
              >
                {['Hammer', 'Nails (Box)', 'Screwdriver', 'Paint Brush'].map((name, i) => (
                  <PreviewTile
                    key={i}
                    name={name}
                    price={1500 + i * 500}
                    stock={25 - i * 5}
                    gridSettings={gridSettings}
                    shortcutColor={i === 0 ? 'red' : i === 1 ? 'blue' : undefined}
                    shortcutIcon={i === 0 ? 'hammer' : i === 1 ? 'nail' : undefined}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SwatchIcon className="w-5 h-5 text-purple-600" />
                Color Shortcuts
                <Badge variant="info">{gridShortcuts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Shortcuts */}
              {sortedShortcuts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag to reorder. These appear at the top of your POS grid.
                  </p>
                  {sortedShortcuts.map((shortcut, index) => {
                    const product = products.find((p) => p.id === shortcut.productId);
                    return (
                      <ShortcutTile
                        key={shortcut.productId}
                        shortcut={shortcut}
                        productName={product?.name || 'Unknown Product'}
                        onRemove={() => removeProductShortcut(shortcut.productId)}
                        onColorChange={(color) => updateShortcutColor(shortcut.productId, color)}
                        onIconChange={(icon) => updateShortcutIcon(shortcut.productId, icon)}
                        onMoveUp={() => moveShortcut(index, 'up')}
                        onMoveDown={() => moveShortcut(index, 'down')}
                        isFirst={index === 0}
                        isLast={index === sortedShortcuts.length - 1}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <SwatchIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No shortcuts yet</p>
                  <p className="text-sm">Click products below to add them as shortcuts</p>
                </div>
              )}

              {/* Add Shortcut */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add Product Shortcut
                </label>

                {/* Color Selection */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Select color for new shortcuts:
                  </span>
                  <ColorPalette selectedColor={selectedColor} onSelect={setSelectedColor} />
                </div>

                {/* Icon Selection */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    Select icon for new shortcuts:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(SHORTCUT_ICON_PRESETS).slice(0, 12).map(([name, { emoji, label }]) => (
                      <button
                        key={name}
                        onClick={() => setSelectedIcon(name)}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all',
                          selectedIcon === name
                            ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                {/* Available Products Grid */}
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProductShortcut(product.id, selectedColor, selectedIcon)}
                      className="flex items-center gap-2 p-2 text-left rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ backgroundColor: SHORTCUT_COLOR_PRESETS[selectedColor] }}
                    >
                      <div className="w-6 h-6 rounded-md bg-white/30 flex items-center justify-center text-sm flex-shrink-0">
                        {SHORTCUT_ICON_PRESETS[selectedIcon]?.emoji || '🛠️'}
                      </div>
                      <span className="text-sm text-white truncate drop-shadow-sm">
                        {product.name}
                      </span>
                      <PlusIcon className="w-4 h-4 text-white/70 ml-auto flex-shrink-0" />
                    </button>
                  ))}
                  {availableProducts.length === 0 && (
                    <p className="col-span-2 text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
                      {searchQuery ? 'No products found' : 'All products are shortcuts'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
