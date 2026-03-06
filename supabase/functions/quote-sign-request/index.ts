import { createServiceClient, requireAuthenticatedUser, HttpError } from '../_shared/billing.ts';
import { deliverWebhookEvent } from '../_shared/webhooks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    const user = await requireAuthenticatedUser(req);
    const { quoteId, signerEmail } = await req.json();

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('quotes')
      .update({
        signature_status: 'pending',
        signature_token: token,
        signature_token_expires_at: expiresAt,
        signer_email: signerEmail || null,
        status: 'sent',
      })
      .eq('id', quoteId)
      .eq('user_id', user.id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://cashpilot.tech';
    await deliverWebhookEvent(supabase, user.id, 'quote.sent', {
      id: quoteId,
      status: 'sent',
      signature_status: 'pending',
      signer_email: signerEmail || null,
      signature_token_expires_at: expiresAt,
    });

    return new Response(JSON.stringify({
      signatureUrl: `${appUrl}/quote-sign/${token}`,
      expiresAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('quote-sign-request error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: err instanceof HttpError ? err.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
