// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events for credit purchases AND subscriptions

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { deliverWebhookEvent } from '../_shared/webhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const ensureUserCreditsRow = async (supabase: ReturnType<typeof createClient>, userId: string) => {
  const { data: existingCredits, error: existingCreditsError } = await supabase
    .from('user_credits')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingCreditsError) {
    throw existingCreditsError;
  }

  if (existingCredits) {
    return;
  }

  const { error: insertCreditsError } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      free_credits: 10,
      paid_credits: 0,
      updated_at: new Date().toISOString(),
    });

  if (insertCreditsError) {
    throw insertCreditsError;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // checkout.session.completed
    // ========================================
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;

      // --- Subscription checkout ---
      if (session.mode === 'subscription') {
        const planSlug = session.metadata?.plan_slug;
        const planId = session.metadata?.plan_id;
        const creditsPerMonth = parseInt(session.metadata?.credits_per_month || '0', 10);
        const subscriptionId = session.subscription as string;
        const isGuest = session.metadata?.guest === 'true';

        if (!planSlug) {
          console.error('Missing plan_slug in metadata', session.metadata);
          return new Response(
            JSON.stringify({ error: 'Missing plan_slug metadata' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Retrieve subscription to get current_period_end
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        if (isGuest || !userId) {
          // --- Guest checkout: store as pending subscription ---
          const customerEmail = session.customer_details?.email || session.customer_email || '';

          const { error: pendingError } = await supabase
            .from('pending_subscriptions')
            .upsert({
              stripe_customer_email: customerEmail,
              stripe_customer_id: session.customer as string || null,
              stripe_subscription_id: subscriptionId,
              plan_slug: planSlug,
              plan_id: planId,
              credits_per_month: creditsPerMonth,
              billing_interval: session.metadata?.billing_interval || 'monthly',
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              stripe_session_id: session.id,
            }, { onConflict: 'stripe_session_id' });

          if (pendingError) {
            console.error('Failed to store pending subscription:', pendingError);
            throw pendingError;
          }

          console.log(`Guest subscription ${planSlug} stored as pending for ${customerEmail}`);
        } else {
          // --- Authenticated user checkout ---
          const { data: existingSubscriptionTx, error: existingSubscriptionTxError } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('stripe_session_id', session.id)
            .maybeSingle();

          if (existingSubscriptionTxError) {
            throw existingSubscriptionTxError;
          }

          if (existingSubscriptionTx) {
            console.log('Subscription session already processed:', session.id);
            return new Response(
              JSON.stringify({ received: true, status: 'already_processed' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          await ensureUserCreditsRow(supabase, userId);

          const { error: updateError } = await supabase
            .from('user_credits')
            .update({
              subscription_plan_id: planId,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
              subscription_status: 'active',
              subscription_credits: creditsPerMonth,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          if (updateError) {
            console.error('Failed to activate subscription:', updateError);
            throw updateError;
          }

          // Log transaction
          await supabase.from('credit_transactions').insert({
            user_id: userId,
            type: 'subscription',
            amount: creditsPerMonth,
            description: `Abonnement ${planSlug} activé — ${creditsPerMonth} crédits`,
            stripe_session_id: session.id,
          });

          console.log(`Subscription ${planSlug} activated for user ${userId} (${creditsPerMonth} credits)`);
        }

      // --- Invoice payment via Stripe Payment Link ---
      } else if (session.metadata?.invoice_id) {
        const invoiceId = session.metadata.invoice_id;
        const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
        const invoiceUserId = session.metadata.user_id;
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('invoice_number, client_id, company_id, amount_paid')
          .eq('id', invoiceId)
          .maybeSingle();

        const newAmountPaid = Number(existingInvoice?.amount_paid || 0) + amountPaid;

        await supabase
          .from('invoices')
          .update({
            payment_status: 'paid',
            status: 'paid',
            amount_paid: newAmountPaid,
            balance_due: 0,
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq('id', invoiceId);

        // Create payment record
        if (invoiceUserId) {
          await supabase.from('payments').insert({
            user_id: invoiceUserId,
            invoice_id: invoiceId,
            payment_date: new Date().toISOString().split('T')[0],
            amount: amountPaid,
            payment_method: 'card',
            reference: session.id,
            notes: 'Paiement en ligne via Stripe Payment Link',
          });

          await Promise.all([
            deliverWebhookEvent(supabase, invoiceUserId, 'invoice.paid', {
              id: invoiceId,
              invoice_number: existingInvoice?.invoice_number,
              client_id: existingInvoice?.client_id,
              company_id: existingInvoice?.company_id,
              status: 'paid',
              payment_status: 'paid',
              amount_paid: newAmountPaid,
            }),
            deliverWebhookEvent(supabase, invoiceUserId, 'payment.received', {
              invoice_id: invoiceId,
              amount: amountPaid,
              payment_method: 'card',
              reference: session.id,
              company_id: existingInvoice?.company_id,
            }),
          ]);
        }

        console.log(`Invoice ${invoiceId} marked as paid via Stripe Payment Link (session: ${session.id})`);

      // --- One-time credit purchase ---
      } else {
        const credits = parseInt(session.metadata?.credits || '0', 10);

        if (!userId || !credits) {
          console.error('Missing metadata: user_id or credits', session.metadata);
          return new Response(
            JSON.stringify({ error: 'Missing metadata' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Idempotency check
        const { data: existingTx } = await supabase
          .from('credit_transactions')
          .select('id')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (existingTx) {
          console.log('Session already processed:', session.id);
          return new Response(
            JSON.stringify({ received: true, status: 'already_processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add credits
        await ensureUserCreditsRow(supabase, userId);

        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('paid_credits')
          .eq('user_id', userId)
          .single();

        const currentPaid = currentCredits?.paid_credits || 0;

        const { error: updateError } = await supabase
          .from('user_credits')
          .update({
            paid_credits: currentPaid + credits,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Failed to update credits:', updateError);
          throw updateError;
        }

        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'purchase',
          amount: credits,
          description: `Purchased ${credits} credits via Stripe`,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent as string,
        });

        console.log(`Credited ${credits} credits to user ${userId} (session: ${session.id})`);
      }
    }

    // ========================================
    // invoice.paid — Monthly subscription renewal
    // ========================================
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      // Skip if not a subscription invoice or first invoice (handled by checkout)
      if (!subscriptionId || invoice.billing_reason === 'subscription_create') {
        return new Response(
          JSON.stringify({ received: true, status: 'skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by stripe_subscription_id
      const { data: userCredits } = await supabase
        .from('user_credits')
        .select('user_id, subscription_plan_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (!userCredits) {
        console.error('No user found for subscription:', subscriptionId);
        return new Response(
          JSON.stringify({ received: true, status: 'user_not_found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get plan credits
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('credits_per_month, name, slug')
        .eq('id', userCredits.subscription_plan_id)
        .single();

      if (!plan) {
        console.error('Plan not found:', userCredits.subscription_plan_id);
        return new Response(
          JSON.stringify({ received: true, status: 'plan_not_found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retrieve subscription for period end
      const sub = await stripe.subscriptions.retrieve(subscriptionId);

      // Reset subscription credits to monthly quota
      const { error: resetError } = await supabase
        .from('user_credits')
        .update({
          subscription_credits: plan.credits_per_month,
          subscription_status: 'active',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userCredits.user_id);

      if (resetError) {
        console.error('Failed to reset subscription credits:', resetError);
        throw resetError;
      }

      await supabase.from('credit_transactions').insert({
        user_id: userCredits.user_id,
        type: 'subscription_renewal',
        amount: plan.credits_per_month,
        description: `Renouvellement ${plan.name} — ${plan.credits_per_month} crédits`,
      });

      console.log(`Renewed ${plan.slug} for user ${userCredits.user_id} (${plan.credits_per_month} credits)`);
    }

    // ========================================
    // customer.subscription.updated — Plan change
    // ========================================
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (!userId) {
        console.log('No user_id in subscription metadata, skipping');
        return new Response(
          JSON.stringify({ received: true, status: 'no_metadata' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const planSlug = subscription.metadata?.plan_slug;
      const planId = subscription.metadata?.plan_id;
      const creditsPerMonth = parseInt(subscription.metadata?.credits_per_month || '0', 10);

      const updateData: Record<string, unknown> = {
        subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (planId) {
        updateData.subscription_plan_id = planId;
        updateData.subscription_credits = creditsPerMonth;
      }

      await supabase
        .from('user_credits')
        .update(updateData)
        .eq('user_id', userId);

      console.log(`Subscription updated for user ${userId}: status=${subscription.status}, plan=${planSlug}`);
    }

    // ========================================
    // customer.subscription.deleted — Cancellation
    // ========================================
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (!userId) {
        // Fallback: find by subscription ID
        const { data: userCredits } = await supabase
          .from('user_credits')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (userCredits) {
          await supabase
            .from('user_credits')
            .update({
              subscription_status: 'canceled',
              subscription_credits: 0,
              stripe_subscription_id: null,
              subscription_plan_id: null,
              current_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userCredits.user_id);

          await supabase.from('credit_transactions').insert({
            user_id: userCredits.user_id,
            type: 'subscription_canceled',
            amount: 0,
            description: 'Abonnement annulé',
          });

          console.log(`Subscription canceled for user ${userCredits.user_id}`);
        }
      } else {
        await supabase
          .from('user_credits')
          .update({
            subscription_status: 'canceled',
            subscription_credits: 0,
            stripe_subscription_id: null,
            subscription_plan_id: null,
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'subscription_canceled',
          amount: 0,
          description: 'Abonnement annulé',
        });

        console.log(`Subscription canceled for user ${userId}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
