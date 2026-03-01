/**
 * Subscription Service
 * Handles Stripe subscription checkout and customer portal sessions.
 */

import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

/**
 * Create a Stripe Checkout session for a subscription plan.
 * Supports both authenticated users (userId + customerEmail) and guest checkout (planSlug only).
 */
export const createSubscriptionCheckout = async ({ planSlug, userId, customerEmail, billingInterval, successUrl, cancelUrl }) => {
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const body = { planSlug, billingInterval: billingInterval || 'monthly' };

  // Authenticated user: include userId and email
  if (userId) {
    body.userId = userId;
    body.customerEmail = customerEmail;
    body.successUrl = successUrl || `${window.location.origin}/pricing?status=success`;
    body.cancelUrl = cancelUrl || `${window.location.origin}/pricing?status=cancelled`;
  } else {
    // Guest: Stripe will collect email, redirect to signup after
    body.cancelUrl = cancelUrl || `${window.location.origin}/pricing?status=cancelled`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-subscription-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
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
