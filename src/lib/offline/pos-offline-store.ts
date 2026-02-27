/**
 * Offline POS Data Store
 *
 * Extended IndexedDB schema for offline POS operation.
 * Stores products, employees (with PIN hashes), pending transactions,
 * pending actions, active shifts, and schedule cache.
 *
 * This is YaadBooks' core competitive advantage:
 * "Your business runs even when the internet doesn't."
 */

// ─── Types ──────────────────────────────────────────────────────

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;            // cents (JMD)
  costPrice: number | null; // cents (JMD)
  category: string | null;
  imageUrl: string | null;
  gctRate: 'STANDARD' | 'EXEMPT' | 'ZERO_RATED';
  inStock: boolean;
  stockQuantity: number | null;
  barcode: string | null;
  variants: OfflineProductVariant[];
  lastSynced: number;
}

export interface OfflineProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  barcode: string | null;
  inStock: boolean;
  stockQuantity: number | null;
}

export interface OfflineEmployee {
  id: string;
  displayName: string;
  avatarColor: string;
  pinHash: string;          // Argon2 hash for local validation
  posRole: string;          // EmployeeRole enum value
  permissions: {
    canVoid: boolean;
    canRefund: boolean;
    canDiscount: boolean;
    maxDiscountPct: number;
    canOpenDrawer: boolean;
    canApplyPriceOverride: boolean;
  };
  isActive: boolean;
  lastSynced: number;
}

export interface OfflineTransaction {
  offlineId: string;         // Client-generated UUID
  employeeId: string;
  employeeName: string;
  items: OfflineOrderItem[];
  payments: OfflinePayment[];
  subtotal: number;
  discountAmount: number;
  gctAmount: number;
  total: number;
  customerId: string | null;
  customerName: string | null;
  orderType: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | 'POS';
  notes: string | null;
  timestamp: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncAttempt: number | null;
  serverTransactionId: string | null;
  failureReason: string | null;
}

export interface OfflineOrderItem {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  gctRate: string;
  gctAmount: number;
  total: number;
  modifiers: string[];
  notes: string | null;
}

export interface OfflinePayment {
  method: 'CASH' | 'CARD' | 'STORED_FORWARD_CARD';
  amount: number;
  reference: string | null;
  changeGiven: number;
}

export interface OfflinePOSAction {
  offlineId: string;
  employeeId: string;
  actionType: string;       // POSActionType enum value
  details: Record<string, unknown>;
  timestamp: number;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface OfflineShift {
  id: string;
  employeeId: string;
  clockInAt: number;
  clockOutAt: number | null;
  openingCashCount: number | null;
  closingCashCount: number | null;
  transactionCount: number;
  totalSales: number;
  totalTips: number;
  status: 'active' | 'on_break' | 'completed';
  syncStatus: 'pending' | 'syncing' | 'synced';
}

export interface OfflineScheduleCache {
  weekStartDate: string;
  shifts: Array<{
    id: string;
    employeeId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    role: string;
  }>;
  lastSynced: number;
}

// ─── IndexedDB Schema ───────────────────────────────────────────

const DB_NAME = 'yaadbooks-pos-offline';
const DB_VERSION = 2;

const STORES = {
  PRODUCTS: 'products',
  EMPLOYEES: 'employees',
  PENDING_TRANSACTIONS: 'pendingTransactions',
  PENDING_ACTIONS: 'pendingActions',
  ACTIVE_SHIFTS: 'activeShifts',
  SCHEDULE_CACHE: 'scheduleCache',
  SYNC_META: 'syncMeta',
} as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        // Initial schema
        db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        db.createObjectStore(STORES.EMPLOYEES, { keyPath: 'id' });

        const txStore = db.createObjectStore(STORES.PENDING_TRANSACTIONS, { keyPath: 'offlineId' });
        txStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        txStore.createIndex('timestamp', 'timestamp', { unique: false });

