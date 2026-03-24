import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSupabaseQuery } from '../useSupabaseQuery';

describe('useSupabaseQuery', () => {
  it('returns loading=true initially when enabled', async () => {
    const queryFn = vi.fn(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSupabaseQuery(queryFn));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns data after successful fetch', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    const queryFn = vi.fn(async () => mockData);

    const { result } = renderHook(() => useSupabaseQuery(queryFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('returns error on failure', async () => {
    const queryFn = vi.fn(async () => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useSupabaseQuery(queryFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toEqual([]);
  });

  it('skips fetch when enabled=false', async () => {
    const queryFn = vi.fn(async () => [{ id: 1 }]);

    const { result } = renderHook(() => useSupabaseQuery(queryFn, { enabled: false }));

    // Should never start loading
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('triggers fetch when enabled switches from false to true even if deps do not change', async () => {
    const queryFn = vi.fn(async () => [{ id: 99 }]);

    const { result, rerender } = renderHook(({ enabled }) => useSupabaseQuery(queryFn, { enabled, deps: [] }), {
      initialProps: { enabled: false },
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([{ id: 99 }]);
  });

  it('refetch triggers a new fetch and returns data', async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      return [{ id: callCount }];
    });

    const { result } = renderHook(() => useSupabaseQuery(queryFn));

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual([{ id: 1 }]);

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual([{ id: 2 }]);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
