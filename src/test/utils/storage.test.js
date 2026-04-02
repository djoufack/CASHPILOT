import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/storage';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // safeGetItem
  // ==========================================================================
  describe('safeGetItem', () => {
    it('returns stored value', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(safeGetItem('test-key')).toBe('test-value');
    });

    it('returns null for missing key', () => {
      expect(safeGetItem('nonexistent')).toBeNull();
    });

    it('returns default value for missing key when provided', () => {
      expect(safeGetItem('nonexistent', 'fallback')).toBe('fallback');
    });

    it('returns actual value even when default is provided', () => {
      localStorage.setItem('exists', 'real');
      expect(safeGetItem('exists', 'fallback')).toBe('real');
    });

    it('returns default value when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(safeGetItem('key', 'safe')).toBe('safe');
    });

    it('returns null when localStorage throws and no default', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      expect(safeGetItem('key')).toBeNull();
    });
  });

  // ==========================================================================
  // safeSetItem
  // ==========================================================================
  describe('safeSetItem', () => {
    it('stores a value in localStorage', () => {
      safeSetItem('my-key', 'my-value');
      expect(localStorage.getItem('my-key')).toBe('my-value');
    });

    it('overwrites existing value', () => {
      localStorage.setItem('key', 'old');
      safeSetItem('key', 'new');
      expect(localStorage.getItem('key')).toBe('new');
    });

    it('does not throw when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      expect(() => safeSetItem('key', 'value')).not.toThrow();
    });
  });

  // ==========================================================================
  // safeRemoveItem
  // ==========================================================================
  describe('safeRemoveItem', () => {
    it('removes a key from localStorage', () => {
      localStorage.setItem('to-remove', 'value');
      safeRemoveItem('to-remove');
      expect(localStorage.getItem('to-remove')).toBeNull();
    });

    it('does not throw for nonexistent key', () => {
      expect(() => safeRemoveItem('missing')).not.toThrow();
    });

    it('does not throw when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => safeRemoveItem('key')).not.toThrow();
    });
  });
});
