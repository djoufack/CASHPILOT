// Supabase Edge Function: stripe-subscription-checkout
// Creates a Stripe Checkout session for subscription plans.
// Guest checkout stays public. Authenticated checkout must present a valid user JWT.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const resolveOrigin = (originHeader: string | null) => (
  isAllowedOrigin(originHeader) ? originHeader! : PRODUCTION_ORIGIN
);

const normalizeReturnUrl = (candidate: string | undefined, fallbackPath: string, origin: string) => {
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (isAllowedOrigin(parsed.origin)) {
        return parsed.toString();
      }
    } catch {
      // Fallback to safe default.
    }
  }

  return `${origin}${fallbackPath}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      planSlug,
      userId,
      customerEmail,
      successUrl,
      cancelUrl,
      billingInterval,
    } = await req.json();

    if (!planSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: planSlug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isGuest = !userId;
    const origin = resolveOrigin(req.headers.get('origin'));
    let resolvedUserId: string | null = null;
    let resolvedCustomerEmail = customerEmail || null;

    if (!isGuest) {
      const authHeader = req.headers.get('authorization');
      const accessToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

      if (authError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (authData.user.id !== userId) {
        return new Response(
          JSON.stringify({ error: 'Authenticated user mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      resolvedUserId = authData.user.id;
      resolvedCustomerEmail = authData.user.email || resolvedCustomerEmail;
    }

    // Lookup subscription plan.
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: `Plan '${planSlug}' not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (plan.slug === 'free') {
      return new Response(
        JSON.stringify({ error: 'Cannot checkout for the free plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isYearly = billingInterval === 'yearly' || billingInterval === 'annual';
    const sessionConfig: Record<string, unknown> = {
      mode: 'subscription',
      metadata: {
        plan_slug: planSlug,
        plan_id: plan.id,
        credits_per_month: plan.credits_per_month.toString(),
        billing_interval: isYearly ? 'yearly' : 'monthly',
        guest: isGuest ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          plan_slug: planSlug,
          plan_id: plan.id,
          credits_per_month: plan.credits_per_month.toString(),
          billing_interval: isYearly ? 'yearly' : 'monthly',
          guest: isGuest ? 'true' : 'false',
        },
      },
    };

    if (isGuest) {
      sessionConfig.success_url = normalizeReturnUrl(
        successUrl,
        '/signup?subscription=pending&session_id={CHECKOUT_SESSION_ID}',
        origin,
      );
      sessionConfig.cancel_url = normalizeReturnUrl(cancelUrl, '/pricing?status=cancelled', origin);
    } else {
      sessionConfig.success_url = normalizeReturnUrl(successUrl, '/pricing?status=success', origin);
      sessionConfig.cancel_url = normalizeReturnUrl(cancelUrl, '/pricing?status=cancelled', origin);

      (sessionConfig.metadata as Record<string, string>).user_id = resolvedUserId!;
      (sessionConfig.subscription_data as Record<string, unknown>).metadata = {
        ...((sessionConfig.subscription_data as Record<string, unknown>).metadata as Record<string, string>),
        user_id: resolvedUserId!,
      };

      const { data: userCredits, error: userCreditsError } = await supabase
        .from('user_credits')
        .select('user_id, stripe_customer_id')
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (userCreditsError) {
        throw userCreditsError;
      }

      let customerId = userCredits?.stripe_customer_id || null;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: resolvedCustomerEmail || undefined,
          metadata: { user_id: resolvedUserId! },
        });
        customerId = customer.id;

        if (userCredits?.user_id) {
          const { error: updateCustomerError } = await supabase
            .from('user_credits')
            .update({
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', resolvedUserId);

          if (updateCustomerError) {
            throw updateCustomerError;
          }
        } else {
          const { error: insertCustomerError } = await supabase
            .from('user_credits')
            .insert({
              user_id: resolvedUserId,
              free_credits: 10,
              paid_credits: 0,
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            });

          if (insertCustomerError) {
            throw insertCustomerError;
          }
        }
      }

      sessionConfig.customer = customerId;
    }

    const priceId = isYearly ? plan.stripe_price_id_yearly : plan.stripe_price_id;

    if (priceId) {
      sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      sessionConfig.line_items = [{
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: {
            name: `CashPilot ${plan.name}`,
            description: `Abonnement ${plan.name} — ${plan.credits_per_month} crédits/mois`,
          },
          unit_amount: isYearly ? plan.price_cents * 10 : plan.price_cents,
          recurring: { interval: isYearly ? 'year' : 'month' },
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(
      sessionConfig as Stripe.Checkout.SessionCreateParams,
    );

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
