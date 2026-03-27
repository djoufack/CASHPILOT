import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
  });
}

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === signatureHeader;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('Webhook-Signature') || '';
    let webhookSecret = Deno.env.get('GOCARDLESS_WEBHOOK_SECRET') || '';
    if (!webhookSecret) {
      const supabaseForVault = getServiceClient();
      const { data: vaultResult } = await supabaseForVault.rpc('get_vault_secret', {
        secret_name: 'GOCARDLESS_WEBHOOK_SECRET',
      });
      webhookSecret = vaultResult || '';
    }

    // Verify signature if secret configured
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        return json({ error: 'Invalid webhook signature' }, 401);
      }
    }

    const payload = JSON.parse(rawBody);
    const events = payload?.events || [];
    const supabase = getServiceClient();
    const results: { event_id: string; processed: boolean }[] = [];

    for (const event of events) {
      const eventId = event.id;
      const resourceType = event.resource_type;
      const action = event.action;
      const resourceId = event.links?.[resourceType] || null;

      // Idempotency check
      const { data: existing } = await supabase
        .from('gocardless_webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        results.push({ event_id: eventId, processed: false });
        continue;
      }

      // Resolve company_id from metadata
      let companyId: string | null = null;
      const metadata = event.details?.metadata || event.links?.metadata || {};
      if (metadata.cashpilot_company_id) {
        companyId = metadata.cashpilot_company_id;
      }

      // Store event
      await supabase.from('gocardless_webhook_events').insert({
        event_id: eventId,
        resource_type: resourceType,
        action,
        resource_id: resourceId,
        company_id: companyId,
        payload: event,
        processed_at: new Date().toISOString(),
      });

      // Process by resource type
      if (resourceType === 'mandates' && resourceId) {
        await supabase
          .from('gocardless_mandates')
          .update({ status: action, updated_at: new Date().toISOString() })
          .eq('gocardless_mandate_id', resourceId);
      }

      if (resourceType === 'payments' && resourceId) {
        const statusMap: Record<string, string> = {
          created: 'pending_submission',
          submitted: 'submitted',
          confirmed: 'confirmed',
          paid_out: 'paid_out',
          failed: 'failed',
          cancelled: 'cancelled',
          charged_back: 'charged_back',
        };

        const newStatus = statusMap[action] || action;
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (action === 'failed') {
          updatePayload.failure_reason =
            event.details?.cause || event.details?.description || 'Payment failed';
        }

        await supabase
          .from('gocardless_payments')
          .update(updatePayload)
          .eq('gocardless_payment_id', resourceId);

        // If paid_out, update linked invoice
        if (action === 'paid_out') {
          const { data: gcPayment } = await supabase
            .from('gocardless_payments')
            .select('invoice_id, amount_cents, currency, company_id')
            .eq('gocardless_payment_id', resourceId)
            .maybeSingle();

          if (gcPayment?.invoice_id) {
            await supabase.from('payments').insert({
              company_id: gcPayment.company_id,
              invoice_id: gcPayment.invoice_id,
              amount: gcPayment.amount_cents / 100,
              currency: gcPayment.currency,
              payment_method: 'direct_debit',
              payment_date: new Date().toISOString().split('T')[0],
              notes: `GoCardless Direct Debit - ${resourceId}`,
            });
          }
        }
      }

      results.push({ event_id: eventId, processed: true });
    }

    return json({ success: true, events_processed: results });
  } catch (error) {
    console.error('Webhook error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      500
    );
  }
});
