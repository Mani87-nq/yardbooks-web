/**
 * Offline sync queue with IndexedDB persistence.
 * Stores mutations in IndexedDB so they survive page refreshes.
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

// ─── IndexedDB helpers ──────────────────────────────────────

const DB_NAME = 'yaadbooks-offline';
const DB_VERSION = 1;
const STORE_NAME = 'sync-queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll(): Promise<SyncItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as SyncItem[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbPut(item: SyncItem): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: silently fail — SW queue is the primary store
  }
}

async function idbDelete(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: silently fail
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: silently fail
  }
}

// ─── Public API ─────────────────────────────────────────────

export async function addToSyncQueue(
  item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>
): Promise<SyncItem> {
  const syncItem: SyncItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retryCount: 0,
  };
  await idbPut(syncItem);
  return syncItem;
}

export async function getSyncQueue(): Promise<SyncItem[]> {
  return idbGetAll();
}

export async function clearSyncQueue(): Promise<void> {
  await idbClear();
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  await idbDelete(id);
}

export async function replaySyncQueue(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const items = await idbGetAll();
  if (items.length === 0) return { success: 0, failed: 0 };

  // Clear queue first, then re-add failures
  await idbClear();

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
          await idbPut({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    } catch {
      failed++;
      if (item.retryCount < 3) {
        await idbPut({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  return { success, failed };
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
