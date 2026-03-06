import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser, requireEntitlement } from '../_shared/billing.ts';
import { SUPPORTED_WEBHOOK_EVENTS, deliverWebhookEvent } from '../_shared/webhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authUser = await requireAuthenticatedUser(req);
    const verifiedUserId = authUser.id;
    const supabase = createServiceClient();
    await requireEntitlement(supabase, verifiedUserId, 'developer.webhooks');
    const { event, payload } = await req.json();

    if (!event || !payload) {
      return jsonResponse({ error: 'Missing event or payload' }, 400);
    }

    // Validate event type
    if (!SUPPORTED_WEBHOOK_EVENTS.includes(event)) {
      return jsonResponse({
        error: `Unsupported event: ${event}`,
        supported_events: SUPPORTED_WEBHOOK_EVENTS,
      }, 400);
    }

    const result = await deliverWebhookEvent(supabase, verifiedUserId, event, payload);
    if (result.total_endpoints === 0) {
      return jsonResponse({ ...result, message: 'No active endpoints for this event' });
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      { error: (error as Error).message },
      error instanceof HttpError ? error.status : 500,
    );
  }
});
