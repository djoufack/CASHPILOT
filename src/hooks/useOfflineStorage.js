import { useState, useEffect, useCallback } from 'react';
import db from '../lib/offlineDb';
import { addToQueue, getQueueSize, processQueue, onSyncEvent } from '../lib/syncEngine';

/**
 * Hook for offline storage operations.
 *
 * Provides:
 * - isOnline   : boolean, tracks navigator.onLine
 * - queueSize  : number of pending offline ops
 * - syncStatus : 'idle' | 'syncing' | 'error'
 * - saveOffline(table, data)  : persist data locally + queue for sync
 * - getOffline(table, id?)    : read from local cache
 * - triggerSync()             : manually replay the queue
 */
export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueSize, setQueueSize] = useState(0);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'error'

  // Track connectivity
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Listen to sync events
  useEffect(() => {
    const unsubs = [
      onSyncEvent('queue-updated', (size) => setQueueSize(size)),
      onSyncEvent('sync-start', () => setSyncStatus('syncing')),
      onSyncEvent('sync-complete', () => setSyncStatus('idle')),
      onSyncEvent('sync-error', () => setSyncStatus('error')),
    ];

    // Initialise queue size
    getQueueSize().then(setQueueSize);

    return () => unsubs.forEach((fn) => fn());
  }, []);

  /**
   * Save data to the local IndexedDB cache and enqueue an insert/update for sync.
   * @param {'cachedInvoices'|'cachedClients'|'cachedExpenses'} table
   * @param {object} data - Must include `id`
   */
  const saveOffline = useCallback(async (table, data) => {
    if (!db[table]) {
      console.warn(`[useOfflineStorage] Unknown table: ${table}`);
      return;
    }
    const now = new Date().toISOString();
    const record = { ...data, updated_at: now };
    await db[table].put(record);

    // Determine Supabase table name from cache table name
    const supabaseTable = table.replace('cached', '').toLowerCase();
    const isNew = !(await db[table].get(data.id));
    await addToQueue(isNew ? 'insert' : 'update', supabaseTable, record);
  }, []);

  /**
   * Read cached data from IndexedDB.
   * @param {'cachedInvoices'|'cachedClients'|'cachedExpenses'} table
   * @param {string} [id] - If provided, returns a single record; otherwise all records.
   */
  const getOffline = useCallback(async (table, id) => {
    if (!db[table]) {
      console.warn(`[useOfflineStorage] Unknown table: ${table}`);
      return id ? null : [];
    }
    if (id) {
      return db[table].get(id) || null;
    }
    return db[table].toArray();
  }, []);

  /**
   * Manually trigger queue processing.
   */
  const triggerSync = useCallback(async () => {
    if (!isOnline) return;
    await processQueue();
  }, [isOnline]);

  return {
    isOnline,
    queueSize,
    syncStatus,
    saveOffline,
    getOffline,
    triggerSync,
  };
}

export default useOfflineStorage;
