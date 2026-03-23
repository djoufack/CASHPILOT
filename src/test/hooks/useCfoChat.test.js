import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { mockUseAuth, mockUseCompanyScope, mockGetSession, mockRefreshSession, mockFrom } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('@/lib/customSupabaseClient', () => ({
  supabaseUrl: 'https://cashpilot.example.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
    from: mockFrom,
  },
}));

import { useCfoChat } from '@/hooks/useCfoChat';

function createAwaitableChain(resolvedValue = { data: [], error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  chain.then = (onFulfilled, onRejected) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  return chain;
}

describe('useCfoChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'));

    mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@example.com' } });
    mockUseCompanyScope.mockReturnValue({
      activeCompanyId: 'company-1',
      applyCompanyScope: (query) => query,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'access-token-1' } },
      error: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'access-token-2' } },
      error: null,
    });
    mockFrom.mockReturnValue(createAwaitableChain({ data: [], error: null }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('times out long-running CFO requests and clears loading state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_, init) => {
        const signal = init?.signal;
        return new Promise((resolve, reject) => {
          if (signal?.aborted) {
            const aborted = new Error('Aborted');
            aborted.name = 'AbortError';
            reject(aborted);
            return;
          }
          signal?.addEventListener(
            'abort',
            () => {
              const aborted = new Error('Aborted');
              aborted.name = 'AbortError';
              reject(aborted);
            },
            { once: true }
          );
          // Never resolves unless aborted.
          void resolve;
        });
      })
    );

    const { result } = renderHook(() => useCfoChat());

    act(() => {
      void result.current.sendMessage('Quels clients ont des factures en retard ?');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(61_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);

    const assistantError = result.current.messages.find((m) => m.role === 'assistant' && m.isError);
    expect(assistantError).toBeTruthy();
    expect(assistantError.content).toMatch(/expir|timeout/i);
  });

  it('stores assistant answer and suggestions on successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          answer: 'Voici votre analyse CFO.',
          suggestions: ['Previsions de tresorerie a 30 jours ?'],
          health_score: { score: 72, factors: {} },
        }),
      })
    );

    const { result } = renderHook(() => useCfoChat());

    await act(async () => {
      await result.current.sendMessage('Fais un diagnostic');
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.messages.some((m) => m.role === 'assistant' && m.content.includes('analyse CFO'))).toBe(true);
    expect(result.current.suggestions).toEqual(['Previsions de tresorerie a 30 jours ?']);
    expect(result.current.healthScore).toEqual({ score: 72, factors: {} });
  });
});
