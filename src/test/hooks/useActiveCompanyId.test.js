import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Hoisted mock ───────────────────────────────────────────────────────────

const { mockGetStoredActiveCompanyId } = vi.hoisted(() => ({
  mockGetStoredActiveCompanyId: vi.fn(() => 'comp-initial'),
}));

vi.mock('@/utils/activeCompanyStorage', () => ({
  ACTIVE_COMPANY_EVENT: 'cashpilot:active-company-changed',
  ACTIVE_COMPANY_STORAGE_KEY: 'cashpilot.activeCompanyId',
  getStoredActiveCompanyId: mockGetStoredActiveCompanyId,
}));

// ── Import under test ──────────────────────────────────────────────────────
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';

describe('useActiveCompanyId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoredActiveCompanyId.mockReturnValue('comp-initial');
  });

  it('returns the stored active company id on mount', () => {
    const { result } = renderHook(() => useActiveCompanyId());
    expect(result.current).toBe('comp-initial');
  });

  it('updates when custom event is dispatched', () => {
    const { result } = renderHook(() => useActiveCompanyId());
    expect(result.current).toBe('comp-initial');

    act(() => {
      window.dispatchEvent(new CustomEvent('cashpilot:active-company-changed', { detail: 'comp-new' }));
    });

    expect(result.current).toBe('comp-new');
  });

  it('updates when storage event fires with matching key', () => {
    const { result } = renderHook(() => useActiveCompanyId());

    act(() => {
      // StorageEvent requires initialization via constructor
      const event = new StorageEvent('storage', {
        key: 'cashpilot.activeCompanyId',
        newValue: 'comp-storage',
      });
      window.dispatchEvent(event);
    });

    expect(result.current).toBe('comp-storage');
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useActiveCompanyId());

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'should-not-apply',
      });
      window.dispatchEvent(event);
    });

    expect(result.current).toBe('comp-initial');
  });

  it('falls back to getStoredActiveCompanyId when event has no detail', () => {
    mockGetStoredActiveCompanyId.mockReturnValue('comp-fallback');
    const { result } = renderHook(() => useActiveCompanyId());

    act(() => {
      window.dispatchEvent(new CustomEvent('cashpilot:active-company-changed', { detail: undefined }));
    });

    expect(result.current).toBe('comp-fallback');
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useActiveCompanyId());

    expect(addSpy).toHaveBeenCalledWith('cashpilot:active-company-changed', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('cashpilot:active-company-changed', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
