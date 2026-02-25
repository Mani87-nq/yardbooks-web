'use client';

/**
 * useCurrency — Returns the active currency code and a bound formatter.
 *
 * Priority: user display preference → company currency → 'JMD' fallback.
 * Every page that shows money should call `const { fc } = useCurrency()` and
 * use `fc(amount)` instead of `formatJMD(amount)`.
 */
import { useAppStore } from '@/store/appStore';
import { formatCurrency } from '@/lib/utils';
import { formatPrintCurrency } from '@/lib/print';

export function useCurrency() {
  const currency = useAppStore(
    (s) => s.settings.currency || s.activeCompany?.currency || 'JMD',
  );

  /** Format a number as the active currency string — e.g. `fc(1500)` → "$1,500.00" */
  // Number() safety belt: Prisma Decimal fields may arrive as strings despite our toJSON override
  const fc = (amount: number | string) => formatCurrency(Number(amount) || 0, currency);

  /** Print-friendly formatter */
  const fcp = (amount: number | string) => formatPrintCurrency(Number(amount) || 0, currency);

  return { currency, fc, fcp };
}

/**
 * Non-hook helper — reads current currency directly from the Zustand store.
 * Use in callbacks, event handlers, or outside of React component render.
 */
export function getActiveCurrency(): string {
  const state = useAppStore.getState();
  return state.settings.currency || state.activeCompany?.currency || 'JMD';
}

/**
 * Standalone format using the store's active currency.
 * Use when you can't call the hook (e.g. inside a non-component helper).
 */
export function formatActiveCurrency(amount: number | string): string {
  return formatCurrency(Number(amount) || 0, getActiveCurrency());
}
