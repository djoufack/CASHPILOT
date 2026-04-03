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
      if (table === 'subscription_plans') {
        return createPlansChain();
      }
      if (table === 'user_credits') {
        return createUserCreditsChain({ data: null, error: null });
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

  it('returns expected hook shape', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('plans');
    expect(result.current).toHaveProperty('currentPlan');
    expect(result.current).toHaveProperty('subscriptionStatus');
    expect(result.current).toHaveProperty('subscriptionCredits');
    expect(result.current).toHaveProperty('currentPeriodEnd');
    expect(result.current).toHaveProperty('daysRemaining');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('subscribing');
    expect(typeof result.current.subscribe).toBe('function');
    expect(typeof result.current.fetchPlans).toBe('function');
    expect(typeof result.current.fetchUserSubscription).toBe('function');
  });

  it('normalizes a missing subscription row to none instead of inactive', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'member@example.com' },
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
      return createPlansChain();
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptionStatus).toBe('none');
    expect(result.current.currentPlan).toBeNull();
    expect(result.current.subscriptionCredits).toBe(0);
  });

  it('fetches and resolves active subscription with plan', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' },
    });

    const mockPlan = {
      id: 'plan-1',
      slug: 'pro',
      name: 'Pro',
      plan_scope: 'subscription',
      is_active: true,
      visible_on_pricing: true,
      sort_order: 1,
    };

    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'subscription_plans') {
        // Could be either fetchPlans or fetchPlan-by-id
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [mockPlan], error: null }),
          single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
        };
        return chain;
      }
      if (table === 'user_credits') {
        return createUserCreditsChain({
          data: {
            subscription_plan_id: 'plan-1',
            subscription_status: 'active',
            subscription_credits: 50,
            current_period_end: '2026-12-31',
          },
          error: null,
        });
      }
      return createPlansChain();
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptionStatus).toBe('active');
    expect(result.current.subscriptionCredits).toBe(50);
    expect(result.current.currentPlan).toEqual(mockPlan);
    expect(result.current.daysRemaining).toBeGreaterThan(0);
  });

  it('handles RPC error gracefully', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' },
    });

    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptionStatus).toBe('none');
    expect(result.current.currentPlan).toBeNull();

    consoleSpy.mockRestore();
  });

  it('handles no data from user_credits', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' },
    });

    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'subscription_plans') return createPlansChain();
      if (table === 'user_credits') {
        return createUserCreditsChain({ data: null, error: null });
      }
      return createPlansChain();
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptionStatus).toBe('none');
    expect(result.current.subscriptionCredits).toBe(0);
    expect(result.current.currentPlan).toBeNull();
  });

  it('normalizes inactive status to none', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@test.com' },
    });

    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table) => {
      if (table === 'subscription_plans') return createPlansChain();
      if (table === 'user_credits') {
        return createUserCreditsChain({
          data: {
            subscription_plan_id: null,
            subscription_status: 'inactive',
            subscription_credits: 0,
            current_period_end: null,
          },
          error: null,
        });
      }
      return createPlansChain();
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptionStatus).toBe('none');
  });

  it('filters plans to only show subscription-scope visible plans', async () => {
    const allPlans = [
      { id: 'p1', slug: 'trial', plan_scope: 'trial', is_active: true, visible_on_pricing: true, sort_order: 1 },
      { id: 'p2', slug: 'pro', plan_scope: 'subscription', is_active: true, visible_on_pricing: true, sort_order: 2 },
      {
        id: 'p3',
        slug: 'enterprise',
        plan_scope: 'subscription',
        is_active: true,
        visible_on_pricing: false,
        sort_order: 3,
      },
    ];

    mockFrom.mockImplementation((table) => {
      if (table === 'subscription_plans') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: allPlans, error: null }),
        };
      }
      return createPlansChain();
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only the subscription-scope + visible plan should appear
    expect(result.current.plans).toHaveLength(1);
    expect(result.current.plans[0].slug).toBe('pro');
  });
});
