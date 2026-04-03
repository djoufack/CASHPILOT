import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({ formatDateInput: vi.fn(() => '2026-04-02') }));
vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
    })),
  },
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

global.fetch = vi.fn();

import {
  exportUserData,
  createBackupFile,
  downloadBackup,
  initiateGoogleDriveAuth,
  initiateDropboxAuth,
  uploadToCloud,
} from '@/services/backupService';

describe('backupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  describe('exportUserData', () => {
    it('exports data for all tables', async () => {
      const result = await exportUserData('user1');
      expect(result).toHaveProperty('user_id', 'user1');
      expect(result).toHaveProperty('clients');
    });
  });

  describe('createBackupFile', () => {
    it('returns blob, fileName, sizeBytes', () => {
      const result = createBackupFile({ test: true });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.fileName).toContain('CashPilot_Backup_');
      expect(result.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('downloadBackup', () => {
    it('triggers download', () => {
      downloadBackup(new Blob(['{}'], { type: 'application/json' }), 'test.json');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('initiateGoogleDriveAuth', () => {
    it('returns auth URL on success', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://google.com/oauth' }),
      });
      const result = await initiateGoogleDriveAuth('user1');
      expect(result).toBe('https://google.com/oauth');
    });
    it('throws on HTTP error', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Auth failed' }) });
      await expect(initiateGoogleDriveAuth('user1')).rejects.toThrow('Auth failed');
    });
  });

  describe('initiateDropboxAuth', () => {
    it('returns auth URL on success', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://dropbox.com/oauth' }),
      });
      const result = await initiateDropboxAuth('user1');
      expect(result).toBe('https://dropbox.com/oauth');
    });
    it('throws on HTTP error', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Failed' }) });
      await expect(initiateDropboxAuth('user1')).rejects.toThrow('Failed');
    });
  });

  describe('uploadToCloud', () => {
    it('uploads and returns result', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      const result = await uploadToCloud('user1', 'google_drive', { test: true });
      expect(result.success).toBe(true);
    });
    it('throws on failure', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Upload failed' }) });
      await expect(uploadToCloud('user1', 'dropbox', {})).rejects.toThrow('Upload failed');
    });
  });
});
