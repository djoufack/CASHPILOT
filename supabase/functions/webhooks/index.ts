import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { userId, event, payload } = await req.json();

    if (!userId || !event || !payload) {
      return new Response(JSON.stringify({ error: 'Missing userId, event, or payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find active endpoints subscribed to this event
    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (!endpoints?.length) {
      return new Response(JSON.stringify({ success: true, delivered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];

    for (const endpoint of endpoints) {
      // Create HMAC signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(endpoint.secret);
      const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const payloadStr = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
      const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signatureHex,
            'X-Webhook-Event': event,
          },
          body: payloadStr,
        });

        const responseBody = await res.text().catch(() => '');

        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event,
          payload: { event, data: payload },
          status_code: res.status,
          response_body: responseBody.slice(0, 1000),
          delivered: res.ok,
          attempts: 1,
        });

        await supabase.from('webhook_endpoints').update({
          last_triggered_at: new Date().toISOString(),
          failure_count: res.ok ? 0 : endpoint.failure_count + 1,
        }).eq('id', endpoint.id);

        results.push({ endpoint_id: endpoint.id, status: res.ok ? 'delivered' : 'failed', status_code: res.status });
      } catch (err) {
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event,
          payload: { event, data: payload },
          delivered: false,
          attempts: 1,
        });
        results.push({ endpoint_id: endpoint.id, status: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, delivered: results.filter(r => r.status === 'delivered').length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
