'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useKioskStore } from '@/store/kioskStore';
import { moduleRegistry } from '@/modules/registry';

// ── Types ────────────────────────────────────────────────────────

interface NavTab {
  label: string;
  href: string;
  icon: React.ReactNode;
  priority: number;
}

interface KioskBottomNavProps {
  /** Optional override for when store isn't loaded yet */
  className?: string;
}

// ── Icon SVG Paths ───────────────────────────────────────────────
// Heroicon name → SVG path mapping for module-provided icons.
// Uses 24x24 viewBox, stroke-based Heroicons (Outline).

const ICON_PATHS: Record<string, string> = {
  // POS Register
  CalculatorIcon:
    'M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z',
  // Salon
  SparklesIcon:
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  // Tables
  Squares2X2Icon:
    'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  // Kitchen
  FireIcon:
    'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z',
};

// ── Core Tab Icons ───────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

/**
 * Renders an icon from a Heroicon name string using the ICON_PATHS map.
 * Falls back to a generic square icon if the name is not mapped.
 */
function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const pathData = ICON_PATHS[name];

  if (!pathData) {
    // Fallback: generic squares icon
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    );
  }

  // Some icons have multiple path segments separated by " M" (e.g. FireIcon).
  // Split them into separate <path> elements.
  const paths = pathData.split(/(?= M)/);

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      {paths.map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d.trim()} />
      ))}
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────

export default function KioskBottomNav({ className }: KioskBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeModules, currentEmployee } = useKioskStore();

  // Build the full tab list: core tabs + module tabs, sorted by priority
  const tabs = useMemo<NavTab[]>(() => {
    // Core tabs (always present)
    const coreTabs: NavTab[] = [
      {
        label: 'Home',
        href: '/employee/home',
        icon: <HomeIcon className="w-6 h-6" />,
        priority: 0,
      },
      {
        label: 'Clock',
        href: '/employee/clock',
        icon: <ClockIcon className="w-6 h-6" />,
        priority: 50,
      },
      {
        label: 'Profile',
        href: '/employee/profile',
        icon: <UserIcon className="w-6 h-6" />,
        priority: 100,
      },
    ];

    // Module tabs from registry
    const moduleNavItems = moduleRegistry.getKioskNavItems(
      activeModules,
      currentEmployee?.role
    );

    const moduleTabs: NavTab[] = moduleNavItems.map((item) => ({
      label: item.label,
      href: `/employee/${item.href}`,
      icon: <ModuleIcon name={item.icon} className="w-6 h-6" />,
      priority: item.priority,
    }));

    // Combine and sort by priority
    return [...coreTabs, ...moduleTabs].sort((a, b) => a.priority - b.priority);
  }, [activeModules, currentEmployee?.role]);

  const isActive = (href: string) => {
    if (href === '/employee/home') {
      return pathname === '/employee/home' || pathname === '/employee';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-2 ${
        tabs.length > 5 ? 'overflow-x-auto' : ''
      } ${className ?? ''}`}
    >
      <div
        className={`flex ${
          tabs.length > 5 ? 'w-max min-w-full' : ''
        } justify-around`}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center gap-1 py-2 px-3 touch-manipulation transition-colors ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
