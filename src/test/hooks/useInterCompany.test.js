import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted state ──────────────────────────────────────────────────────────

const { mockToast, mockUser, mockFromFn, mockFunctionsInvoke, mockApplyCompanyScope, mockWithCompanyScope } =
  vi.hoisted(() => {
    const mockToast = vi.fn();
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockFromFn = vi.fn();
    const mockFunctionsInvoke = vi
      .fn()
      .mockResolvedValue({ data: { success: true, mirror_invoice_number: 'INV-M1' }, error: null });
    const mockActiveCompanyId = 'comp-1';
    const mockApplyCompanyScope = vi.fn((query) => query);
    const mockWithCompanyScope = vi.fn((payload) => ({
      ...payload,
      company_id: mockActiveCompanyId,
    }));
    return { mockToast, mockUser, mockFromFn, mockFunctionsInvoke, mockApplyCompanyScope, mockWithCompanyScope };
  });

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: () => ({
    activeCompanyId: 'comp-1',
    applyCompanyScope: mockApplyCompanyScope,
    withCompanyScope: mockWithCompanyScope,
  }),
}));

vi.mock('@/utils/dateLocale', () => ({
  formatNumber: vi.fn((v) => String(v)),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: mockFromFn,
    functions: { invoke: mockFunctionsInvoke },
    storage: { from: vi.fn() },
  },
  validateSupabaseConfig: vi.fn(() => ({ valid: true, missing: [] })),
}));

// ── Import under test ──────────────────────────────────────────────────────
import { useInterCompany, buildEliminationPeriods } from '@/hooks/useInterCompany';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────

function createChain(resolvedValue = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (onFulfilled) => Promise.resolve(resolvedValue).then(onFulfilled);
  return chain;
}

let chainsByTable;

function setupFromMock() {
  mockFromFn.mockImplementation((table) => {
    if (!chainsByTable[table]) {
      chainsByTable[table] = createChain();
    }
    return chainsByTable[table];
  });
}

// ── Tests: buildEliminationPeriods (pure function) ─────────────────────────

