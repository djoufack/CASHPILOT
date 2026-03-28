import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth, mockUseCompanyScope, mockGetSession, mockRefreshSession, mockFetch } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
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
  },
}));

vi.stubGlobal('fetch', mockFetch);

import { useCfoWeeklyBriefing } from '@/hooks/useCfoWeeklyBriefing';

describe('useCfoWeeklyBriefing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const withCompanyScope = vi.fn((payload) => ({ ...payload, company_id: 'company-1' }));
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseCompanyScope.mockReturnValue({
      activeCompanyId: 'company-1',
      withCompanyScope,
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
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

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        generated_now: true,
        briefing: {
          company_id: 'company-1',
          company_name: 'Acme SARL',
          week_start: '2026-03-23',
          generated_at: '2026-03-27T10:00:00.000Z',
          briefing_text: 'Briefing hebdomadaire.',
          briefing_json: { summary: { health_score: 71 } },
        },
      }),
    });
  });

  it('loads the weekly briefing automatically and refreshes from cache without changing week timestamp', async () => {
    const { result } = renderHook(() => useCfoWeeklyBriefing());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/cfo-weekly-briefing'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    await waitFor(() => expect(result.current.generatedNow).toBe(true));
    expect(result.current.briefing).toEqual(
      expect.objectContaining({
        company_name: 'Acme SARL',
        generated_at: '2026-03-27T10:00:00.000Z',
      })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        generated_now: false,
        briefing: {
          company_id: 'company-1',
          company_name: 'Acme SARL',
          week_start: '2026-03-23',
          generated_at: '2026-03-27T10:00:00.000Z',
          briefing_text: 'Briefing hebdomadaire.',
          briefing_json: { summary: { health_score: 71 } },
        },
      }),
    });

    await act(async () => {
      await result.current.refreshBriefing();
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.generatedNow).toBe(false));
    expect(result.current.briefing.week_start).toBe('2026-03-23');
  });
});
