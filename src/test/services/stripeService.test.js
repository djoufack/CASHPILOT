import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, fetchSpy } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  fetchSpy: vi.fn(),
}));

vi.mock('@/lib/customSupabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
  supabaseUrl: 'https://supabase.example.com',
  supabaseAnonKey: 'anon-key',
}));

import { createCheckoutSession } from '@/services/stripeService';

describe('stripeService.createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
        },
      },
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('surfaces a disabled one-shot checkout as a 410 failure', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 410,
      json: vi.fn().mockResolvedValue({
        message: 'One-shot credit checkout is disabled',
      }),
    });

    await expect(
      createCheckoutSession({
        priceId: 'price_123',
        credits: 100,
        userId: 'user-1',
        customerEmail: 'member@example.com',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      })
    ).rejects.toThrow('One-shot credit checkout is disabled');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/functions/v1/stripe-checkout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          apikey: 'anon-key',
          Authorization: 'Bearer token-1',
        }),
      })
    );
  });
});
