import { offlineQueue } from './offlineDb';
import { supabase } from './supabase';

/**
 * Lightweight event emitter for sync lifecycle events.
 * Events: 'sync-start', 'sync-complete', 'sync-error', 'queue-updated'
 */
const listeners = {};

function emit(event, data) {
  (listeners[event] || []).forEach((fn) => fn(data));
}

export function onSyncEvent(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  return () => {
    listeners[event] = listeners[event].filter((fn) => fn !== callback);
  };
}

/**
 * Add an operation to the offline queue.
 * @param {'insert'|'update'|'delete'} type
 * @param {string} table - Supabase table name
 * @param {object} payload - Row data (must include `id` for update/delete)
 */
export async function addToQueue(type, table, payload) {
  await offlineQueue.add({
    type,
    table,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
  emit('queue-updated', await getQueueSize());
}

/**
 * Returns the number of pending operations in the queue.
 * @returns {Promise<number>}
 */
export async function getQueueSize() {
  return offlineQueue.where('status').equals('pending').count();
}

/**
 * Process all pending operations against Supabase.
 * Uses last-write-wins conflict resolution via `updated_at`.
 */
export async function processQueue() {
  if (!supabase) return;

  const pending = await offlineQueue.where('status').equals('pending').toArray();
  if (pending.length === 0) return;

  emit('sync-start', { count: pending.length });

  let errors = 0;

  for (const op of pending) {
    try {
      let result;

      switch (op.type) {
        case 'insert': {
          result = await supabase.from(op.table).insert(op.payload);
          break;
        }
        case 'update': {
          const { id, ...rest } = op.payload;
          result = await supabase
            .from(op.table)
            .update({ ...rest, updated_at: new Date().toISOString() })
            .eq('id', id);
          break;
        }
        case 'delete': {
          result = await supabase.from(op.table).delete().eq('id', op.payload.id);
          break;
        }
        default:
          console.warn(`[SyncEngine] Unknown operation type: ${op.type}`);
          continue;
      }

      if (result?.error) {
        throw result.error;
      }

      await offlineQueue.update(op.id, { status: 'synced' });
    } catch (err) {
      errors++;
      console.error(`[SyncEngine] Failed to sync op #${op.id}:`, err);
      await offlineQueue.update(op.id, { status: 'error' });
    }
  }

  if (errors > 0) {
    emit('sync-error', { total: pending.length, errors });
  } else {
    emit('sync-complete', { total: pending.length });
  }

  emit('queue-updated', await getQueueSize());
}

/**
 * Clear all synced/errored operations from the queue.
 */
export async function clearQueue() {
  await offlineQueue.where('status').notEqual('pending').delete();
  emit('queue-updated', await getQueueSize());
}
