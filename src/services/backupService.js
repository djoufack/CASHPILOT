/**
 * Backup Service
 * Handles data export and upload to cloud providers (Google Drive / Dropbox).
 * OAuth flows and actual uploads should go through Supabase Edge Functions for security.
 * This client-side module provides the interface.
 */

import { supabase } from '@/lib/supabase';

/**
 * Export all user data as a JSON object
 * @param {string} userId
 * @returns {Promise<Object>} Full data export
 */
export const exportUserData = async (userId) => {
  if (!supabase) throw new Error('Supabase not initialized');

  const tables = [
    'clients',
    'invoices',
    'invoice_items',
    'timesheets',
    'payments',
    'payment_allocations',
    'expenses',
    'suppliers',
    'chart_of_accounts',
    'accounting_mappings',
    'tax_rates',
    'user_credits',
    'credit_transactions',
    'invoice_settings',
  ];

  const data = { exported_at: new Date().toISOString(), user_id: userId };

  for (const table of tables) {
    try {
      const { data: rows, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);
      if (!error) {
        data[table] = rows || [];
      }
    } catch {
      // Table might not exist yet, skip
      data[table] = [];
    }
  }

  return data;
};

/**
 * Create a downloadable JSON backup file
 * @param {Object} data - Export data
 * @returns {{ blob: Blob, fileName: string }}
 */
export const createBackupFile = (data) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `CashPilot_Backup_${date}.json`;
  return { blob, fileName, sizeBytes: blob.size };
};

/**
 * Trigger a local download of the backup
 * @param {Blob} blob
 * @param {string} fileName
 */
export const downloadBackup = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Initiate Google Drive OAuth flow via Supabase Edge Function
 * @param {string} userId
 * @returns {Promise<string>} OAuth URL to redirect to
 */
export const initiateGoogleDriveAuth = async (userId) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const response = await fetch(`${supabaseUrl}/functions/v1/backup-oauth-google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      userId,
      redirectUrl: `${window.location.origin}/settings?tab=backup&provider=google_drive`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'OAuth initiation failed' }));
    throw new Error(error.message || 'Failed to start Google Drive authorization');
  }

  const result = await response.json();
  return result.authUrl;
};

/**
 * Initiate Dropbox OAuth flow via Supabase Edge Function
 * @param {string} userId
 * @returns {Promise<string>} OAuth URL to redirect to
 */
export const initiateDropboxAuth = async (userId) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const response = await fetch(`${supabaseUrl}/functions/v1/backup-oauth-dropbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      userId,
      redirectUrl: `${window.location.origin}/settings?tab=backup&provider=dropbox`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'OAuth initiation failed' }));
    throw new Error(error.message || 'Failed to start Dropbox authorization');
  }

  const result = await response.json();
  return result.authUrl;
};

/**
 * Upload backup to cloud provider via Supabase Edge Function
 * @param {string} userId
 * @param {string} provider - 'google_drive' or 'dropbox'
 * @param {Object} backupData - The data to backup
 * @returns {Promise<Object>} Upload result
 */
export const uploadToCloud = async (userId, provider, backupData) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Supabase URL not configured');

  const { fileName } = createBackupFile(backupData);

  const response = await fetch(`${supabaseUrl}/functions/v1/backup-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      userId,
      provider,
      fileName,
      data: backupData,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload backup');
  }

  return response.json();
};
