import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-04-02'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  // ── exportUserData ────────────────────────────────────────────────────

  describe('exportUserData', () => {
    it('should export data for all tables', async () => {
      const result = await exportUserData('user1');
      expect(result).toHaveProperty('exported_at');
      expect(result).toHaveProperty('user_id', 'user1');
      expect(result).toHaveProperty('clients');
      expect(result).toHaveProperty('invoices');
      expect(result).toHaveProperty('expenses');
    });

    it('should handle table query errors gracefully', async () => {
      const { supabase } = await import('@/lib/customSupabaseClient');
      supabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      }));

      const result = await exportUserData('user1');
      // Should not throw, tables with errors get empty arrays
      expect(result).toHaveProperty('user_id', 'user1');
    });
  });

  // ── createBackupFile ──────────────────────────────────────────────────

  describe('createBackupFile', () => {
    it('should return blob, fileName, and sizeBytes', () => {
      const data = { user_id: 'user1', clients: [{ name: 'Test' }] };
      const result = createBackupFile(data);
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('sizeBytes');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.fileName).toContain('CashPilot_Backup_');
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('should create valid JSON blob', () => {
      const data = { test: true };
      const result = createBackupFile(data);
      expect(result.blob.type).toBe('application/json');
    });
  });

  // ── downloadBackup ────────────────────────────────────────────────────

  describe('downloadBackup', () => {
    it('should create download link and trigger click', () => {
      const blob = new Blob(['{}'], { type: 'application/json' });
      downloadBackup(blob, 'test.json');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  // ── initiateGoogleDriveAuth ───────────────────────────────────────────

  describe('initiateGoogleDriveAuth', () => {
    it('should call the correct edge function endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://accounts.google.com/oauth' }),
      });

      const result = await initiateGoogleDriveAuth('user1');
      expect(result).toBe('https://accounts.google.com/oauth');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/backup-oauth-google',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Auth failed' }),
      });

      await expect(initiateGoogleDriveAuth('user1')).rejects.toThrow('Auth failed');
    });

    it('should handle non-JSON error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('not json')),
      });

      await expect(initiateGoogleDriveAuth('user1')).rejects.toThrow('OAuth initiation failed');
    });
  });

  // ── initiateDropboxAuth ───────────────────────────────────────────────

  describe('initiateDropboxAuth', () => {
    it('should call the correct edge function endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://www.dropbox.com/oauth2' }),
      });

      const result = await initiateDropboxAuth('user1');
      expect(result).toBe('https://www.dropbox.com/oauth2');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/backup-oauth-dropbox',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Dropbox auth failed' }),
      });

      await expect(initiateDropboxAuth('user1')).rejects.toThrow('Dropbox auth failed');
    });
  });

  // ── uploadToCloud ─────────────────────────────────────────────────────

  describe('uploadToCloud', () => {
    it('should upload backup data to the cloud', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, fileId: 'abc123' }),
      });

      const result = await uploadToCloud('user1', 'google_drive', { test: true });
      expect(result).toHaveProperty('success', true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/backup-upload',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw on upload failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Upload failed' }),
      });

      await expect(uploadToCloud('user1', 'dropbox', {})).rejects.toThrow('Upload failed');
    });
  });
});
