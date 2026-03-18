// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout session for credit purchases

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const PRODUCTION_ORIGIN = 'https://cashpilot.tech';
const LOCAL_ORIGINS = new Set(['http://localhost:3000', 'http://localhost:5173']);

const isAllowedOrigin = (origin: string | null | undefined) => {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN || origin === 'https://www.cashpilot.tech') return true;
  if (LOCAL_ORIGINS.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app');
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

const normalizeReturnUrl = (candidate: string | undefined, fallbackPath: string, origin: string) => {
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (isAllowedOrigin(parsed.origin)) {
        return parsed.toString();
      }
    } catch {
      // Ignore malformed candidate and fallback below.
    }
  }

  return `${origin}${fallbackPath}`;
};

serve(async (req) => {
  const origin = resolveOrigin(req.headers.get('origin'));
  const corsHeaders = buildCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are missing');
    }

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    const user = await requireAuthenticatedUser(req);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { priceId, credits, userId, successUrl, cancelUrl } = await req.json();
    if (userId && userId !== user.id) {
      throw new HttpError(403, 'Authenticated user mismatch');
    }

    const requestedCredits = Number.parseInt(String(credits ?? ''), 10);
    if ((!priceId || String(priceId).trim() === '') && (!Number.isInteger(requestedCredits) || requestedCredits <= 0)) {
      throw new HttpError(400, 'Missing required credits or priceId');
    }

    let packageQuery = supabase
      .from('credit_packages')
      .select('id, name, credits, price_cents, currency, stripe_price_id, is_active')
      .eq('is_active', true);

    if (priceId) {
      packageQuery = packageQuery.eq('stripe_price_id', String(priceId));
    } else {
      packageQuery = packageQuery.eq('credits', requestedCredits);
    }

    const { data: creditPackage, error: packageError } = await packageQuery.maybeSingle();
    if (packageError) throw packageError;
    if (!creditPackage) {
      throw new HttpError(400, 'Invalid credit package');
    }

    const resolvedSuccessUrl = normalizeReturnUrl(successUrl, '/settings?tab=credits&status=success', origin);
    const resolvedCancelUrl = normalizeReturnUrl(cancelUrl, '/settings?tab=credits&status=cancelled', origin);

    const resolvedCredits = Number(creditPackage.credits || 0);
    if (!Number.isFinite(resolvedCredits) || resolvedCredits <= 0) {
      throw new HttpError(400, 'Invalid credits configuration');
    }

    const customerEmail = user.email || undefined;
    if (!customerEmail) {
      throw new HttpError(400, 'Authenticated account does not have an email');
    }

    // Build Stripe checkout config from server-side package definition only.
    let sessionConfig: Record<string, unknown> = {
      mode: 'payment',
      customer_email: customerEmail,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        user_id: user.id,
        credits: String(resolvedCredits),
        credit_package_id: creditPackage.id,
      },
    };

    if (creditPackage.stripe_price_id) {
      sessionConfig.line_items = [{ price: creditPackage.stripe_price_id, quantity: 1 }];
    } else {
      const priceCents = Number(creditPackage.price_cents || 0);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        throw new HttpError(400, 'Invalid package price configuration');
      }

      sessionConfig.line_items = [
        {
          price_data: {
            currency: String(creditPackage.currency || 'EUR').toLowerCase(),
            product_data: {
              name: `CashPilot — ${resolvedCredits} Credits`,
              description: `Pack de ${resolvedCredits} credits pour CashPilot`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig as Stripe.Checkout.SessionCreateParams);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
