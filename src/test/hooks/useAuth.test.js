import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
  mockMfa,
  mockFromFn,
  mockRpc,
  mockFunctionsInvoke,
  mockAssertRateLimitAllowed,
  mockRecordRateLimitFailure,
  mockRecordRateLimitSuccess,
} = vi.hoisted(() => {
  const mockSignOut = vi.fn().mockResolvedValue({ error: null });
  const mockMfa = {
    listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
    enroll: vi
      .fn()
      .mockResolvedValue({ data: { id: 'f1', totp: { qr_code: 'qr', secret: 's', uri: 'u' } }, error: null }),
    challenge: vi.fn().mockResolvedValue({ data: { id: 'ch1' }, error: null }),
    verify: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    unenroll: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    mockGetSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    mockSignInWithPassword: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignOut,
    mockMfa,
    mockFromFn: vi.fn(),
    mockRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockFunctionsInvoke: vi.fn().mockResolvedValue({ data: { allowed: true }, error: null }),
    mockAssertRateLimitAllowed: vi.fn(),
    mockRecordRateLimitFailure: vi.fn(),
    mockRecordRateLimitSuccess: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      mfa: mockMfa,
    },
    from: mockFromFn,
    rpc: mockRpc,
    functions: { invoke: mockFunctionsInvoke },
  },
  validateSupabaseConfig: vi.fn(() => ({ valid: true, missing: [] })),
}));

vi.mock('@/utils/sanitize', () => ({
  sanitizeText: vi.fn((v) => String(v || '')),
  sanitizeHTML: vi.fn((v) => String(v || '')),
}));

vi.mock('@/utils/authRateLimit', () => ({
  assertRateLimitAllowed: mockAssertRateLimitAllowed,
  recordRateLimitFailure: mockRecordRateLimitFailure,
  recordRateLimitSuccess: mockRecordRateLimitSuccess,
}));

vi.mock('@/utils/validation', () => ({
  validatePasswordStrength: vi.fn(() => true),
}));

