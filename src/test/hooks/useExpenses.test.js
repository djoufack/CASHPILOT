import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Hoisted state shared between mocks and tests ─────────────────────────────

const { mockToast, mockLogAction, mockUser, mockFromFn } = vi.hoisted(() => {
  const mockToast = vi.fn();
  const mockLogAction = vi.fn();
  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockFromFn = vi.fn();
  return { mockToast, mockLogAction, mockUser, mockFromFn };
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

const mockActiveCompanyId = 'comp-1';
vi.mock('@/hooks/useCompanyScope', () => ({
  useCompanyScope: () => ({
    activeCompanyId: mockActiveCompanyId,
    applyCompanyScope: vi.fn((query) => {
      if (query && typeof query.eq === 'function') {
        return query.eq('company_id', mockActiveCompanyId);
      }
      return query;
    }),
    withCompanyScope: vi.fn((payload) => ({
      ...payload,
      company_id: mockActiveCompanyId,
    })),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: mockFromFn,
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

  it('returns empty expenses initially', () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());

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

  it('returns all expected API fields', () => {
    chainsByTable['expenses'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useExpenses());

    expect(result.current).toHaveProperty('expenses');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('totalCount');
    expect(result.current).toHaveProperty('fetchExpenses');
    expect(result.current).toHaveProperty('createExpense');
    expect(result.current).toHaveProperty('updateExpense');
    expect(result.current).toHaveProperty('deleteExpense');
    expect(typeof result.current.fetchExpenses).toBe('function');
    expect(typeof result.current.createExpense).toBe('function');
    expect(typeof result.current.updateExpense).toBe('function');
    expect(typeof result.current.deleteExpense).toBe('function');
  });
});
