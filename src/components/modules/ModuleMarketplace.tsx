'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useModuleStore, useActiveModuleIds } from '@/modules/store';
import { moduleRegistry } from '@/modules/registry';
import { getPlan } from '@/lib/billing/plans';
import { api } from '@/lib/api-client';
import { ModuleCard, type ModuleCardStatus } from './ModuleCard';
import {
  PuzzlePieceIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export function ModuleMarketplace() {
  const { activeCompany } = useAppStore();
  const activeModuleIds = useActiveModuleIds();
  const { addActiveModule, removeActiveModule } = useModuleStore();
  const [loadingModule, setLoadingModule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const companyPlan = (activeCompany?.subscriptionPlan || 'FREE').toUpperCase();
  const planData = getPlan(companyPlan);
  const includedModules = planData?.includesModules ?? 0; // -1 = unlimited
  const activeCount = activeModuleIds.length;

  // Get all available modules from the registry
  const allModules = useMemo(() => moduleRegistry.getAllModules(), []);

  // Determine the status of each module
  const getModuleStatus = useCallback(
    (moduleId: string): ModuleCardStatus => {
      // Already active
      if (activeModuleIds.includes(moduleId)) return 'active';

      // Plan too low
      if (!moduleRegistry.isPlanSufficient(moduleId, companyPlan)) return 'upgrade_required';

      // Slot limit reached (unless unlimited)
      if (includedModules !== -1 && activeCount >= includedModules) return 'slot_full';

      return 'available';
    },
    [activeModuleIds, companyPlan, includedModules, activeCount]
  );

  const handleActivate = useCallback(
    async (moduleId: string) => {
      if (!activeCompany) return;

      // Check dependencies
      const { met, missing } = moduleRegistry.areDependenciesMet(moduleId, activeModuleIds);
      if (!met) {
        setError(`Please activate required modules first: ${missing.join(', ')}`);
        return;
      }

      setError(null);
      setSuccessMessage(null);
      setLoadingModule(moduleId);

      try {
        // Optimistic update
        addActiveModule(moduleId);

        await api.post(`/api/v1/company/${activeCompany.id}/modules`, {
          moduleId,
        });

        const mod = moduleRegistry.getModule(moduleId);
        setSuccessMessage(`${mod?.name || moduleId} has been activated! Check the sidebar for new menu items.`);

        // Clear success after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        // Roll back optimistic update
        removeActiveModule(moduleId);
        setError(err instanceof Error ? err.message : 'Failed to activate module');
      } finally {
        setLoadingModule(null);
      }
    },
    [activeCompany, activeModuleIds, addActiveModule, removeActiveModule]
  );

  const handleDeactivate = useCallback(
    async (moduleId: string) => {
      if (!activeCompany) return;

      setError(null);
      setSuccessMessage(null);
      setLoadingModule(moduleId);

      try {
        // Optimistic update
        removeActiveModule(moduleId);

        await api.delete(`/api/v1/company/${activeCompany.id}/modules`, {
          moduleId,
        });

        const mod = moduleRegistry.getModule(moduleId);
        setSuccessMessage(`${mod?.name || moduleId} has been deactivated.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        // Roll back optimistic update
        addActiveModule(moduleId);
        setError(err instanceof Error ? err.message : 'Failed to deactivate module');
      } finally {
        setLoadingModule(null);
      }
    },
    [activeCompany, addActiveModule, removeActiveModule]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
            <PuzzlePieceIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Module Marketplace
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Extend YaadBooks with specialized modules for your industry
            </p>
          </div>
        </div>
      </div>

      {/* Plan info banner */}
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SparklesIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
              Your Plan: {planData?.name || companyPlan}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {includedModules === -1
                ? 'Unlimited modules included'
                : includedModules === 0
                  ? 'No modules included — upgrade to Professional or higher'
                  : `${activeCount} of ${includedModules} module${includedModules !== 1 ? 's' : ''} used`}
            </p>
          </div>
        </div>
        {includedModules !== -1 && includedModules > 0 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: includedModules }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full transition-colors ${
                  i < activeCount
                    ? 'bg-emerald-500 dark:bg-emerald-400'
                    : 'bg-emerald-200 dark:bg-emerald-500/20'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {allModules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            status={getModuleStatus(module.id)}
            isLoading={loadingModule === module.id}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
          />
        ))}
      </div>

      {/* Help text */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Modules add specialized features for your business type. Once activated, new menu items
          appear in the sidebar. Need a different module?{' '}
          <a href="mailto:support@yaadbooks.com" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            Let us know
          </a>
        </p>
      </div>
    </div>
  );
}