// ── Import under test ──────────────────────────────────────────────────────
import { useAuthSource } from '@/hooks/useAuth';
import { validatePasswordStrength } from '@/utils/validation';

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useAuthSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mockFromFn.mockReturnValue(createChain());
    mockFunctionsInvoke.mockResolvedValue({ data: { allowed: true }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Initial state ----------

  it('initializes with loading=true then resolves to no user', async () => {
    const { result } = renderHook(() => useAuthSource());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ---------- Return shape ----------

  it('returns all expected API fields and functions', async () => {
    const { result } = renderHook(() => useAuthSource());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('session');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.updateProfile).toBe('function');
    expect(typeof result.current.getMFAStatus).toBe('function');
    expect(typeof result.current.enrollMFA).toBe('function');
    expect(typeof result.current.verifyMFA).toBe('function');
    expect(typeof result.current.unenrollMFA).toBe('function');
  });

  // ---------- Session restore ----------

  it('restores user from existing session on mount', async () => {
    const mockSession = {
      user: { id: 'uid-1', email: 'test@test.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const profileChain = createChain({ data: { id: 'p1', full_name: 'Test' }, error: null });
    const roleChain = createChain({ data: { role: 'admin' }, error: null });

    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return profileChain;
      if (table === 'user_roles') return roleChain;
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user.id).toBe('uid-1');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session).toBe(mockSession);
  });

  // ---------- signIn ----------

  it('signIn calls Supabase signInWithPassword and fetches profile', async () => {
    const signInData = {
      user: { id: 'uid-2', email: 'login@test.com' },
      session: { access_token: 'tok' },
    };
    mockSignInWithPassword.mockResolvedValue({ data: signInData, error: null });

    const profileChain = createChain({ data: { id: 'p2', full_name: 'Login User' }, error: null });
    const roleChain = createChain({ data: null, error: null });
    const companyChain = createChain({ data: [], error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return profileChain;
      if (table === 'user_roles') return roleChain;
      if (table === 'company') return companyChain;
      if (table === 'company_security_settings') return createChain({ data: [], error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('login@test.com', 'Passw0rd!1234');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'login@test.com',
      password: 'Passw0rd!1234',
    });
  });

  it('signIn throws on Supabase error', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('bad@test.com', 'wrong');
      })
    ).rejects.toThrow('Invalid credentials');
  });

  it('signIn is blocked by server-side rate limit response', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { allowed: false, error: 'Too many attempts.', retryAfterSeconds: 30 },
      error: null,
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('rate@test.com', 'Passw0rd!1234');
      })
    ).rejects.toThrow('Try again in 30 seconds.');

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('signIn fails open when auth-rate-limit function is unreachable', async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'edge unavailable' },
    });
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'uid-edge', email: 'edge@test.com' },
        session: { access_token: 'tok-edge' },
      },
      error: null,
    });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { id: 'p-edge', full_name: 'Edge User' }, error: null });
      if (table === 'user_roles') return createChain({ data: { role: 'admin' }, error: null });
      if (table === 'company') return createChain({ data: [], error: null });
      if (table === 'company_security_settings') return createChain({ data: [], error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('edge@test.com', 'Passw0rd!1234');
    });

    expect(mockSignInWithPassword).toHaveBeenCalled();
    expect(result.current.user?.id).toBe('uid-edge');
  });

  it('signIn enforces SSO-only workspace policy', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'uid-sso', email: 'user@company.com' },
        session: { access_token: 'tok-sso' },
      },
      error: null,
    });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { id: 'p-sso' }, error: null });
      if (table === 'user_roles') return createChain({ data: { role: 'user' }, error: null });
      if (table === 'company') return createChain({ data: [{ id: 'company-1' }], error: null });
      if (table === 'company_security_settings') {
        return createChain({
          data: [{ company_id: 'company-1', sso_enforced: true, sso_provider: 'google' }],
          error: null,
        });
      }
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('user@company.com', 'Passw0rd!1234');
      })
    ).rejects.toThrow('enforces SSO');

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signIn enforces allowed email domains policy', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'uid-domain', email: 'user@outside.com' },
        session: { access_token: 'tok-domain' },
      },
      error: null,
    });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { id: 'p-domain' }, error: null });
      if (table === 'user_roles') return createChain({ data: { role: 'user' }, error: null });
      if (table === 'company') return createChain({ data: [{ id: 'company-1' }], error: null });
      if (table === 'company_security_settings') {
        return createChain({
          data: [
            {
              company_id: 'company-1',
              sso_enforced: true,
              sso_provider: 'none',
              allowed_email_domains: ['company.com'],
            },
          ],
          error: null,
        });
      }
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('user@outside.com', 'Passw0rd!1234');
      })
    ).rejects.toThrow('approved email domains');

    expect(mockSignOut).toHaveBeenCalled();
  });

  // ---------- signUp ----------

  it('signUp validates password strength', async () => {
    validatePasswordStrength.mockReturnValue(false);

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signUp('new@test.com', 'weak', 'Full Name', 'Company');
      })
    ).rejects.toThrow(/Password must be/);
  });

  it('signUp requires full name', async () => {
    validatePasswordStrength.mockReturnValue(true);

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signUp('new@test.com', 'StrongPass123!', '', 'Company');
      })
    ).rejects.toThrow('Full name is required.');
  });

  it('signUp calls Supabase auth.signUp on valid input', async () => {
    validatePasswordStrength.mockReturnValue(true);
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'uid-new' },
        session: { access_token: 'new-tok' },
      },
      error: null,
    });

    const profileChain = createChain({ data: null, error: null });
    profileChain.insert = vi.fn().mockResolvedValue({ error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return profileChain;
      if (table === 'user_roles') return createChain({ data: null, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp('new@test.com', 'StrongPass123!', 'New User', 'NewCo');
    });

    expect(mockSignUp).toHaveBeenCalled();
    expect(mockSignUp.mock.calls[0][0].email).toBe('new@test.com');
  });

  it('signUp records failure metadata when Supabase signUp fails', async () => {
    validatePasswordStrength.mockReturnValue(true);
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'Email already registered' },
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signUp('existing@test.com', 'StrongPass123!', 'Existing User', 'Acme');
      })
    ).rejects.toThrow('Email already registered');

    expect(mockRecordRateLimitFailure).toHaveBeenCalled();
  });

  // ---------- logout ----------

  it('logout clears user and session', async () => {
    const mockSession = {
      user: { id: 'uid-1', email: 'test@test.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const profileChain = createChain({ data: { id: 'p1', full_name: 'Test' }, error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return profileChain;
      if (table === 'user_roles') return createChain({ data: null, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('logout clears auth storage and runtime caches when available', async () => {
    const mockSession = {
      user: { id: 'uid-1', email: 'test@test.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { id: 'p1', full_name: 'Test' }, error: null });
      if (table === 'user_roles') return createChain({ data: null, error: null });
      return createChain();
    });

    localStorage.setItem('sb-test', '1');
    localStorage.setItem('keep-pref', 'fr');

    const postMessage = vi.fn();
    const getRegistration = vi.fn().mockResolvedValue({ active: { postMessage } });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration },
    });

    const deleteCache = vi.fn().mockResolvedValue(true);
    const keys = vi.fn().mockResolvedValue(['c1', 'c2']);
    vi.stubGlobal('caches', { keys, delete: deleteCache });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(getRegistration).toHaveBeenCalledWith('/');
    expect(postMessage).toHaveBeenCalledWith({ type: 'CLEAR_RUNTIME_CACHES' });
    expect(keys).toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('sb-test')).toBeNull();
    expect(localStorage.getItem('keep-pref')).toBe('fr');
  });

  // ---------- updateProfile ----------

  it('updateProfile updates user state with allowed fields', async () => {
    const mockSession = {
      user: { id: 'uid-1', email: 'test@test.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    createChain({ data: { id: 'p1', full_name: 'Old Name' }, error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') {
        // Return update chain that supports .update().eq()
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1', full_name: 'Old Name' }, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'user_roles') return createChain({ data: null, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProfile({ full_name: 'New Name' });
    });

    expect(result.current.user.full_name).toBe('New Name');
  });

  it('updateProfile ignores non-allowed fields', async () => {
    const mockSession = {
      user: { id: 'uid-1', email: 'test@test.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1', full_name: 'Name' }, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'user_roles') return createChain({ data: null, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only non-allowed fields => early return (no update call)
    await act(async () => {
      await result.current.updateProfile({ hacker_field: 'malicious' });
    });

    // User should not have hacker_field
    expect(result.current.user?.hacker_field).toBeUndefined();
  });

  // ---------- MFA ----------

  it('getMFAStatus returns enabled:false when no verified factors', async () => {
    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let status;
    await act(async () => {
      status = await result.current.getMFAStatus();
    });

    expect(status.enabled).toBe(false);
    expect(status.factors).toEqual([]);
  });

  it('getMFAStatus returns enabled:true with verified factors', async () => {
    mockMfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f1', status: 'verified' }] },
      error: null,
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let status;
    await act(async () => {
      status = await result.current.getMFAStatus();
    });

    expect(status.enabled).toBe(true);
    expect(status.factors).toHaveLength(1);
  });

  it('getMFAStatus gracefully handles provider errors', async () => {
    mockMfa.listFactors.mockResolvedValueOnce({ data: null, error: { message: 'MFA unavailable' } });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let status;
    await act(async () => {
      status = await result.current.getMFAStatus();
    });

    expect(status).toEqual({ enabled: false, factors: [] });
  });

  it('enrollMFA calls supabase.auth.mfa.enroll', async () => {
    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let data;
    await act(async () => {
      data = await result.current.enrollMFA();
    });

    expect(mockMfa.enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'CashPilot Authenticator',
    });
    expect(data).toHaveProperty('totp');
  });

  it('verifyMFA calls challenge then verify', async () => {
    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.verifyMFA('f1', '123456');
    });

    expect(mockMfa.challenge).toHaveBeenCalledWith({ factorId: 'f1' });
    expect(mockMfa.verify).toHaveBeenCalledWith({
      factorId: 'f1',
      challengeId: 'ch1',
      code: '123456',
    });
  });

  it('verifyMFA reports failure when Supabase verification fails', async () => {
    mockMfa.verify.mockResolvedValueOnce({ data: null, error: { message: 'Invalid MFA code' } });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.verifyMFA('f1', '000000');
      })
    ).rejects.toThrow('Invalid MFA code');

    expect(mockRecordRateLimitFailure).toHaveBeenCalled();
  });

  it('unenrollMFA calls supabase.auth.mfa.unenroll', async () => {
    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.unenrollMFA('f1');
    });

    expect(mockMfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' });
  });

  // ---------- Error on init ----------

  it('sets error when getSession fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: { message: 'Network failure' } });

    const { result } = renderHook(() => useAuthSource());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('Network failure');
  });

  it('reacts to auth state change events (SIGNED_IN then SIGNED_OUT)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockFromFn.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { id: 'p2', full_name: 'Auth Event' }, error: null });
      if (table === 'user_roles') return createChain({ data: { role: 'admin' }, error: null });
      return createChain();
    });

    const { result } = renderHook(() => useAuthSource());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const authCallback = mockOnAuthStateChange.mock.calls[0][0];

    await act(async () => {
      await authCallback('SIGNED_IN', { user: { id: 'uid-auth', email: 'auth@test.com' } });
    });
    expect(result.current.user?.id).toBe('uid-auth');

    await act(async () => {
      await authCallback('SIGNED_OUT', null);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
