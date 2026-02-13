import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported webhook events
const SUPPORTED_EVENTS = [
  'invoice.created',
  'invoice.paid',
  'payment.received',
  'client.created',
  'expense.created',
];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s backoff

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deliverWebhook(
  endpoint: { id: string; url: string; secret: string; failure_count: number },
  event: string,
  payload: unknown,
  supabase: ReturnType<typeof createClient>,
): Promise<{ delivered: boolean; status_code?: number; error?: string; attempts: number }> {

  const encoder = new TextEncoder();
  const keyData = encoder.encode(endpoint.secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const timestamp = new Date().toISOString();
  const payloadStr = JSON.stringify({ event, data: payload, timestamp });
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  let lastStatusCode: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signatureHex,
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Delivery-Attempt': String(attempt),
        },
        body: payloadStr,
      });

      const responseBody = await res.text().catch(() => '');
      lastStatusCode = res.status;

      if (res.ok) {
        // Log successful delivery
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event,
          payload: { event, data: payload },
          status_code: res.status,
          response_body: responseBody.slice(0, 1000),
          delivered: true,
          attempts: attempt,
        });

        // Reset failure count on success
        await supabase.from('webhook_endpoints').update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0,
        }).eq('id', endpoint.id);

        return { delivered: true, status_code: res.status, attempts: attempt };
      }

      // If server error (5xx), retry; if client error (4xx), don't retry
      if (res.status < 500) {
        // Log client-side failure (no retry)
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event,
          payload: { event, data: payload },
          status_code: res.status,
          response_body: responseBody.slice(0, 1000),
          delivered: false,
          attempts: attempt,
        });

        await supabase.rpc('increment_webhook_failure', { endpoint_id: endpoint.id });

        return { delivered: false, status_code: res.status, attempts: attempt };
      }

      // 5xx - wait and retry
      lastError = `HTTP ${res.status}`;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt - 1]);
      }
    } catch (err) {
      lastError = (err as Error).message;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt - 1]);
      }
    }
  }

  // All retries exhausted
  await supabase.from('webhook_deliveries').insert({
    webhook_endpoint_id: endpoint.id,
    event,
    payload: { event, data: payload },
    status_code: lastStatusCode ?? null,
    response_body: lastError?.slice(0, 1000) ?? null,
    delivered: false,
    attempts: MAX_RETRIES,
  });

  await supabase.rpc('increment_webhook_failure', { endpoint_id: endpoint.id });

  return { delivered: false, status_code: lastStatusCode, error: lastError, attempts: MAX_RETRIES };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Authenticate the caller via JWT
    const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const verifiedUserId = user.id;

    // Service-role client for data operations
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { event, payload } = await req.json();

    if (!event || !payload) {
      return jsonResponse({ error: 'Missing event or payload' }, 400);
    }

    // Validate event type
    if (!SUPPORTED_EVENTS.includes(event)) {
      return jsonResponse({
        error: `Unsupported event: ${event}`,
        supported_events: SUPPORTED_EVENTS,
      }, 400);
    }

    // Find active endpoints subscribed to this event
    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('user_id', verifiedUserId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (!endpoints?.length) {
      return jsonResponse({ success: true, delivered: 0, message: 'No active endpoints for this event' });
    }

    // Auto-disable endpoints with too many consecutive failures (> 10)
    const activeEndpoints = endpoints.filter((ep: { failure_count: number }) => ep.failure_count < 10);
    const disabledEndpoints = endpoints.filter((ep: { failure_count: number }) => ep.failure_count >= 10);

    // Mark endpoints with too many failures as inactive
    for (const ep of disabledEndpoints) {
      await supabase.from('webhook_endpoints').update({ is_active: false }).eq('id', ep.id);
    }

    const results = [];

    for (const endpoint of activeEndpoints) {
      const result = await deliverWebhook(endpoint, event, payload, supabase);
      results.push({
        endpoint_id: endpoint.id,
        ...result,
      });
    }

    return jsonResponse({
      success: true,
      delivered: results.filter(r => r.delivered).length,
      total_endpoints: activeEndpoints.length,
      auto_disabled: disabledEndpoints.length,
      results,
    });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
