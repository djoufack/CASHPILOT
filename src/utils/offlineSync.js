import { openDB } from 'idb';

const DB_NAME = 'cashpilot-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

/**
 * Initialize IndexedDB for offline operations
 */
const getDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('synced', 'synced');
      }
    },
  });
};

/**
 * Queue an operation for offline sync
 */
export const queueOperation = async (operation) => {
  const db = await getDB();
  await db.add(STORE_NAME, {
    ...operation,
    timestamp: Date.now(),
    synced: false,
  });

  // Request background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-offline-data');
  }
};

/**
 * Get all pending (unsynced) operations
 */
export const getPendingOperations = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('synced');
  return index.getAll(false);
};

/**
 * Mark an operation as synced
 */
export const markSynced = async (id) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.synced = true;
    await tx.store.put(item);
  }
};

/**
 * Sync all pending operations with server
 */
export const syncPendingOperations = async (supabase) => {
  const pending = await getPendingOperations();
  const results = [];

  for (const op of pending) {
    try {
      let result;
      switch (op.type) {
        case 'insert':
          result = await supabase.from(op.table).insert(op.data);
          break;
        case 'update':
          result = await supabase.from(op.table).update(op.data).eq('id', op.entityId);
          break;
        case 'delete':
          result = await supabase.from(op.table).delete().eq('id', op.entityId);
          break;
      }

      if (!result?.error) {
        await markSynced(op.id);
        results.push({ id: op.id, status: 'synced' });
      } else {
        results.push({ id: op.id, status: 'error', error: result.error.message });
      }
    } catch (err) {
      results.push({ id: op.id, status: 'error', error: err.message });
    }
  }

  return results;
};

/**
 * Check if user is online
 */
export const isOnline = () => navigator.onLine;

/**
 * Register online/offline listeners
 */
export const registerConnectivityListeners = (onOnline, onOffline) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

export default { queueOperation, getPendingOperations, syncPendingOperations, isOnline, registerConnectivityListeners };
