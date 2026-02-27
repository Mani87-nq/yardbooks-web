'use client';

import { resolveIcon } from '@/lib/icon-map';
import { LockClosedIcon, CheckCircleIcon, ArrowUpCircleIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import type { ModuleManifest } from '@/modules/types';

// Tailwind color classes mapped from manifest color strings
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string; badge: string }> = {
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-200 dark:border-pink-500/30',
    ring: 'ring-pink-500/20',
    badge: 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/30',
    ring: 'ring-blue-500/20',
    badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-500/30',
    ring: 'ring-orange-500/20',
    badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    ring: 'ring-emerald-500/20',
    badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-500/30',
    ring: 'ring-purple-500/20',
    badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
  },
};

const DEFAULT_COLOR = COLOR_MAP.emerald;

export type ModuleCardStatus = 'active' | 'available' | 'slot_full' | 'upgrade_required';

interface ModuleCardProps {
  module: ModuleManifest;
  status: ModuleCardStatus;
  isLoading?: boolean;
  onActivate: (moduleId: string) => void;
  onDeactivate: (moduleId: string) => void;
}

export function ModuleCard({ module, status, isLoading, onActivate, onDeactivate }: ModuleCardProps) {
  const Icon = resolveIcon(module.icon);
  const colors = COLOR_MAP[module.color] || DEFAULT_COLOR;

  // Collect feature names from navigation items and dashboard widgets
  const features = [
    ...module.navigation.map((n) => n.label),
    ...module.dashboardWidgets
      .filter((w) => w.defaultEnabled)
      .map((w) => w.title),
  ];

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 flex flex-col transition-all duration-200 ${
        status === 'active'
          ? `border-emerald-500 dark:border-emerald-400 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20`
          : status === 'upgrade_required'
            ? 'border-gray-200 dark:border-gray-700 opacity-75'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
      }`}
    >
      {/* Active badge */}
      {status === 'active' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          ACTIVE
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{module.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.badge}`}>
              {module.category === 'industry' ? 'Industry Module' : module.category}
            </span>
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {module.requiredPlan}+
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        {module.description}
      </p>

      {/* Features list */}
      <div className="flex-1 mb-5">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Includes
        </h4>
        <ul className="space-y-1.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <CheckCircleIcon className={`h-4 w-4 flex-shrink-0 ${colors.text}`} />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Action button */}
      <div className="mt-auto">
        {status === 'active' && (
          <button
            onClick={() => onDeactivate(module.id)}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold border-2 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deactivating...' : 'Deactivate Module'}
          </button>
        )}

        {status === 'available' && (
          <button
            onClick={() => onActivate(module.id)}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? 'Activating...' : 'Activate Module'}
          </button>
        )}

        {status === 'slot_full' && (
          <Link
            href="/billing"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowUpCircleIcon className="h-4 w-4" />
            Upgrade to Add More
          </Link>
        )}

        {status === 'upgrade_required' && (
          <Link
            href="/billing"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <LockClosedIcon className="h-4 w-4" />
            Upgrade to {module.requiredPlan}
          </Link>
        )}
      </div>
    </div>
  );
}
