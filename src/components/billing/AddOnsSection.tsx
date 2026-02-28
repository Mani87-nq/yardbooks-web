'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { ADD_ONS, formatJmd, formatUsd, type AddOn } from '@/lib/billing/plans';
import {
  PuzzlePieceIcon,
  Square3Stack3DIcon,
  MapPinIcon,
  PlusIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// ─── Icon mapping ───────────────────────────────────────────────

const ADD_ON_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'additional-module': PuzzlePieceIcon,
  'sub-module': Square3Stack3DIcon,
  'extra-location': MapPinIcon,
};

// ─── Add-on name lookup ─────────────────────────────────────────

const ADD_ON_NAMES: Record<string, string> = Object.fromEntries(
  ADD_ONS.map((a) => [a.id, a.name])
);

// ─── Props ──────────────────────────────────────────────────────

interface AddOnsSectionProps {
  onAddAddOn?: (addOnId: string) => void;
  loading?: string | null;
  currentPlanId?: string;
  /** When set, shows an inline "coming soon" notice for this add-on ID */
  addOnNotice?: string | null;
}

// ─── Component ──────────────────────────────────────────────────

export default function AddOnsSection({
  onAddAddOn,
  loading = null,
  currentPlanId = 'free',
  addOnNotice = null,
}: AddOnsSectionProps) {
  const isFreeOrStarter = currentPlanId === 'free' || currentPlanId === 'starter';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add-Ons
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Extend your plan with additional modules and locations.
          {isFreeOrStarter && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}Upgrade to Professional or higher to purchase add-ons.
            </span>
          )}
        </p>
      </div>

      {/* Inline "coming soon" notice — replaces the ugly browser alert */}
      {addOnNotice && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">{ADD_ON_NAMES[addOnNotice] ?? 'Add-on'}</span> checkout is coming soon.
            We&apos;ll notify you as soon as it&apos;s available!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ADD_ONS.map((addOn) => (
          <AddOnCard
            key={addOn.id}
            addOn={addOn}
            disabled={isFreeOrStarter}
            loading={loading === addOn.id}
            onAdd={() => onAddAddOn?.(addOn.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Individual Add-On Card ─────────────────────────────────────

function AddOnCard({
  addOn,
  disabled,
  loading,
  onAdd,
}: {
  addOn: AddOn;
  disabled: boolean;
  loading: boolean;
  onAdd: () => void;
}) {
  const Icon = ADD_ON_ICONS[addOn.id] ?? PuzzlePieceIcon;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white dark:bg-gray-800 p-5 transition-all',
        disabled
          ? 'border-gray-200 dark:border-gray-700 opacity-60'
          : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {addOn.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {addOn.description}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatJmd(addOn.priceJmd)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatUsd(addOn.priceUsd)}/mo
          </p>
        </div>

        <Button
          size="sm"
          variant={disabled ? 'secondary' : 'outline'}
          disabled={disabled || loading}
          loading={loading}
          onClick={onAdd}
          icon={!loading ? <PlusIcon className="h-4 w-4" /> : undefined}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
