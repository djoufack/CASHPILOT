
import { useState, useEffect, useRef } from 'react';
import { openDB } from 'idb';
import { useToast } from '@/components/ui/use-toast';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    initDB();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initDB = async () => {
    const db = await openDB('CashPilotDB', 1, {
      upgrade(db) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      },
    });
    const count = await db.count('syncQueue');
    setQueueSize(count);
  };

  const addToQueue = async (action) => {
    const db = await openDB('CashPilotDB', 1);
    await db.add('syncQueue', { ...action, createdAt: Date.now() });
    setQueueSize(prev => prev + 1);
  };

  const processQueue = async () => {
    const db = await openDB('CashPilotDB', 1);
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const items = await store.getAll();

    for (const item of items) {
      try {
        // Here you would implement the actual sync logic based on item.type/payload
        // console.log("Syncing item:", item);
        await store.delete(item.id);
      } catch (err) {
        console.error("Sync failed for item", item, err);
      }
    }
    await tx.done;
    const count = await db.count('syncQueue');
    setQueueSize(count);
  };

  return { isOnline, queueSize, addToQueue, processQueue };
};
