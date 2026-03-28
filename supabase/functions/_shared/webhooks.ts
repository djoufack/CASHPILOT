import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export const SUPPORTED_WEBHOOK_EVENTS = [
  'invoice.created',
  'invoice.updated',
  'invoice.sent',
  'invoice.paid',
  'invoice.overdue',
  'invoice.cancelled',
  'payment.received',
  'quote.created',
  'quote.sent',
  'quote.accepted',
  'quote.declined',
  'quote.signed',
  'contract.created',
  'contract.sent',
  'contract.accepted',
  'contract.declined',
  'contract.signed',
  'client.created',
  'client.updated',
  'client.deleted',
  'expense.created',
  'project.created',
  'project.completed',
  'project.updated',
  'task.created',
  'task.completed',
  'timesheet.created',
  'timesheet.invoiced',
];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverWebhook(
  endpoint: { id: string; url: string; secret: string; failure_count: number },
  event: string,
  payload: unknown,
  supabase: ReturnType<typeof createClient>
): Promise<{ delivered: boolean; status_code?: number; error?: string; attempts: number }> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(endpoint.secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const timestamp = new Date().toISOString();
  const payloadStr = JSON.stringify({ event, data: payload, timestamp });
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  let lastStatusCode: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
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
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseBody = await res.text().catch(() => '');
      lastStatusCode = res.status;

      if (res.ok) {
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event,
          payload: { event, data: payload },
          status_code: res.status,
          response_body: responseBody.slice(0, 1000),
          delivered: true,
          attempts: attempt,
        });

        await supabase
          .from('webhook_endpoints')
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: 0,
          })
          .eq('id', endpoint.id);

        return { delivered: true, status_code: res.status, attempts: attempt };
      }

      if (res.status < 500) {
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

export async function deliverWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  event: string,
  payload: unknown
) {
  if (!SUPPORTED_WEBHOOK_EVENTS.includes(event)) {
    throw new Error(`Unsupported event: ${event}`);
  }

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!endpoints?.length) {
    return { success: true, delivered: 0, total_endpoints: 0, auto_disabled: 0, results: [] };
  }

  const activeEndpoints = endpoints.filter((endpoint: { failure_count: number }) => endpoint.failure_count < 10);
  const disabledEndpoints = endpoints.filter((endpoint: { failure_count: number }) => endpoint.failure_count >= 10);

  for (const endpoint of disabledEndpoints) {
    await supabase.from('webhook_endpoints').update({ is_active: false }).eq('id', endpoint.id);
  }

  const results = [];
  for (const endpoint of activeEndpoints) {
    const result = await deliverWebhook(endpoint, event, payload, supabase);
    results.push({
      endpoint_id: endpoint.id,
      ...result,
    });
  }

  return {
    success: true,
    delivered: results.filter((result) => result.delivered).length,
    total_endpoints: activeEndpoints.length,
    auto_disabled: disabledEndpoints.length,
    results,
  };
}
