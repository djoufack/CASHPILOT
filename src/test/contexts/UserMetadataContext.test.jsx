import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockValidateSupabaseConfig, mockCheckSupabaseConnection } = vi.hoisted(() => ({
  mockValidateSupabaseConfig: vi.fn(),
  mockCheckSupabaseConnection: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  validateSupabaseConfig: mockValidateSupabaseConfig,
  checkSupabaseConnection: mockCheckSupabaseConnection,
}));

import { AuthStateContext } from '@/contexts/AuthStateContext';
import { UserMetadataProvider, useUserMetadata } from '@/contexts/UserMetadataContext';

function createWrapper(user = { id: 'u-1', role: 'admin' }) {
  return function Wrapper({ children }) {
    return (
      <AuthStateContext.Provider value={{ user }}>
        <UserMetadataProvider>{children}</UserMetadataProvider>
      </AuthStateContext.Provider>
    );
  };
}

describe('UserMetadataContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports configuration errors when Supabase config is invalid', async () => {
    mockValidateSupabaseConfig.mockReturnValue({
      valid: false,
      missing: 'VITE_SUPABASE_URL',
    });

    const { result } = renderHook(() => useUserMetadata(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.connectionStatus.checking).toBe(false));
    expect(result.current.connectionStatus.connected).toBe(false);
    expect(result.current.connectionStatus.error).toContain('VITE_SUPABASE_URL');
    expect(mockCheckSupabaseConnection).not.toHaveBeenCalled();
  });

  it('propagates successful runtime connectivity checks', async () => {
    mockValidateSupabaseConfig.mockReturnValue({ valid: true });
    mockCheckSupabaseConnection.mockResolvedValue({
      connected: true,
      error: null,
    });

    const { result } = renderHook(() => useUserMetadata(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.connectionStatus.checking).toBe(false));
    expect(result.current.connectionStatus.connected).toBe(true);
    expect(result.current.connectionStatus.error).toBeNull();
  });

  it('supports role checks for single role and arrays', async () => {
    mockValidateSupabaseConfig.mockReturnValue({ valid: true });
    mockCheckSupabaseConnection.mockResolvedValue({
      connected: true,
      error: null,
    });

    const { result } = renderHook(() => useUserMetadata(), { wrapper: createWrapper({ id: 'u-1', role: 'owner' }) });

    await waitFor(() => expect(result.current.connectionStatus.checking).toBe(false));
    expect(result.current.hasRole('owner')).toBe(true);
    expect(result.current.hasRole('admin')).toBe(false);
    expect(result.current.hasRole(['admin', 'owner'])).toBe(true);
  });

  it('defaults to "user" role when role is absent and handles null user', async () => {
    mockValidateSupabaseConfig.mockReturnValue({ valid: true });
    mockCheckSupabaseConnection.mockResolvedValue({
      connected: true,
      error: null,
    });

    const { result: withMissingRole } = renderHook(() => useUserMetadata(), {
      wrapper: createWrapper({ id: 'u-1' }),
    });
    await waitFor(() => expect(withMissingRole.current.connectionStatus.checking).toBe(false));
    expect(withMissingRole.current.hasRole('user')).toBe(true);

    const { result: withNoUser } = renderHook(() => useUserMetadata(), {
      wrapper: createWrapper(null),
    });
    await waitFor(() => expect(withNoUser.current.connectionStatus.checking).toBe(false));
    expect(withNoUser.current.hasRole('admin')).toBe(false);
  });

  it('throws when useUserMetadata is used without provider', () => {
    const { result } = renderHook(() => {
      try {
        useUserMetadata();
        return 'ok';
      } catch (error) {
        return error.message;
      }
    });
    expect(result.current).toBe('useUserMetadata must be used within a UserMetadataProvider');
  });
});
