
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBackupSettings } from '@/hooks/useBackupSettings';
import { Button } from '@/components/ui/button';
import { HardDrive, Cloud, Download, RefreshCw, CheckCircle, XCircle, Clock, Unplug } from 'lucide-react';
import { format } from 'date-fns';

const PROVIDERS = [
  { id: 'google_drive', label: 'Google Drive', icon: Cloud },
  { id: 'dropbox', label: 'Dropbox', icon: Cloud },
];

const FREQUENCIES = [
  { id: 'daily', labelKey: 'backup.daily' },
  { id: 'weekly', labelKey: 'backup.weekly' },
  { id: 'monthly', labelKey: 'backup.monthly' },
];

const STATUS_ICONS = {
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
  in_progress: <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />,
};

const BackupSettings = () => {
  const { t } = useTranslation();
  const {
    settings,
    logs,
    loading,
    backingUp,
    saveSettings,
    connectProvider,
    disconnectProvider,
    triggerBackup,
  } = useBackupSettings();

  if (loading) {
    return <p className="text-gray-400 text-sm">{t('backup.loading')}</p>;
  }

  const isConnected = settings.provider !== 'none';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-orange-400" />
          {t('backup.title')}
        </h2>
        <p className="text-sm text-gray-400 mt-1">{t('backup.subtitle')}</p>
      </div>

      {/* Local backup */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="font-semibold text-white mb-2">{t('backup.localBackup')}</h3>
        <p className="text-sm text-gray-400 mb-4">{t('backup.localDesc')}</p>
        <Button
          onClick={() => triggerBackup('local')}
          disabled={backingUp}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          {backingUp ? t('backup.backingUp') : t('backup.downloadNow')}
        </Button>
      </div>

      {/* Cloud provider */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="font-semibold text-white mb-2">{t('backup.cloudBackup')}</h3>
        <p className="text-sm text-gray-400 mb-4">{t('backup.cloudDesc')}</p>

        {!isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="outline"
                onClick={() => connectProvider(id)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 justify-start"
              >
                <Icon className="w-4 h-4 mr-2" />
                {t('backup.connectTo', { provider: label })}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-700/50 rounded p-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">
                  {settings.provider === 'google_drive' ? 'Google Drive' : 'Dropbox'}
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                  {t('backup.connected')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnectProvider}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Unplug className="w-4 h-4 mr-1" />
                {t('backup.disconnect')}
              </Button>
            </div>

            {/* Frequency */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">{t('backup.frequency')}</label>
              <div className="flex gap-2">
                {FREQUENCIES.map(({ id, labelKey }) => (
                  <Button
                    key={id}
                    variant={settings.frequency === id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => saveSettings({ frequency: id })}
                    className={settings.frequency === id
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700'}
                  >
                    {t(labelKey)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Enable/disable */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t('backup.autoBackup')}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveSettings({ is_enabled: !settings.is_enabled })}
                className={settings.is_enabled
                  ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30'
                  : 'border-gray-600 text-gray-400 hover:bg-gray-700'}
              >
                {settings.is_enabled ? t('backup.enabled') : t('backup.disabled')}
              </Button>
            </div>

            {/* Last backup info */}
            {settings.last_backup_at && (
              <p className="text-xs text-gray-500">
                {t('backup.lastBackup')}: {format(new Date(settings.last_backup_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}

            {/* Cloud backup button */}
            <Button
              onClick={() => triggerBackup('cloud')}
              disabled={backingUp}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Cloud className="w-4 h-4 mr-2" />
              {backingUp ? t('backup.backingUp') : t('backup.backupNow')}
            </Button>
          </div>
        )}
      </div>

      {/* Backup history */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="font-semibold text-white mb-3">{t('backup.history')}</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('backup.noLogs')}</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded text-sm">
                <div className="flex items-center gap-2">
                  {STATUS_ICONS[log.status]}
                  <div>
                    <p className="text-white">{log.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {log.provider === 'local' ? t('backup.local') : log.provider === 'google_drive' ? 'Google Drive' : 'Dropbox'}
                      {' · '}
                      {log.started_at ? format(new Date(log.started_at), 'dd/MM/yyyy HH:mm') : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {log.file_size_bytes && (
                    <span className="text-xs text-gray-400">
                      {(log.file_size_bytes / 1024).toFixed(1)} KB
                    </span>
                  )}
                  {log.status === 'failed' && log.error_message && (
                    <p className="text-xs text-red-400 mt-1">{log.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupSettings;
