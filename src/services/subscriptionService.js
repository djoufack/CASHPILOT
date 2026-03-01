/**
 * Subscription Service
 * Handles Stripe subscription checkout and customer portal sessions.
 */

import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

/**
 * Create a Stripe Checkout session for a subscription plan
 */
export const createSubscriptionCheckout = async ({ planSlug, userId, customerEmail, billingInterval, successUrl, cancelUrl }) => {
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-subscription-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      planSlug,
      userId,
      customerEmail,
      billingInterval: billingInterval || 'monthly',
      successUrl: successUrl || `${window.location.origin}/pricing?status=success`,
      cancelUrl: cancelUrl || `${window.location.origin}/pricing?status=cancelled`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Subscription checkout failed' }));
    throw new Error(error.error || error.message || 'Failed to create subscription checkout');
  }

  return response.json();
};

/**
 * Redirect to Stripe Checkout
 */
export const redirectToCheckout = (sessionUrl) => {
  window.location.href = sessionUrl;
};
