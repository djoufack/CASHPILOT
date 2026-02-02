// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout session for credit purchases

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const { priceId, credits, userId, customerEmail, successUrl, cancelUrl } = await req.json();

    if (!credits || !userId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: credits, userId, customerEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create the price based on package data
    let sessionConfig: Record<string, unknown> = {
      mode: 'payment',
      customer_email: customerEmail,
      success_url: successUrl || `${req.headers.get('origin')}/settings?tab=credits&status=success`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/settings?tab=credits&status=cancelled`,
      metadata: {
        user_id: userId,
        credits: credits.toString(),
      },
    };

    if (priceId) {
      // Use existing Stripe Price ID
      sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      // Create a one-time price on the fly based on credits
      const packPricing: Record<number, number> = {
        100: 499,
        500: 1999,
        1500: 4999,
        5000: 12999,
      };
      const priceCents = packPricing[credits] || Math.round(credits * 5); // fallback: 5c/credit

      sessionConfig.line_items = [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `CashPilot — ${credits} Credits`,
            description: `Pack de ${credits} crédits pour CashPilot`,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig as Stripe.Checkout.SessionCreateParams);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
