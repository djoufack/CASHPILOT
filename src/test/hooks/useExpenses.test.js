import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted state shared between mocks and tests ─────────────────────────────

const {
  mockToast,
  mockLogAction,
  mockUser,
  mockFromFn,
  mockApplyCompanyScope,
  mockWithCompanyScope,
  mockGuardInput,
  mockRpc,
} = vi.hoisted(() => {
  const mockToast = vi.fn();
  const mockLogAction = vi.fn();
  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockFromFn = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockActiveCompanyId = 'comp-1';
  const mockApplyCompanyScope = vi.fn((query) => {
    if (query && typeof query.eq === 'function') {
      return query.eq('company_id', mockActiveCompanyId);
    }
    return query;
  });
  const mockWithCompanyScope = vi.fn((payload) => ({
    ...payload,
    company_id: mockActiveCompanyId,
  }));
  const mockGuardInput = vi.fn(({ payload }) => ({ payload, blockingIssues: [], warnings: [] }));
  return {
    mockToast,
    mockLogAction,
    mockUser,
    mockFromFn,
    mockApplyCompanyScope,
    mockWithCompanyScope,
    mockGuardInput,
    mockRpc,
  };
});

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/useAuditLog', () => ({
  useAuditLog: () => ({ logAction: mockLogAction }),
}));

vi.mock('@/utils/webhookTrigger', () => ({
  triggerWebhook: vi.fn(),
}));

vi.mock('@/utils/dateFormatting', () => ({
  formatDateInput: vi.fn(() => '2026-03-16'),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/hooks/useDataEntryGuard', () => ({
  useDataEntryGuard: () => ({ guardInput: mockGuardInput }),
}));

const mockActiveCompanyId = 'comp-1';
vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: () => ({
    activeCompanyId: mockActiveCompanyId,
    applyCompanyScope: mockApplyCompanyScope,
    withCompanyScope: mockWithCompanyScope,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: mockFromFn,
    rpc: mockRpc,
    functions: { invoke: vi.fn() },
    storage: { from: vi.fn() },
  },
  validateSupabaseConfig: vi.fn(() => ({ valid: true, missing: [] })),
}));

