import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockFrom, mockRpc, mockUseAuth } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock('@/services/subscriptionService', () => ({
  createSubscriptionCheckout: vi.fn(),
  redirectToCheckout: vi.fn(),
}));

import { useSubscription } from '@/hooks/useSubscription';

function createPlansChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return chain;
}

function createUserCreditsChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    mockFrom.mockImplementation((table) => {
      if (table !== 'subscription_plans') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return createPlansChain();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes none when there is no authenticated user', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscriptionStatus).toBe('none');
    expect(result.current.currentPlan).toBeNull();
    expect(result.current.subscriptionCredits).toBe(0);
  });

  it('normalizes a missing subscription row to none instead of inactive', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'member@example.com',
      },
    });

    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'subscription_plans') {
        return createPlansChain();
      }

      if (table === 'user_credits') {
        return createUserCreditsChain({
          data: {
            subscription_plan_id: null,
            subscription_status: null,
            subscription_credits: 0,
            current_period_end: null,
          },
          error: null,
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscriptionStatus).toBe('none');
    expect(result.current.currentPlan).toBeNull();
    expect(result.current.subscriptionCredits).toBe(0);
  });
});
