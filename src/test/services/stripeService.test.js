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

import { createCheckoutSession, formatPrice, redirectToCheckout } from '@/services/stripeService';

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

  it('throws when no active session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(
      createCheckoutSession({
        priceId: 'price_123',
        credits: 100,
        userId: 'user-1',
        customerEmail: 'member@example.com',
      })
    ).rejects.toThrow('Authentication required');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns checkout payload on success and uses default redirect URLs', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
      }),
    });
    vi.stubGlobal('window', { location: { origin: 'https://app.cashpilot.tech' } });

    const payload = await createCheckoutSession({
      priceId: 'price_123',
      credits: 200,
      userId: 'user-1',
      customerEmail: 'member@example.com',
    });

    expect(payload).toEqual({ url: 'https://checkout.stripe.com/session_123' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/functions/v1/stripe-checkout',
      expect.objectContaining({
        body: JSON.stringify({
          priceId: 'price_123',
          credits: 200,
          userId: 'user-1',
          customerEmail: 'member@example.com',
          successUrl: 'https://app.cashpilot.tech/settings?tab=credits&status=success',
          cancelUrl: 'https://app.cashpilot.tech/settings?tab=credits&status=cancelled',
        }),
      })
    );
  });

  it('surfaces fallback message when error body is not JSON', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('bad-json')),
    });

    await expect(
      createCheckoutSession({
        priceId: 'price_123',
        credits: 100,
        userId: 'user-1',
        customerEmail: 'member@example.com',
      })
    ).rejects.toThrow('Checkout session creation failed');
  });
});

describe('stripeService utility helpers', () => {
  it('formats prices per currency conventions', () => {
    expect(formatPrice(1234, 'EUR')).toBe('12.34 €');
    expect(formatPrice(1234, 'USD')).toBe('$12.34');
    expect(formatPrice(1234, 'GBP')).toBe('12.34 £');
    expect(formatPrice(1234, 'XOF')).toBe('12.34 XOF');
  });

  it('redirects browser to checkout session URL', () => {
    vi.stubGlobal('window', { location: { href: 'about:blank' } });
    redirectToCheckout('https://checkout.stripe.com/session_123');
    expect(window.location.href).toBe('https://checkout.stripe.com/session_123');
  });
});
