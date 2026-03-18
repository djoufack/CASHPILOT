// Supabase Edge Function: stripe-invoice-link
// Creates a Stripe Payment Link for a given invoice

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';

import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const PRODUCTION_ORIGIN = 'https://cashpilot.tech';
const LOCAL_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:5173']);

const isAllowedOrigin = (origin: string | null | undefined) => {
  if (!origin) {
    return false;
  }

  if (origin === PRODUCTION_ORIGIN || origin === 'https://www.cashpilot.tech') {
    return true;
  }

  if (LOCAL_ORIGINS.has(origin)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const resolveOrigin = (originHeader: string | null) =>
  isAllowedOrigin(originHeader) ? originHeader! : PRODUCTION_ORIGIN;

const buildCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
});

serve(async (req) => {
  const origin = resolveOrigin(req.headers.get('origin'));
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await requireAuthenticatedUser(req);

    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowMs: 60_000, keyPrefix: 'stripe-link' });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, corsHeaders);

    const supabase = createServiceClient();

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'invoiceId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch invoice and verify ownership
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Create a Price for the exact invoice amount
    const payableAmount = Number(invoice.balance_due ?? invoice.total_ttc ?? 0);
    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invoice balance is already settled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const price = await stripe.prices.create({
      currency: (invoice.currency || 'eur').toLowerCase(),
      unit_amount: Math.round(payableAmount * 100),
      product_data: {
        name: `Facture ${invoice.invoice_number || invoiceId}`,
      },
    });

    // Create Payment Link
    const appUrl = Deno.env.get('APP_URL') || 'https://cashpilot.tech';
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoice_id: invoiceId, user_id: user.id },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${appUrl}/payment-success?invoice=${invoiceId}` },
      },
    });

    // Save payment link on invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
        payment_link_created_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ paymentLinkUrl: paymentLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('stripe-invoice-link error:', err);
    const status = err instanceof HttpError ? err.status : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
