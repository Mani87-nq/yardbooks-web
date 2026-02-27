'use client';

/**
 * ModuleUpgradePrompt — shown when a user tries to access a module
 * that is not activated for their company.
 *
 * Displays the module name, description, and a CTA to activate or
 * upgrade the subscription plan.
 *
 * Usage:
 *   <ModuleGate moduleId="salon" fallback={<ModuleUpgradePrompt moduleId="salon" />}>
 *     <SalonPage />
 *   </ModuleGate>
 */
import React from 'react';
import Link from 'next/link';
import { moduleRegistry } from '../registry';

interface ModuleUpgradePromptProps {
  /** The module ID to show upgrade information for */
  moduleId: string;
  /** Optional CSS class name for the wrapper */
  className?: string;
}

export function ModuleUpgradePrompt({ moduleId, className }: ModuleUpgradePromptProps) {
  const manifest = moduleRegistry.getModule(moduleId);

  if (!manifest) {
    return null;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center ${className ?? ''}`}
    >
      {/* Icon placeholder */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-8 w-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-gray-900">
        {manifest.name}
      </h3>

      <p className="mb-6 max-w-md text-sm text-gray-500">
        {manifest.description}
      </p>

      {manifest.requiredPlan !== 'FREE' && (
        <p className="mb-4 text-xs text-gray-400">
          Requires the{' '}
          <span className="font-medium text-gray-600">
            {manifest.requiredPlan}
          </span>{' '}
          plan or higher
          {manifest.trialDays > 0 && (
            <> &mdash; {manifest.trialDays}-day free trial available</>
          )}
        </p>
      )}

      <Link
        href="/settings/billing"
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
          />
        </svg>
        Activate Module
      </Link>
    </div>
  );
}
