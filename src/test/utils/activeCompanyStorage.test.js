import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getStoredActiveCompanyId,
  setStoredActiveCompanyId,
  ACTIVE_COMPANY_STORAGE_KEY,
  ACTIVE_COMPANY_EVENT,
} from '@/utils/activeCompanyStorage';

describe('activeCompanyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getStoredActiveCompanyId', () => {
    it('returns null when nothing is stored', () => {
      expect(getStoredActiveCompanyId()).toBeNull();
    });

    it('returns the stored company id', () => {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, 'comp-1');
      expect(getStoredActiveCompanyId()).toBe('comp-1');
    });
  });

  describe('setStoredActiveCompanyId', () => {
    it('stores the company id and dispatches event', () => {
      const listener = vi.fn();
      window.addEventListener(ACTIVE_COMPANY_EVENT, listener);

      setStoredActiveCompanyId('comp-2');

      expect(localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY)).toBe('comp-2');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toBe('comp-2');

      window.removeEventListener(ACTIVE_COMPANY_EVENT, listener);
    });

    it('removes from storage when set to null/falsy', () => {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, 'comp-1');

      const listener = vi.fn();
      window.addEventListener(ACTIVE_COMPANY_EVENT, listener);

      setStoredActiveCompanyId(null);

      expect(localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY)).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toBeNull();

      window.removeEventListener(ACTIVE_COMPANY_EVENT, listener);
    });

    it('does not dispatch event when value is unchanged', () => {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, 'comp-1');

      const listener = vi.fn();
      window.addEventListener(ACTIVE_COMPANY_EVENT, listener);

      setStoredActiveCompanyId('comp-1');

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener(ACTIVE_COMPANY_EVENT, listener);
    });

    it('treats empty string as null (removal)', () => {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, 'comp-1');

      setStoredActiveCompanyId('');

      expect(localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY)).toBeNull();
    });
  });
});