        const actionStore = db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'offlineId' });
        actionStore.createIndex('syncStatus', 'syncStatus', { unique: false });

        db.createObjectStore(STORES.ACTIVE_SHIFTS, { keyPath: 'id' });
        db.createObjectStore(STORES.SCHEDULE_CACHE, { keyPath: 'weekStartDate' });
        db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
      }

      if (oldVersion < 2) {
        // Add barcode index to products
        if (db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const productStore = tx.objectStore(STORES.PRODUCTS);
          if (!productStore.indexNames.contains('barcode')) {
            productStore.createIndex('barcode', 'barcode', { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Generic CRUD Helpers ───────────────────────────────────────

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function getByKey<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function putAll<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteByKey(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Product Catalog Cache ──────────────────────────────────────

export const offlineProducts = {
  getAll: () => getAll<OfflineProduct>(STORES.PRODUCTS),
  getById: (id: string) => getByKey<OfflineProduct>(STORES.PRODUCTS, id),

  async getByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
    const all = await getByIndex<OfflineProduct>(STORES.PRODUCTS, 'barcode', barcode);
    return all[0];
  },

  async syncFromServer(products: OfflineProduct[]): Promise<void> {
    const now = Date.now();
    const withTimestamp = products.map(p => ({ ...p, lastSynced: now }));
    await clearStore(STORES.PRODUCTS);
    await putAll(STORES.PRODUCTS, withTimestamp);
    await setSyncMeta('products_last_sync', now);
  },

  async getLastSyncTime(): Promise<number | null> {
    return getSyncMeta('products_last_sync');
  },
};

// ─── Employee Cache (with PIN hashes) ───────────────────────────

export const offlineEmployees = {
  getAll: () => getAll<OfflineEmployee>(STORES.EMPLOYEES),
  getById: (id: string) => getByKey<OfflineEmployee>(STORES.EMPLOYEES, id),

  async syncFromServer(employees: OfflineEmployee[]): Promise<void> {
    const now = Date.now();
    const withTimestamp = employees.map(e => ({ ...e, lastSynced: now }));
    await clearStore(STORES.EMPLOYEES);
    await putAll(STORES.EMPLOYEES, withTimestamp);
    await setSyncMeta('employees_last_sync', now);
  },

  async getLastSyncTime(): Promise<number | null> {
    return getSyncMeta('employees_last_sync');
  },
};

// ─── Pending Transactions (Offline Sales) ───────────────────────

export const offlineTransactions = {
  getAll: () => getAll<OfflineTransaction>(STORES.PENDING_TRANSACTIONS),

  async getPending(): Promise<OfflineTransaction[]> {
    return getByIndex(STORES.PENDING_TRANSACTIONS, 'syncStatus', 'pending');
  },

  async add(transaction: OfflineTransaction): Promise<void> {
    await put(STORES.PENDING_TRANSACTIONS, transaction);
  },

  async updateSyncStatus(
    offlineId: string,
    status: OfflineTransaction['syncStatus'],
    serverTransactionId?: string,
    failureReason?: string
  ): Promise<void> {
    const existing = await getByKey<OfflineTransaction>(STORES.PENDING_TRANSACTIONS, offlineId);
    if (existing) {
      await put(STORES.PENDING_TRANSACTIONS, {
        ...existing,
        syncStatus: status,
        serverTransactionId: serverTransactionId ?? existing.serverTransactionId,
        syncAttempts: existing.syncAttempts + (status === 'syncing' ? 1 : 0),
        lastSyncAttempt: Date.now(),
        failureReason: failureReason ?? null,
      });
    }
  },

  async removeSynced(): Promise<number> {
    const synced = await getByIndex<OfflineTransaction>(
      STORES.PENDING_TRANSACTIONS, 'syncStatus', 'synced'
    );
    for (const tx of synced) {
      await deleteByKey(STORES.PENDING_TRANSACTIONS, tx.offlineId);
    }
    return synced.length;
  },

  async getCount(): Promise<number> {
    const all = await getAll<OfflineTransaction>(STORES.PENDING_TRANSACTIONS);
    return all.filter(t => t.syncStatus !== 'synced').length;
  },
};

// ─── Pending POS Actions (Audit Log) ────────────────────────────

export const offlineActions = {
  getAll: () => getAll<OfflinePOSAction>(STORES.PENDING_ACTIONS),

  async getPending(): Promise<OfflinePOSAction[]> {
    return getByIndex(STORES.PENDING_ACTIONS, 'syncStatus', 'pending');
  },

  async add(action: OfflinePOSAction): Promise<void> {
    await put(STORES.PENDING_ACTIONS, action);
  },

  async markSynced(offlineId: string): Promise<void> {
    const existing = await getByKey<OfflinePOSAction>(STORES.PENDING_ACTIONS, offlineId);
    if (existing) {
      await put(STORES.PENDING_ACTIONS, { ...existing, syncStatus: 'synced' });
    }
  },

  async removeSynced(): Promise<number> {
    const synced = await getByIndex<OfflinePOSAction>(
      STORES.PENDING_ACTIONS, 'syncStatus', 'synced'
    );
    for (const action of synced) {
      await deleteByKey(STORES.PENDING_ACTIONS, action.offlineId);
    }
    return synced.length;
  },
};

// ─── Active Shifts ──────────────────────────────────────────────

export const offlineShifts = {
  getAll: () => getAll<OfflineShift>(STORES.ACTIVE_SHIFTS),

  async getActive(employeeId: string): Promise<OfflineShift | undefined> {
    const all = await getAll<OfflineShift>(STORES.ACTIVE_SHIFTS);
    return all.find(s => s.employeeId === employeeId && s.status === 'active');
  },

  async save(shift: OfflineShift): Promise<void> {
    await put(STORES.ACTIVE_SHIFTS, shift);
  },

  async remove(id: string): Promise<void> {
    await deleteByKey(STORES.ACTIVE_SHIFTS, id);
  },
};

// ─── Schedule Cache ─────────────────────────────────────────────

export const offlineSchedule = {
  async getWeek(weekStartDate: string): Promise<OfflineScheduleCache | undefined> {
    return getByKey(STORES.SCHEDULE_CACHE, weekStartDate);
  },

  async saveWeek(cache: OfflineScheduleCache): Promise<void> {
    await put(STORES.SCHEDULE_CACHE, cache);
  },
};

// ─── Sync Metadata ──────────────────────────────────────────────

async function getSyncMeta(key: string): Promise<number | null> {
  const record = await getByKey<{ key: string; value: number }>(STORES.SYNC_META, key);
  return record?.value ?? null;
}

async function setSyncMeta(key: string, value: number): Promise<void> {
  await put(STORES.SYNC_META, { key, value });
}

// ─── Sync Engine ────────────────────────────────────────────────

export interface SyncResult {
  transactionsSynced: number;
  transactionsFailed: number;
  actionsSynced: number;
  productsCached: number;
  employeesCached: number;
}

/**
 * Full sync cycle:
 * 1. Upload pending transactions (FIFO)
 * 2. Upload pending POS actions
 * 3. Download updated product catalog
 * 4. Download updated employee list
 * 5. Download schedule
 */
export async function runFullSync(authToken: string): Promise<SyncResult> {
  const result: SyncResult = {
    transactionsSynced: 0,
    transactionsFailed: 0,
    actionsSynced: 0,
    productsCached: 0,
    employeesCached: 0,
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // 1. Upload pending transactions
  const pendingTx = await offlineTransactions.getPending();
  for (const tx of pendingTx) {
    try {
      await offlineTransactions.updateSyncStatus(tx.offlineId, 'syncing');
      const response = await fetch('/api/sync/push/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify(tx),
      });
      if (response.ok) {
        const data = await response.json();
        await offlineTransactions.updateSyncStatus(
          tx.offlineId, 'synced', data.serverTransactionId
        );
        result.transactionsSynced++;
      } else {
        const errorText = await response.text();
        await offlineTransactions.updateSyncStatus(tx.offlineId, 'failed', undefined, errorText);
        result.transactionsFailed++;
      }
    } catch {
      await offlineTransactions.updateSyncStatus(tx.offlineId, 'pending');
      result.transactionsFailed++;
    }
  }

  // 2. Upload pending POS actions
  const pendingActions = await offlineActions.getPending();
  if (pendingActions.length > 0) {
    try {
      const response = await fetch('/api/sync/push/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ actions: pendingActions }),
      });
      if (response.ok) {
        for (const action of pendingActions) {
          await offlineActions.markSynced(action.offlineId);
        }
        result.actionsSynced = pendingActions.length;
      }
    } catch {
      // Will retry on next sync
    }
  }

  // 3. Download product catalog
  try {
    const lastSync = await offlineProducts.getLastSyncTime();
    const url = lastSync
      ? `/api/sync/pull/products?since=${lastSync}`
      : '/api/sync/pull/products';
    const response = await fetch(url, { headers });
    if (response.ok) {
      const data = await response.json();
      if (data.products && data.products.length > 0) {
        await offlineProducts.syncFromServer(data.products);
        result.productsCached = data.products.length;
      }
    }
  } catch {
    // Will retry on next sync
  }

  // 4. Download employee list
  try {
    const lastSync = await offlineEmployees.getLastSyncTime();
    const url = lastSync
      ? `/api/sync/pull/employees?since=${lastSync}`
      : '/api/sync/pull/employees';
    const response = await fetch(url, { headers });
    if (response.ok) {
      const data = await response.json();
      if (data.employees && data.employees.length > 0) {
        await offlineEmployees.syncFromServer(data.employees);
        result.employeesCached = data.employees.length;
      }
    }
  } catch {
    // Will retry on next sync
  }

  // 5. Clean up synced items
  await offlineTransactions.removeSynced();
  await offlineActions.removeSynced();

  return result;
}
