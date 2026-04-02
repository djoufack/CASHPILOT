import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/storage', () => ({
  safeGetItem: vi.fn(),
  safeSetItem: vi.fn(),
  safeRemoveItem: vi.fn(),
}));

import {
  getStoredActiveCompanyId,
  setStoredActiveCompanyId,
  ACTIVE_COMPANY_STORAGE_KEY,
  ACTIVE_COMPANY_EVENT,
} from '@/utils/activeCompanyStorage';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/storage';

describe('activeCompanyStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Constants
  // ==========================================================================
  describe('constants', () => {
    it('exports the expected storage key', () => {
      expect(ACTIVE_COMPANY_STORAGE_KEY).toBe('cashpilot.activeCompanyId');
    });

    it('exports the expected custom event name', () => {
      expect(ACTIVE_COMPANY_EVENT).toBe('cashpilot:active-company-changed');
    });
  });

  // ==========================================================================
  // getStoredActiveCompanyId
  // ==========================================================================
  describe('getStoredActiveCompanyId', () => {
    it('returns stored company id when present', () => {
      safeGetItem.mockReturnValue('company-abc-123');
      const result = getStoredActiveCompanyId();
      expect(result).toBe('company-abc-123');
      expect(safeGetItem).toHaveBeenCalledWith(ACTIVE_COMPANY_STORAGE_KEY);
    });

    it('returns null when no company id is stored', () => {
      safeGetItem.mockReturnValue(null);
      expect(getStoredActiveCompanyId()).toBeNull();
    });
  });

  // ==========================================================================
  // setStoredActiveCompanyId
  // ==========================================================================
  describe('setStoredActiveCompanyId', () => {
    it('stores a new company id and dispatches event', () => {
      safeGetItem.mockReturnValue(null);
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      setStoredActiveCompanyId('company-xyz');

      expect(safeSetItem).toHaveBeenCalledWith(ACTIVE_COMPANY_STORAGE_KEY, 'company-xyz');
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0][0];
      expect(event.type).toBe(ACTIVE_COMPANY_EVENT);
      expect(event.detail).toBe('company-xyz');
      dispatchSpy.mockRestore();
    });

    it('removes key and dispatches null when called with falsy value', () => {
      safeGetItem.mockReturnValue('old-company');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      setStoredActiveCompanyId(null);

      expect(safeRemoveItem).toHaveBeenCalledWith(ACTIVE_COMPANY_STORAGE_KEY);
      expect(safeSetItem).not.toHaveBeenCalled();
      const event = dispatchSpy.mock.calls[0][0];
      expect(event.detail).toBeNull();
      dispatchSpy.mockRestore();
    });

    it('does not dispatch event when value has not changed', () => {
      safeGetItem.mockReturnValue('same-company');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      setStoredActiveCompanyId('same-company');

      expect(safeSetItem).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });

    it('removes key when empty string is passed', () => {
      safeGetItem.mockReturnValue('old');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      setStoredActiveCompanyId('');

      expect(safeRemoveItem).toHaveBeenCalledWith(ACTIVE_COMPANY_STORAGE_KEY);
      dispatchSpy.mockRestore();
    });
  });
});
