/**
 * Offline sync queue for PWA support.
 * Stores mutations in memory (IndexedDB integration is a future enhancement).
 * When the app comes back online, queued mutations are replayed.
 */

export interface SyncItem {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  timestamp: number;
  retryCount: number;
}

// In-memory queue (IndexedDB to be added later)
const syncQueue: SyncItem[] = [];

export function addToSyncQueue(item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>): void {
  syncQueue.push({
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retryCount: 0,
  });
}

export function getSyncQueue(): SyncItem[] {
  return [...syncQueue];
}

export function clearSyncQueue(): void {
  syncQueue.length = 0;
}

export async function replaySyncQueue(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const items = [...syncQueue];
  syncQueue.length = 0;

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (response.ok) {
        success++;
      } else {
        failed++;
        if (item.retryCount < 3) {
          syncQueue.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    } catch {
      failed++;
      if (item.retryCount < 3) {
        syncQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  return { success, failed };
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
