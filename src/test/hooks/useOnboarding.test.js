import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { mockUser, mockFromFn } = vi.hoisted(() => {
  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockFromFn = vi.fn();
  return { mockUser, mockFromFn };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFromFn,
  },
}));

import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/AuthContext';

function createProfilesChain(state) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn((payload) => {
      state.lastPayload = payload;
      return chain;
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(state.fetchResponse),
  };

  chain.then = (onFulfilled, onRejected) => Promise.resolve(state.saveResponse).then(onFulfilled, onRejected);
  return chain;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useOnboarding', () => {
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    state = {
      fetchResponse: { data: { onboarding_completed: false, onboarding_step: 1 }, error: null },
      saveResponse: { data: { ok: true }, error: null },
      lastPayload: null,
    };

    mockFromFn.mockImplementation((table) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return createProfilesChain(state);
    });

    useAuth.mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nextStep waits for persistence and exposes saving state', async () => {
    const deferred = createDeferred();
    state.saveResponse = deferred.promise;

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let promise;
    await act(async () => {
      promise = result.current.nextStep();
    });
    expect(promise).toBeInstanceOf(Promise);

    await waitFor(() => {
      expect(result.current.saving).toBe(true);
    });

    await act(async () => {
      deferred.resolve({ data: { ok: true }, error: null });
      await promise;
    });

    await expect(promise).resolves.toEqual({ success: true, step: 2 });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.error).toBeNull();
    expect(state.lastPayload).toEqual({ onboarding_step: 2 });
  });

  it('completeOnboarding returns a failure result when persistence fails', async () => {
    const deferred = createDeferred();
    state.saveResponse = deferred.promise;

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let promise;
    await act(async () => {
      promise = result.current.completeOnboarding();
    });
    expect(promise).toBeInstanceOf(Promise);

    await waitFor(() => {
      expect(result.current.saving).toBe(true);
    });

    await act(async () => {
      deferred.resolve({ data: null, error: new Error('persist failed') });
      await promise;
    });

    await expect(promise).resolves.toMatchObject({
      success: false,
      error: 'persist failed',
    });

    expect(result.current.onboardingCompleted).toBe(false);
    expect(result.current.currentStep).toBe(1);
    expect(result.current.error).toBe('persist failed');
  });
});
