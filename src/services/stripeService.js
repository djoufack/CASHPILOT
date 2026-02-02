/**
 * Stripe Service
 * Handles Stripe checkout session creation for credit purchases.
 * In a production environment, the checkout session should be created server-side
 * via a Supabase Edge Function. This client-side module provides the interface.
 */

const STRIPE_CHECKOUT_ENDPOINT = '/api/stripe/create-checkout-session';

/**
 * Create a Stripe Checkout session for credit purchase
 * @param {Object} params
 * @param {string} params.priceId - Stripe Price ID
 * @param {number} params.credits - Number of credits being purchased
 * @param {string} params.userId - User ID
 * @param {string} params.customerEmail - Customer email
 * @param {string} params.successUrl - Redirect URL on success
 * @param {string} params.cancelUrl - Redirect URL on cancel
 * @returns {Promise<Object>} Checkout session data
 */
export const createCheckoutSession = async ({ priceId, credits, userId, customerEmail, successUrl, cancelUrl }) => {
  // For Supabase Edge Function integration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      priceId,
      credits,
      userId,
      customerEmail,
      successUrl: successUrl || `${window.location.origin}/settings?tab=credits&status=success`,
      cancelUrl: cancelUrl || `${window.location.origin}/settings?tab=credits&status=cancelled`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Checkout session creation failed' }));
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return response.json();
};

/**
 * Redirect to Stripe Checkout
 * @param {string} sessionUrl - Stripe Checkout URL
 */
export const redirectToCheckout = (sessionUrl) => {
  window.location.href = sessionUrl;
};

/**
 * Format price in cents to display string
 * @param {number} priceCents - Price in cents
 * @param {string} currency - Currency code
 * @returns {string} Formatted price
 */
export const formatPrice = (priceCents, currency = 'EUR') => {
  const amount = priceCents / 100;
  const symbols = { EUR: '€', USD: '$', GBP: '£' };
  const symbol = symbols[currency] || currency;
  if (currency === 'USD') return `${symbol}${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${symbol}`;
};
