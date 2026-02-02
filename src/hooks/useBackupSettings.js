import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import {
  exportUserData,
  createBackupFile,
  downloadBackup,
  uploadToCloud,
  initiateGoogleDriveAuth,
  initiateDropboxAuth,
} from '@/services/backupService';

const DEFAULT_SETTINGS = {
  provider: 'none',
  is_enabled: false,
  frequency: 'weekly',
  last_backup_at: null,
  next_backup_at: null,
  folder_name: 'CashPilot Backups',
};

export const useBackupSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('backup_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No row yet
        setSettings(DEFAULT_SETTINGS);
      } else if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching backup settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchLogs = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data } = await supabase
        .from('backup_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20);
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching backup logs:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, [fetchSettings, fetchLogs]);

  const saveSettings = async (updates) => {
    if (!user || !supabase) return;
    try {
      const newSettings = { ...settings, ...updates, user_id: user.id, updated_at: new Date().toISOString() };

      const { error } = await supabase
        .from('backup_settings')
        .upsert(newSettings, { onConflict: 'user_id' });

      if (error) throw error;

      setSettings(newSettings);
      toast({ title: t('common.success'), description: t('backup.settingsSaved') });
    } catch (err) {
      console.error('Error saving backup settings:', err);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const connectProvider = async (provider) => {
    if (!user) return;
    try {
      let authUrl;
      if (provider === 'google_drive') {
        authUrl = await initiateGoogleDriveAuth(user.id);
      } else if (provider === 'dropbox') {
        authUrl = await initiateDropboxAuth(user.id);
      }
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const disconnectProvider = async () => {
    await saveSettings({
      provider: 'none',
      is_enabled: false,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      folder_id: null,
    });
  };

  /**
   * Trigger a manual backup
   * @param {'local' | 'cloud'} target
   */
  const triggerBackup = async (target = 'local') => {
    if (!user) return;
    setBackingUp(true);

    try {
      const data = await exportUserData(user.id);
      const { blob, fileName, sizeBytes } = createBackupFile(data);

      if (target === 'local') {
        downloadBackup(blob, fileName);

        // Log local backup
        if (supabase) {
          await supabase.from('backup_logs').insert([{
            user_id: user.id,
            provider: 'local',
            status: 'success',
            file_name: fileName,
            file_size_bytes: sizeBytes,
            completed_at: new Date().toISOString(),
          }]);
        }

        toast({ title: t('common.success'), description: t('backup.downloadComplete') });
      } else if (target === 'cloud' && settings.provider !== 'none') {
        // Log start
        const logEntry = {
          user_id: user.id,
          provider: settings.provider,
          status: 'in_progress',
          file_name: fileName,
          file_size_bytes: sizeBytes,
        };

        let logId;
        if (supabase) {
          const { data: logData } = await supabase
            .from('backup_logs')
            .insert([logEntry])
            .select()
            .single();
          logId = logData?.id;
        }

        try {
          await uploadToCloud(user.id, settings.provider, data);

          // Update log as success
          if (supabase && logId) {
            await supabase
              .from('backup_logs')
              .update({ status: 'success', completed_at: new Date().toISOString() })
              .eq('id', logId);
          }

          // Update last_backup_at
          await saveSettings({ last_backup_at: new Date().toISOString() });
          toast({ title: t('common.success'), description: t('backup.cloudComplete') });
        } catch (uploadErr) {
          // Update log as failed
          if (supabase && logId) {
            await supabase
              .from('backup_logs')
              .update({ status: 'failed', error_message: uploadErr.message, completed_at: new Date().toISOString() })
              .eq('id', logId);
          }
          throw uploadErr;
        }
      }

      await fetchLogs();
    } catch (err) {
      console.error('Backup error:', err);
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setBackingUp(false);
    }
  };

  return {
    settings,
    logs,
    loading,
    backingUp,
    saveSettings,
    connectProvider,
    disconnectProvider,
    triggerBackup,
    fetchLogs,
  };
};
