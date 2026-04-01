import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth, mockUseCompanyScope, mockGetSession, mockRefreshSession, mockRpc, mockFrom, mockFetch } =
  vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
    mockUseCompanyScope: vi.fn(),
    mockGetSession: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockFetch: vi.fn(),
  }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('@/lib/customSupabaseClient', () => ({
  supabaseUrl: 'https://cashpilot.example.supabase.co',
  supabaseAnonKey: 'anon-test-key',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.stubGlobal('fetch', mockFetch);

import { useCashFlowForecast } from '@/hooks/useCashFlowForecast';

describe('useCashFlowForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseCompanyScope.mockReturnValue({ activeCompanyId: 'company-1' });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });

    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-2',
        },
      },
      error: null,
    });

    mockRpc.mockImplementation((fnName) => {
      if (fnName === 'f_pilotage_ratios') {
        return Promise.resolve({
          data: {
            activity: {
              dso: 48,
              dpo: 39,
              dio: 52,
              ccc: 61,
            },
          },
          error: null,
        });
      }
      if (fnName === 'compute_cashflow_forecast') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation((tableName) => {
      if (tableName === 'company') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { country: 'FR' }, error: null }),
            })),
          })),
        };
      }

      if (tableName === 'reference_sector_benchmarks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table requested: ${tableName}`);
    });
  });

  it('refreshes session and retries once when edge function returns 401', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'JWT expired' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          starting_balance: 1000,
          ending_balance: 1800,
          total_inflows: 2500,
          total_outflows: 1700,
          period_days: 91,
          daily_projections: [],
          alerts: [],
        }),
      });

    const { result } = renderHook(() => useCashFlowForecast(91));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.forecast?.endingBalance).toBe(1800));

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
    expect(result.current.error).toBeNull();
  });

  it('refreshes session before first call when current token is expired', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'expired-token',
          expires_at: Math.floor(Date.now() / 1000) - 60,
        },
      },
      error: null,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        starting_balance: 1000,
        ending_balance: 1700,
        total_inflows: 2500,
        total_outflows: 1800,
        period_days: 91,
        daily_projections: [],
        alerts: [],
      }),
    });

    const { result } = renderHook(() => useCashFlowForecast(91));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.forecast?.endingBalance).toBe(1700));

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-2');
    expect(result.current.error).toBeNull();
  });
});