describe('buildEliminationPeriods', () => {
  it('groups synced transactions by month and returns sorted periods', () => {
    const periods = buildEliminationPeriods([
      { id: 'tx-1', status: 'synced', created_at: '2026-02-20T08:00:00.000Z' },
      { id: 'tx-2', status: 'synced', created_at: '2026-02-24T08:00:00.000Z' },
      { id: 'tx-3', status: 'synced', created_at: '2026-03-02T08:00:00.000Z' },
      { id: 'tx-4', status: 'eliminated', created_at: '2026-03-10T08:00:00.000Z' },
    ]);

    expect(periods).toEqual([
      { key: '2026-02', periodStart: '2026-02-01', periodEnd: '2026-02-28' },
      { key: '2026-03', periodStart: '2026-03-01', periodEnd: '2026-03-31' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(buildEliminationPeriods([])).toEqual([]);
    expect(buildEliminationPeriods(undefined)).toEqual([]);
  });

  it('ignores transactions without synced status', () => {
    const periods = buildEliminationPeriods([
      { id: 'tx-1', status: 'pending', created_at: '2026-01-15T00:00:00Z' },
      { id: 'tx-2', status: 'eliminated', created_at: '2026-01-20T00:00:00Z' },
    ]);
    expect(periods).toEqual([]);
  });

  it('ignores transactions without created_at', () => {
    const periods = buildEliminationPeriods([{ id: 'tx-1', status: 'synced', created_at: null }]);
    expect(periods).toEqual([]);
  });

  it('deduplicates same-month transactions', () => {
    const periods = buildEliminationPeriods([
      { id: 'tx-1', status: 'synced', created_at: '2026-05-01T00:00:00Z' },
      { id: 'tx-2', status: 'synced', created_at: '2026-05-31T00:00:00Z' },
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0].key).toBe('2026-05');
  });
});

// ── Tests: useInterCompany hook ────────────────────────────────────────────

describe('useInterCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainsByTable = {};
    setupFromMock();
    useAuth.mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the expected hook shape', async () => {
    const { result } = renderHook(() => useInterCompany());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('links');
    expect(result.current).toHaveProperty('transactions');
    expect(result.current).toHaveProperty('pricingRules');
    expect(result.current).toHaveProperty('eliminations');
    expect(result.current).toHaveProperty('loading');
    expect(typeof result.current.fetchData).toBe('function');
    expect(typeof result.current.createLink).toBe('function');
    expect(typeof result.current.toggleLink).toBe('function');
    expect(typeof result.current.deleteLink).toBe('function');
    expect(typeof result.current.syncInvoice).toBe('function');
    expect(typeof result.current.updatePricingRule).toBe('function');
    expect(typeof result.current.deletePricingRule).toBe('function');
    expect(typeof result.current.computeEliminations).toBe('function');
    expect(typeof result.current.autoComputeEliminations).toBe('function');
  });

  it('initializes with empty arrays', async () => {
    const { result } = renderHook(() => useInterCompany());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.links).toEqual([]);
    expect(result.current.transactions).toEqual([]);
    expect(result.current.pricingRules).toEqual([]);
    expect(result.current.eliminations).toEqual([]);
  });

  it('fetches links with enriched company names', async () => {
    const linksData = [{ id: 'link-1', company_id: 'comp-1', linked_company_id: 'comp-2', user_id: 'user-1' }];
    const companiesData = [
      { id: 'comp-1', name: 'Company A' },
      { id: 'comp-2', name: 'Company B' },
    ];

    // Separate chain behavior per table
    mockFromFn.mockImplementation((table) => {
      if (table === 'intercompany_links') return createChain({ data: linksData, error: null });
      if (table === 'intercompany_transactions') return createChain({ data: [], error: null });
      if (table === 'transfer_pricing_rules') return createChain({ data: [], error: null });
      if (table === 'intercompany_eliminations') return createChain({ data: [], error: null });
      if (table === 'company') return createChain({ data: companiesData, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useInterCompany());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0].company_name).toBe('Company A');
    expect(result.current.links[0].linked_company_name).toBe('Company B');
  });

  it('createLink inserts and refreshes data', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newLink = { id: 'link-new', company_id: 'comp-1', linked_company_id: 'comp-3' };

    mockFromFn.mockImplementation((table) => {
      if (table === 'intercompany_links') return createChain({ data: newLink, error: null });
      return createChain();
    });

    await act(async () => {
      const data = await result.current.createLink({
        linked_company_id: 'comp-3',
        link_type: 'both',
      });
      expect(data).toEqual(newLink);
    });
  });

  it('createLink returns null when user is null', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const data = await result.current.createLink({ linked_company_id: 'comp-3' });
      expect(data).toBeNull();
    });
  });

  it('toggleLink updates active status', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedLink = { id: 'link-1', is_active: false };
    mockFromFn.mockImplementation((table) => {
      if (table === 'intercompany_links') return createChain({ data: updatedLink, error: null });
      return createChain();
    });

    await act(async () => {
      const data = await result.current.toggleLink('link-1', false);
      expect(data).toEqual(updatedLink);
    });
  });

  it('deleteLink removes and refreshes', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const delChain = createChain({ error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'intercompany_links') return delChain;
      return createChain();
    });

    await act(async () => {
      await result.current.deleteLink('link-1');
    });

    // Should not have thrown
    expect(delChain.delete).toHaveBeenCalled();
  });

  it('syncInvoice calls edge function and refreshes', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const data = await result.current.syncInvoice('comp-1', 'comp-2', 'inv-1');
      expect(data.success).toBe(true);
      expect(data.mirror_invoice_number).toBe('INV-M1');
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('intercompany-sync', {
      body: {
        source_company_id: 'comp-1',
        target_company_id: 'comp-2',
        invoice_id: 'inv-1',
      },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Synchronisation reussie' }));
  });

  it('syncInvoice throws on error', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'Sync failed' } });

    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.syncInvoice('comp-1', 'comp-2', 'inv-1');
      })
    ).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('updatePricingRule creates new rule when no id', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newRule = { id: 'rule-new', service_type: 'consulting', pricing_method: 'cost_plus' };
    mockFromFn.mockImplementation((table) => {
      if (table === 'transfer_pricing_rules') return createChain({ data: newRule, error: null });
      return createChain();
    });

    await act(async () => {
      const data = await result.current.updatePricingRule({
        service_type: 'consulting',
        margin_percent: 15,
      });
      expect(data).toEqual(newRule);
    });
  });

  it('updatePricingRule updates existing rule when id provided', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedRule = { id: 'rule-1', service_type: 'IT', margin_percent: 20 };
    mockFromFn.mockImplementation((table) => {
      if (table === 'transfer_pricing_rules') return createChain({ data: updatedRule, error: null });
      return createChain();
    });

    await act(async () => {
      const data = await result.current.updatePricingRule({
        id: 'rule-1',
        service_type: 'IT',
        margin_percent: 20,
      });
      expect(data).toEqual(updatedRule);
    });
  });

  it('deletePricingRule removes rule and refreshes', async () => {
    const { result } = renderHook(() => useInterCompany());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const delChain = createChain({ error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'transfer_pricing_rules') return delChain;
      return createChain();
    });

    await act(async () => {
      await result.current.deletePricingRule('rule-1');
    });

    expect(delChain.delete).toHaveBeenCalled();
  });
});