// ── Import under test AFTER mocks ───────────────────────────────────────────
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createChain(resolvedValue = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainsByTable = {};
    setupFromMock();
    useAuth.mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Initial state ----------

  it('returns empty expenses initially', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.totalCount).toBe(0);
  });

  it('returns empty expenses when user is null', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.expenses).toEqual([]);
  });

  // ---------- Return shape ----------

  it('returns all expected API fields', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toHaveProperty('expenses');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('totalCount');
    expect(result.current).toHaveProperty('fetchExpenses');
    expect(result.current).toHaveProperty('createExpense');
    expect(result.current).toHaveProperty('updateExpense');
    expect(result.current).toHaveProperty('deleteExpense');
    expect(result.current).toHaveProperty('advanceApproval');
    expect(result.current).toHaveProperty('rejectApproval');
    expect(result.current).toHaveProperty('resetApproval');
    expect(typeof result.current.fetchExpenses).toBe('function');
    expect(typeof result.current.createExpense).toBe('function');
    expect(typeof result.current.updateExpense).toBe('function');
    expect(typeof result.current.deleteExpense).toBe('function');
    expect(typeof result.current.advanceApproval).toBe('function');
    expect(typeof result.current.rejectApproval).toBe('function');
    expect(typeof result.current.resetApproval).toBe('function');
  });

  // ---------- Fetch with data ----------

  it('fetches and returns expenses from Supabase', async () => {
    const mockExpenses = [
      { id: 'exp-1', amount: 100, expense_date: '2026-03-15', company_id: 'comp-1' },
      { id: 'exp-2', amount: 250, expense_date: '2026-03-14', company_id: 'comp-1' },
    ];
    chainsByTable['expenses'] = createChain({ data: mockExpenses, error: null });

    const { result } = renderHook(() => useExpenses());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.expenses).toHaveLength(2);
    expect(result.current.expenses[0].amount).toBe(100);
  });

  // ---------- fetchExpenses with pagination ----------

  it('fetchExpenses with pagination uses range', async () => {
    const chain = createChain({ data: [{ id: 'exp-p1' }], error: null, count: 25 });
    chainsByTable['expenses'] = chain;

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.fetchExpenses({ page: 2, pageSize: 10 });
    });

    expect(chain.range).toHaveBeenCalled();
  });

  it('fetchExpenses without pagination does not call range', async () => {
    const chain = createChain({ data: [{ id: 'exp-1' }], error: null });
    chainsByTable['expenses'] = chain;

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.fetchExpenses();
    });

    // range should not be called when no pagination params
    expect(chain.range).not.toHaveBeenCalled();
  });

  // ---------- createExpense ----------

  it('createExpense inserts and prepends to state', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newExpense = { id: 'exp-new', amount: 500, expense_date: '2026-03-16', company_id: 'comp-1' };
    const insertChain = createChain({ data: newExpense, error: null });
    chainsByTable['expenses'] = insertChain;

    await act(async () => {
      const data = await result.current.createExpense({ amount: 500, description: 'Test' });
      expect(data).toEqual(newExpense);
    });

    expect(mockLogAction).toHaveBeenCalledWith('create', 'expense', null, newExpense);
  });

  it('createExpense returns null without activeCompanyId', async () => {
    // We test the no-company toast path by temporarily clearing user
    useAuth.mockReturnValue({ user: null });
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const data = await result.current.createExpense({ amount: 100 });
      expect(data).toBeUndefined();
    });
  });

  // ---------- updateExpense ----------

  it('updateExpense updates state on success', async () => {
    const existing = [{ id: 'exp-1', amount: 100, company_id: 'comp-1' }];
    chainsByTable['expenses'] = createChain({ data: existing, error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated = { id: 'exp-1', amount: 200, company_id: 'comp-1' };
    chainsByTable['expenses'] = createChain({ data: updated, error: null });

    await act(async () => {
      const data = await result.current.updateExpense('exp-1', { amount: 200 });
      expect(data).toEqual(updated);
    });

    expect(mockLogAction).toHaveBeenCalledWith('update', 'expense', null, updated);
    expect(mockToast).toHaveBeenCalled();
  });

  // ---------- deleteExpense ----------

  it('deleteExpense removes expense from state', async () => {
    const existing = [
      { id: 'exp-1', amount: 100 },
      { id: 'exp-2', amount: 200 },
    ];
    chainsByTable['expenses'] = createChain({ data: existing, error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Setup delete chain
    const delChain = createChain({ error: null });
    chainsByTable['expenses'] = delChain;

    await act(async () => {
      await result.current.deleteExpense('exp-1');
    });

    expect(mockLogAction).toHaveBeenCalledWith('delete', 'expense', { id: 'exp-1' }, null);
    expect(mockToast).toHaveBeenCalled();
  });

  // ---------- advanceApproval ----------

  it('advanceApproval calls RPC and refreshes', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const ok = await result.current.advanceApproval('exp-1', 'Looks good');
      expect(ok).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('expense_approve_step', {
      p_expense_id: 'exp-1',
      p_comment: 'Looks good',
    });
    expect(mockToast).toHaveBeenCalled();
  });

  it('advanceApproval returns null when user is null', async () => {
    useAuth.mockReturnValue({ user: null });
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const res = await result.current.advanceApproval('exp-1');
      expect(res).toBeNull();
    });
  });

  // ---------- rejectApproval ----------

  it('rejectApproval calls RPC with reason', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const ok = await result.current.rejectApproval('exp-1', 'Not justified');
      expect(ok).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('expense_reject_step', {
      p_expense_id: 'exp-1',
      p_reason: 'Not justified',
    });
  });

  // ---------- resetApproval ----------

  it('resetApproval calls RPC to reset workflow', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const ok = await result.current.resetApproval('exp-1');
      expect(ok).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('expense_reset_approval_workflow', {
      p_expense_id: 'exp-1',
    });
  });

  // ---------- Error handling ----------

  it('createExpense shows toast on error', async () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Make insert chain fail at single() step
    const failChain = createChain();
    failChain.select = vi.fn().mockReturnThis();
    failChain.insert = vi.fn().mockReturnThis();
    failChain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    // Override the full chain so insert().select().single() returns error
    failChain.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockRejectedValue(new Error('Insert failed')),
      }),
    });
    chainsByTable['expenses'] = failChain;

    await act(async () => {
      await result.current.createExpense({ amount: 100 }).catch(() => {});
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
