import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockUseAuthSource, mockValidateSupabaseConfig, mockCheckSupabaseConnection } = vi.hoisted(() => ({
  mockUseAuthSource: vi.fn(),
  mockValidateSupabaseConfig: vi.fn(),
  mockCheckSupabaseConnection: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthSource: mockUseAuthSource,
}));

vi.mock('@/lib/supabase', () => ({
  validateSupabaseConfig: mockValidateSupabaseConfig,
  checkSupabaseConnection: mockCheckSupabaseConnection,
}));

import { AuthProvider, useAuth, useAuthState, useUserMetadata } from '@/contexts/AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthSource.mockReturnValue({
      user: { id: 'user-1', role: 'admin' },
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
    });
    mockValidateSupabaseConfig.mockReturnValue({ valid: true });
    mockCheckSupabaseConnection.mockResolvedValue({ connected: true, error: null });
  });

  it('merges auth-state and metadata in useAuth', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.connectionStatus.checking).toBe(false));
    expect(result.current.user).toEqual({ id: 'user-1', role: 'admin' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.connectionStatus.connected).toBe(true);
    expect(result.current.hasRole('admin')).toBe(true);
    expect(typeof result.current.checkConnection).toBe('function');
  });

  it('re-exports granular hooks', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result: authStateResult } = renderHook(() => useAuthState(), { wrapper });
    const { result: metadataResult } = renderHook(() => useUserMetadata(), { wrapper });

    await waitFor(() => expect(metadataResult.current.connectionStatus.checking).toBe(false));
    expect(authStateResult.current.isAuthenticated).toBe(true);
    expect(metadataResult.current.connectionStatus.connected).toBe(true);
  });

  it('throws when useAuth is called outside provider', () => {
    const { result } = renderHook(() => {
      try {
        useAuth();
        return 'ok';
      } catch (error) {
        return error.message;
      }
    });
    expect(result.current).toBe('useAuth must be used within an AuthProvider');
  });
});
