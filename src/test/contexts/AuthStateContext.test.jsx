import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseAuthSource } = vi.hoisted(() => ({
  mockUseAuthSource: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthSource: mockUseAuthSource,
}));

import { AuthStateProvider, useAuthState } from '@/contexts/AuthStateContext';

describe('AuthStateContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes SAFE_AUTH_FALLBACK when auth source is unavailable', async () => {
    mockUseAuthSource.mockReturnValue(null);

    const wrapper = ({ children }) => <AuthStateProvider>{children}</AuthStateProvider>;
    const { result } = renderHook(() => useAuthState(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    await expect(result.current.signIn()).rejects.toThrow('Auth not initialized');
    await expect(result.current.signUp()).rejects.toThrow('Auth not initialized');
    await expect(result.current.enrollMFA()).rejects.toThrow('Auth not initialized');
    await expect(result.current.verifyMFA()).rejects.toThrow('Auth not initialized');
    await expect(result.current.unenrollMFA()).rejects.toThrow('Auth not initialized');

    await expect(result.current.logout()).resolves.toBeUndefined();
    await expect(result.current.updateProfile()).resolves.toBeUndefined();
    await expect(result.current.getMFAStatus()).resolves.toEqual({ enabled: false, factors: [] });
  });

  it('passes through auth source values when available', () => {
    const authObject = {
      user: { id: 'u-1' },
      session: { access_token: 'token' },
      loading: false,
      error: null,
      isAuthenticated: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      getMFAStatus: vi.fn(),
      enrollMFA: vi.fn(),
      verifyMFA: vi.fn(),
      unenrollMFA: vi.fn(),
    };
    mockUseAuthSource.mockReturnValue(authObject);

    const wrapper = ({ children }) => <AuthStateProvider>{children}</AuthStateProvider>;
    const { result } = renderHook(() => useAuthState(), { wrapper });

    expect(result.current).toBe(authObject);
  });

  it('throws when useAuthState is called outside provider', () => {
    const { result } = renderHook(() => {
      try {
        useAuthState();
        return 'ok';
      } catch (error) {
        return error.message;
      }
    });
    expect(result.current).toBe('useAuthState must be used within an AuthStateProvider');
  });
});
