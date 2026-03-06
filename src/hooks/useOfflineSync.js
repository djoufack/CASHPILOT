
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  queueOperation,
  getPendingOperations,
  syncPendingOperations,
  isOnline as checkOnline,
  registerConnectivityListeners,
} from '@/utils/offlineSync';
import { supabase } from '@/lib/customSupabaseClient';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [queueSize, setQueueSize] = useState(0);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const refreshQueueSize = useCallback(async () => {
    try {
      const pending = await getPendingOperations();
      setQueueSize(pending.length);
    } catch (err) {
      console.error('Failed to read pending operations', err);
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase client not available, skipping sync');
      return;
    }
    try {
      const results = await syncPendingOperations(supabase);
      const errors = results.filter(r => r.status === 'error');
      if (errors.length > 0) {
        console.warn('Some operations failed to sync:', errors);
      }
    } catch (err) {
      console.error('Sync failed', err);
    }
    await refreshQueueSize();
  }, [refreshQueueSize]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
      toastRef.current({ title: 'Online', description: 'Connection restored. Syncing data...' });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toastRef.current({ title: 'Offline', description: 'You are offline. Changes saved locally.' });
    };

    const cleanup = registerConnectivityListeners(handleOnline, handleOffline);

    refreshQueueSize();

    return cleanup;
  }, [processQueue, refreshQueueSize]);

  const addToQueue = useCallback(async (action) => {
    await queueOperation(action);
    setQueueSize(prev => prev + 1);
  }, []);

  return { isOnline, queueSize, addToQueue, processQueue };
};
