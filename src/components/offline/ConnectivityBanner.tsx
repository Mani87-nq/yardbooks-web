'use client';

import { useConnectivity } from '@/lib/offline/connectivity';
import {
  WifiIcon,
  SignalSlashIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

/**
 * Persistent connectivity banner for POS and dashboard.
 * Shows at the top of the screen when offline or degraded.
 * Minimal/hidden when fully online.
 */
export function ConnectivityBanner() {
  const { status, lastOnlineAt, pendingSyncCount, latencyMs } = useConnectivity();

  if (status === 'online') {
    // Show nothing when fully online (clean UI)
    // Exception: show briefly when sync items are pending
    if (pendingSyncCount === 0) return null;

    return (
      <div className="flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs py-1 px-3">
        <ArrowPathIcon className="h-3 w-3 animate-spin" />
        <span>Syncing {pendingSyncCount} pending transaction{pendingSyncCount !== 1 ? 's' : ''}...</span>
      </div>
    );
  }

  if (status === 'degraded') {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs py-1.5 px-3">
        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
        <span>
          Slow connection ({latencyMs}ms) — Some features may be limited
          {pendingSyncCount > 0 && ` • ${pendingSyncCount} pending sync`}
        </span>
      </div>
    );
  }

  // Offline
  const lastOnline = lastOnlineAt ? formatTimeAgo(lastOnlineAt) : 'Unknown';

  return (
    <div className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs py-1.5 px-3">
      <SignalSlashIcon className="h-3.5 w-3.5" />
      <span>
        Offline — Cash sales working. Card payments will process when connection returns.
        {pendingSyncCount > 0 && ` • ${pendingSyncCount} transactions pending sync.`}
        {` Last connected: ${lastOnline}`}
      </span>
    </div>
  );
}

/**
 * Compact connectivity indicator for POS status bar.
 * Shows as a colored dot with label.
 */
export function ConnectivityDot() {
  const { status, pendingSyncCount } = useConnectivity();

  const config = {
    online: {
      dot: 'bg-emerald-500',
      label: 'Online',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    degraded: {
      dot: 'bg-amber-500',
      label: 'Slow',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    offline: {
      dot: 'bg-red-500 animate-pulse',
      label: 'Offline',
      textColor: 'text-red-600 dark:text-red-400',
    },
  }[status];

  return (
    <div className={`flex items-center gap-1.5 ${config.textColor}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${config.dot}`} />
      <span className="text-xs font-medium">{config.label}</span>
      {pendingSyncCount > 0 && (
        <span className="text-xs opacity-70">({pendingSyncCount})</span>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
