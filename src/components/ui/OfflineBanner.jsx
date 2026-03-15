import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

/**
 * OfflineBanner — Displays connectivity status and sync progress.
 * Shows:
 *  - Orange banner when offline
 *  - Blue banner when syncing
 *  - Green banner on sync success (auto-hides after 3s)
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, queueSize, syncStatus } = useOfflineStorage();
  const [showSuccess, setShowSuccess] = useState(false);
  const [prevSyncStatus, setPrevSyncStatus] = useState(syncStatus);

  // Detect sync completion to show success banner briefly
  useEffect(() => {
    if (prevSyncStatus === 'syncing' && syncStatus === 'idle' && isOnline) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevSyncStatus(syncStatus);
  }, [syncStatus, isOnline, prevSyncStatus]);

  // Nothing to show when online, idle, and no success
  if (isOnline && syncStatus === 'idle' && !showSuccess) return null;

  // Determine banner state
  let bgClass = '';
  let Icon = WifiOff;
  let message = '';

  if (!isOnline) {
    bgClass = 'bg-amber-600/90 border-amber-500/50';
    Icon = WifiOff;
    message = t('offline.banner_offline', 'Mode hors-ligne');
  } else if (syncStatus === 'syncing') {
    bgClass = 'bg-blue-600/90 border-blue-500/50';
    Icon = RefreshCw;
    message = t('offline.banner_syncing', 'Synchronisation en cours...');
  } else if (syncStatus === 'error') {
    bgClass = 'bg-red-600/90 border-red-500/50';
    Icon = WifiOff;
    message = t('offline.banner_error', 'Erreur de synchronisation');
  } else if (showSuccess) {
    bgClass = 'bg-emerald-600/90 border-emerald-500/50';
    Icon = CheckCircle;
    message = t('offline.banner_synced', 'Synchronisation terminee');
  }

  if (!message) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white border-b backdrop-blur-sm transition-all duration-300 ${bgClass}`}
    >
      <Icon className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{message}</span>
      {queueSize > 0 && (
        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {t('offline.queue_count', '{{count}} operations en attente', { count: queueSize })}
        </span>
      )}
    </div>
  );
}
