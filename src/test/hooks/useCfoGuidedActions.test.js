import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth, mockUseCompanyScope, mockNavigate, mockGetSession, mockFrom, mockFetch } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseCompanyScope: vi.fn(),
  mockNavigate: vi.fn(),
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: mockUseCompanyScope,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, params) => {
      const template = typeof fallback === 'string' && fallback.length > 0 ? fallback : key;
      if (!params || typeof template !== 'string') return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
        const value = params[token];
        return value == null ? '' : String(value);
      });
    },
  }),
}));

vi.mock('@/lib/customSupabaseClient', () => ({
  supabaseUrl: 'https://cashpilot.example.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

vi.stubGlobal('fetch', mockFetch);

import { buildCfoAuditAutorunUrl, useCfoGuidedActions } from '@/hooks/useCfoGuidedActions';

function createQueryChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

describe('useCfoGuidedActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T10:00:00.000Z'));

    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockUseCompanyScope.mockReturnValue({
      activeCompanyId: 'company-1',
      withCompanyScope: (payload) => ({ ...payload, company_id: 'company-1' }),
    });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'access-token-1' } },
      error: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        execution_id: 'exec-1',
      }),
      text: vi.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes the most overdue invoice through relance and reports success', async () => {
    const invoiceQuery = createQueryChain({
      data: [
        {
          id: 'inv-1',
          invoice_number: 'INV-003',
          total_ttc: 250,
          balance_due: 250,
          due_date: '2026-03-01',
          client_id: 'client-1',
          clients: { company_name: 'Acme', email: 'acme@example.com', phone: '+32123456' },
        },
      ],
      error: null,
    });
    const scenarioQuery = createQueryChain({ data: [], error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'invoices') return invoiceQuery;
      if (table === 'financial_scenarios') return scenarioQuery;
      return createQueryChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useCfoGuidedActions());

    await act(async () => {
      await result.current.guidedActions.find((action) => action.key === 'relance').run();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/dunning-execute'),
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.current.guidedActions.find((action) => action.key === 'relance').state).toBe('success');
    expect(result.current.guidedActions.find((action) => action.key === 'relance').message).toContain('INV-003');
  });

  it('surfaces relance errors when the dunning execution fails', async () => {
    const invoiceQuery = createQueryChain({
      data: [
        {
          id: 'inv-1',
          invoice_number: 'INV-003',
          total_ttc: 250,
          balance_due: 250,
          due_date: '2026-03-01',
          client_id: 'client-1',
          clients: { company_name: 'Acme', email: 'acme@example.com', phone: '+32123456' },
        },
      ],
      error: null,
    });
    mockFrom.mockImplementation((table) => {
      if (table === 'invoices') return invoiceQuery;
      return createQueryChain({ data: [], error: null });
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'boom' }),
      text: vi.fn().mockResolvedValue('boom'),
    });

    const { result } = renderHook(() => useCfoGuidedActions());

    await act(async () => {
      await result.current.guidedActions.find((action) => action.key === 'relance').run();
    });

    expect(result.current.guidedActions.find((action) => action.key === 'relance').state).toBe('error');
    expect(result.current.guidedActions.find((action) => action.key === 'relance').message).toContain('boom');
  });

  it('creates a draft scenario and navigates to it', async () => {
    const scenarioInsert = createQueryChain({
      data: { id: 'scenario-1', name: 'Scenario guide' },
      error: null,
    });
    mockFrom.mockImplementation((table) => {
      if (table === 'financial_scenarios') return scenarioInsert;
      return createQueryChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useCfoGuidedActions());

    await act(async () => {
      await result.current.guidedActions.find((action) => action.key === 'scenario').run();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/app/scenarios/scenario-1');
    expect(result.current.guidedActions.find((action) => action.key === 'scenario').state).toBe('success');
  });

  it('builds the audit autorun url from the guided action', () => {
    expect(
      buildCfoAuditAutorunUrl({
        periodStart: '2026-01-01',
        periodEnd: '2026-03-27',
      })
    ).toBe('/app/audit-comptable?autoRun=1&start=2026-01-01&end=2026-03-27');
  });
});
