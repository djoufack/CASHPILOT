import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Hoisted state shared between mocks and tests ─────────────────────────────

const { mockToast, mockUser, mockFromFn, mockTriggerWebhook, mockApplyCompanyScope, mockWithCompanyScope } = vi.hoisted(
  () => {
    const mockToast = vi.fn();
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockFromFn = vi.fn();
    const mockTriggerWebhook = vi.fn();
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
    return {
      mockToast,
      mockUser,
      mockFromFn,
      mockTriggerWebhook,
      mockApplyCompanyScope,
      mockWithCompanyScope,
    };
  }
);

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/utils/webhookTrigger', () => ({
  triggerWebhook: mockTriggerWebhook,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
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
    functions: { invoke: vi.fn() },
    storage: { from: vi.fn() },
  },
  validateSupabaseConfig: vi.fn(() => ({ valid: true, missing: [] })),
}));

// ── Import under test AFTER mocks ───────────────────────────────────────────
import { useTimesheets } from '@/hooks/useTimesheets';
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
    is: vi.fn().mockReturnThis(),
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useTimesheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainsByTable = {};
    setupFromMock();
    useAuth.mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty timesheets when user is null', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useTimesheets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.timesheets).toEqual([]);
  });

  it('fetches and stores timesheets', async () => {
    const mockTimesheets = [
      {
        id: 'ts-1',
        date: '2026-03-15',
        start_time: '09:00',
        end_time: '17:00',
        duration_minutes: 480,
        description: 'Client meeting',
        billable: true,
        company_id: 'comp-1',
      },
      {
        id: 'ts-2',
        date: '2026-03-14',
        start_time: '10:00',
        end_time: '12:00',
        duration_minutes: 120,
        description: 'Internal review',
        billable: false,
        company_id: 'comp-1',
      },
    ];

    chainsByTable['timesheets'] = createChain({ data: mockTimesheets, error: null });

    const { result } = renderHook(() => useTimesheets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.timesheets).toHaveLength(2);
    expect(result.current.timesheets[0].description).toBe('Client meeting');
    expect(result.current.timesheets[1].duration_minutes).toBe(120);
  });

  it('calculateDuration returns 0 for missing inputs', async () => {
    chainsByTable['timesheets'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useTimesheets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.calculateDuration(null, '17:00')).toBe(0);
    expect(result.current.calculateDuration('09:00', null)).toBe(0);
    expect(result.current.calculateDuration(null, null)).toBe(0);
  });

  it('returns hook API shape', async () => {
    chainsByTable['timesheets'] = createChain({ data: [], error: null });

    const { result } = renderHook(() => useTimesheets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toHaveProperty('timesheets');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('fetchTimesheets');
    expect(result.current).toHaveProperty('createTimesheet');
    expect(result.current).toHaveProperty('updateTimesheet');
    expect(result.current).toHaveProperty('deleteTimesheet');
    expect(result.current).toHaveProperty('calculateDuration');
    expect(typeof result.current.fetchTimesheets).toBe('function');
    expect(typeof result.current.createTimesheet).toBe('function');
    expect(typeof result.current.calculateDuration).toBe('function');
  });
});
