import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockUser, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockUser: { id: 'user-1' },
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { useAuth } from '@/contexts/AuthContext';
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate';

function createTaxRateChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

describe('useDefaultTaxRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty state when user is not present', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useDefaultTaxRate());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.defaultRate).toBe(0);
    expect(result.current.taxRates).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('loads rates and normalizes percentages', async () => {
    const ratesResult = {
      data: [
        { id: 't1', rate: 0.2, is_default: true },
        { id: 't2', rate: 5.5, is_default: false },
      ],
      error: null,
    };
    mockFrom.mockReturnValue(createTaxRateChain(ratesResult));
    mockRpc.mockResolvedValue({ data: 0.055, error: null });

    const { result } = renderHook(() => useDefaultTaxRate());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.defaultRate).toBe(5.5);
    expect(result.current.taxRates).toEqual([
      { id: 't1', rate: 20, is_default: true },
      { id: 't2', rate: 5.5, is_default: false },
    ]);
    expect(mockFrom).toHaveBeenCalledWith('accounting_tax_rates');
    expect(mockRpc).toHaveBeenCalledWith('get_default_tax_rate', { target_user_id: 'user-1' });
  });

  it('falls back safely when tax rates query fails', async () => {
    mockFrom.mockReturnValue(
      createTaxRateChain({
        data: null,
        error: new Error('rates-failed'),
      })
    );
    mockRpc.mockResolvedValue({ data: 20, error: null });

    const { result } = renderHook(() => useDefaultTaxRate());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.defaultRate).toBe(0);
    expect(result.current.taxRates).toEqual([]);
  });

  it('falls back safely when default-rate RPC fails', async () => {
    mockFrom.mockReturnValue(
      createTaxRateChain({
        data: [{ id: 't1', rate: 0.2, is_default: true }],
        error: null,
      })
    );
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('rpc-failed'),
    });

    const { result } = renderHook(() => useDefaultTaxRate());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.defaultRate).toBe(0);
    expect(result.current.taxRates).toEqual([]);
  });
});
