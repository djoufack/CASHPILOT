import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUseAuth,
  mockUseCompanyScope,
  mockUseToast,
  mockFrom,
  mockRpc,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockOrder,
  mockLimit,
  mockUpsert,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockUseToast: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockGte: vi.fn(),
  mockLte: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' && fallback.length > 0 ? fallback : key),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { useAccountingClosingAssistant } from '@/hooks/useAccountingClosingAssistant';

function createQueryChain(result) {
  const chain = {
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    gte: mockGte.mockReturnThis(),
    lte: mockLte.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    upsert: mockUpsert.mockReturnThis(),
  };

  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

describe('useAccountingClosingAssistant', () => {
  const toastSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
    });
    mockUseCompanyScope.mockReturnValue({
      activeCompanyId: 'company-1',
      applyCompanyScope: (query) => query,
    });
    mockUseToast.mockReturnValue({
      toast: toastSpy,
    });

    mockRpc.mockResolvedValue({
      data: 2,
      error: null,
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'accounting_depreciation_schedule') {
        return createQueryChain({
          data: null,
          count: 0,
          error: null,
        });
      }

      if (table === 'accounting_entries') {
        return createQueryChain({
          data: [
            { debit: 1000, credit: 0 },
            { debit: 0, credit: 1000 },
          ],
          error: null,
        });
      }

      if (table === 'accounting_period_closures') {
        return createQueryChain({
          data: [],
          error: null,
        });
      }

      return createQueryChain({ data: [], error: null });
    });
  });

  it('runs assisted closing and persists a closed period record', async () => {
    const { result } = renderHook(() => useAccountingClosingAssistant());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.runClosing({
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('generate_depreciation_entries', {
      p_user_id: 'user-1',
      p_date: '2026-03-31',
    });
    expect(mockFrom).toHaveBeenCalledWith('accounting_period_closures');
    expect(toastSpy).toHaveBeenCalled();
  });
});
