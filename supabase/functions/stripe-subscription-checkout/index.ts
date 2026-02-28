// Supabase Edge Function: stripe-subscription-checkout
// Creates a Stripe Checkout session for subscription plans

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { planSlug, userId, customerEmail, successUrl, cancelUrl } = await req.json();

    if (!planSlug || !userId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: planSlug, userId, customerEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lookup subscription plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: `Plan '${planSlug}' not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (plan.slug === 'free') {
      return new Response(
        JSON.stringify({ error: 'Cannot checkout for the free plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = userCredits?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      await supabase
        .from('user_credits')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // Build checkout session config
    const origin = req.headers.get('origin') || 'https://cashpilot.tech';
    const sessionConfig: Record<string, unknown> = {
      mode: 'subscription',
      customer: customerId,
      success_url: successUrl || `${origin}/pricing?status=success`,
      cancel_url: cancelUrl || `${origin}/pricing?status=cancelled`,
      metadata: {
        user_id: userId,
        plan_slug: planSlug,
        plan_id: plan.id,
        credits_per_month: plan.credits_per_month.toString(),
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_slug: planSlug,
          plan_id: plan.id,
          credits_per_month: plan.credits_per_month.toString(),
        },
      },
    };

    if (plan.stripe_price_id) {
      // Use pre-configured Stripe Price
      sessionConfig.line_items = [{ price: plan.stripe_price_id, quantity: 1 }];
    } else {
      // Create recurring price on the fly
      sessionConfig.line_items = [{
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: {
            name: `CashPilot ${plan.name}`,
            description: `Abonnement ${plan.name} — ${plan.credits_per_month} crédits/mois`,
          },
          unit_amount: plan.price_cents,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(
      sessionConfig as Stripe.Checkout.SessionCreateParams
    );

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
