import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted state shared between mocks and tests ─────────────────────────────

const { mockToast, mockUser, mockFromFn, mockGetStoredActiveCompanyId, mockSetStoredActiveCompanyId } = vi.hoisted(
  () => {
    const mockToast = vi.fn();
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const mockFromFn = vi.fn();
    const mockGetStoredActiveCompanyId = vi.fn(() => null);
    const mockSetStoredActiveCompanyId = vi.fn();
    return { mockToast, mockUser, mockFromFn, mockGetStoredActiveCompanyId, mockSetStoredActiveCompanyId };
  }
);

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const { mockUseActiveCompanyId } = vi.hoisted(() => {
  const mockUseActiveCompanyId = vi.fn(() => 'comp-1');
  return { mockUseActiveCompanyId };
});

vi.mock('@/hooks/useActiveCompanyId', () => ({
  useActiveCompanyId: mockUseActiveCompanyId,
}));

vi.mock('@/utils/activeCompanyStorage', () => ({
  ACTIVE_COMPANY_STORAGE_KEY: 'cashpilot.activeCompanyId',
  ACTIVE_COMPANY_EVENT: 'cashpilot:active-company-changed',
  getStoredActiveCompanyId: mockGetStoredActiveCompanyId,
  setStoredActiveCompanyId: mockSetStoredActiveCompanyId,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    from: mockFromFn,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.example.com/logo.png' } })),
      })),
    },
    functions: { invoke: vi.fn() },
  },
  validateSupabaseConfig: vi.fn(() => ({ valid: true, missing: [] })),
}));

// ── Import under test AFTER mocks ───────────────────────────────────────────
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createChain(resolvedValue = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  // Make chain awaitable: `await chain` resolves to resolvedValue
  chain.then = (onFulfilled) => Promise.resolve(resolvedValue).then(onFulfilled);
  return chain;
}

// A lookup that `mockFromFn` uses to return the right chain per table.
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

describe('useCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainsByTable = {};
    setupFromMock();

    // Reset useAuth to return a valid user by default
    useAuth.mockReturnValue({ user: mockUser });
    mockGetStoredActiveCompanyId.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Initial state ----------

  it('returns loading=true initially when user is present', () => {
    chainsByTable['company'] = createChain({ data: [], error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    expect(result.current.loading).toBe(true);
    expect(result.current.companies).toEqual([]);
    expect(result.current.activeCompany).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets loading=false and empty state when user is null', async () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.companies).toEqual([]);
    expect(result.current.activeCompany).toBeNull();
  });

  // ---------- Successful data fetch ----------

  it('fetches companies and sets the first one as active', async () => {
    const companies = [
      { id: 'comp-1', company_name: 'Alpha Corp', user_id: 'user-1', created_at: '2026-01-01' },
      { id: 'comp-2', company_name: 'Beta LLC', user_id: 'user-1', created_at: '2026-02-01' },
    ];

    chainsByTable['company'] = createChain({ data: companies, error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.companies).toHaveLength(2);
    expect(result.current.companies[0].company_name).toBe('Alpha Corp');
    expect(result.current.activeCompany.id).toBe('comp-1');
  });

  it('selects active company from stored preference', async () => {
    const companies = [
      { id: 'comp-1', company_name: 'Alpha Corp', user_id: 'user-1', created_at: '2026-01-01' },
      { id: 'comp-2', company_name: 'Beta LLC', user_id: 'user-1', created_at: '2026-02-01' },
    ];

    chainsByTable['company'] = createChain({ data: companies, error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });
    mockGetStoredActiveCompanyId.mockReturnValue('comp-2');
    mockUseActiveCompanyId.mockReturnValue('comp-2');

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCompany.id).toBe('comp-2');
    expect(result.current.activeCompany.company_name).toBe('Beta LLC');
  });

  // ---------- Error handling ----------

  it('sets error state when company fetch fails with non-RLS error', async () => {
    chainsByTable['company'] = createChain({ data: null, error: { code: 'PGRST301', message: 'Network failure' } });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network failure');
  });

  it('gracefully handles RLS policy errors (42P17)', async () => {
    chainsByTable['company'] = createChain({ data: null, error: { code: '42P17', message: 'RLS infinite recursion' } });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.companies).toEqual([]);
  });

  // ---------- sanitizeCompanyRecord ----------

  it('strips sensitive credential fields from company records', async () => {
    const companies = [
      {
        id: 'comp-1',
        company_name: 'Secure Corp',
        user_id: 'user-1',
        created_at: '2026-01-01',
        scrada_api_key: 'secret-key',
        scrada_password: 'secret-pass',
        scrada_api_key_encrypted: 'enc-key',
        scrada_password_encrypted: 'enc-pass',
        scrada_company_id: 'scrada-1',
      },
    ];

    chainsByTable['company'] = createChain({ data: companies, error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const company = result.current.activeCompany;
    expect(company.scrada_api_key).toBe('');
    expect(company.scrada_password).toBe('');
    expect(company.has_scrada_credentials).toBe(true);
  });

  // ---------- saveCompany ----------

  it('saveCompany creates a new company when no activeCompany exists', async () => {
    chainsByTable['company'] = createChain({ data: [], error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Now configure the insert chain for the new company
    const newCompany = {
      id: 'comp-new',
      company_name: 'New Corp',
      user_id: 'user-1',
      company_type: 'company',
    };
    chainsByTable['company'] = createChain({ data: newCompany, error: null });

    let success;
    await act(async () => {
      success = await result.current.saveCompany({
        company_name: 'New Corp',
        company_type: 'company',
      });
    });

    expect(success).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Succès' }));
  });

  it('saveCompany returns false on error and shows error toast', async () => {
    const companies = [{ id: 'comp-1', company_name: 'Alpha', user_id: 'user-1', created_at: '2026-01-01' }];
    chainsByTable['company'] = createChain({ data: companies, error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Configure update to fail
    chainsByTable['company'] = createChain({ data: null, error: { message: 'Update failed' } });

    let success;
    await act(async () => {
      success = await result.current.saveCompany({ company_name: 'Updated' });
    });

    expect(success).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  // ---------- Return shape ----------

  it('returns all expected API fields', async () => {
    chainsByTable['company'] = createChain({ data: [], error: null });
    chainsByTable['user_company_preferences'] = createChain({ data: null, error: null });

    const { result } = renderHook(() => useCompany());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toHaveProperty('companies');
    expect(result.current).toHaveProperty('activeCompany');
    expect(result.current).toHaveProperty('company');
    expect(result.current).toHaveProperty('switchCompany');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('saving');
    expect(result.current).toHaveProperty('uploading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('fetchCompany');
    expect(result.current).toHaveProperty('saveCompany');
    expect(result.current).toHaveProperty('uploadLogo');
    expect(result.current).toHaveProperty('deleteLogo');

    // company alias should match activeCompany
    expect(result.current.company).toBe(result.current.activeCompany);
  });
});
