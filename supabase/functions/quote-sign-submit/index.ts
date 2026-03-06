import { createServiceClient } from '../_shared/billing.ts';
import { deliverWebhookEvent } from '../_shared/webhooks.ts';

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

function decodeDataUrl(dataUrl: string) {
  const match = String(dataUrl || '').match(/^data:(image\/png);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid signature payload');
  }

  const [, contentType, base64Data] = match;
  const binary = atob(base64Data);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return { contentType, bytes };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { token, signerName, signatureDataUrl, action } = await req.json();

    if (!token) {
      return jsonResponse({ error: 'token required' }, 400);
    }

    const normalizedAction = action === 'reject' ? 'reject' : 'sign';

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, user_id, quote_number, status, signature_status, signature_token_expires_at')
      .eq('signature_token', token)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quote) return jsonResponse({ error: 'Invalid token' }, 404);
    if (quote.signature_status !== 'pending') return jsonResponse({ error: 'Signature request is no longer pending' }, 400);
    if (!quote.signature_token_expires_at || new Date(quote.signature_token_expires_at) <= new Date()) {
      return jsonResponse({ error: 'Signature link expired' }, 410);
    }

    if (normalizedAction === 'reject') {
      const { error: rejectError } = await supabase
        .from('quotes')
        .update({
          signature_status: 'rejected',
          status: 'rejected',
        })
        .eq('id', quote.id)
        .eq('signature_token', token);

      if (rejectError) throw rejectError;

      await deliverWebhookEvent(supabase, quote.user_id, 'quote.declined', {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'rejected',
        signature_status: 'rejected',
      });

      return jsonResponse({ success: true, status: 'rejected' });
    }

    if (!signerName || !String(signerName).trim()) {
      return jsonResponse({ error: 'signerName required' }, 400);
    }

    if (!signatureDataUrl) {
      return jsonResponse({ error: 'signatureDataUrl required' }, 400);
    }

    const { contentType, bytes } = decodeDataUrl(signatureDataUrl);
    const filePath = `${quote.user_id}/${quote.id}/signature-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(filePath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const signatureUrl = `storage://signatures/${filePath}`;

    const { error: signError } = await supabase
      .from('quotes')
      .update({
        signature_status: 'signed',
        status: 'accepted',
        signed_by: String(signerName).trim(),
        signed_at: new Date().toISOString(),
        signature_url: signatureUrl,
      })
      .eq('id', quote.id)
      .eq('signature_token', token);

    if (signError) throw signError;

    await Promise.all([
      deliverWebhookEvent(supabase, quote.user_id, 'quote.signed', {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'accepted',
        signature_status: 'signed',
        signed_by: String(signerName).trim(),
      }),
      deliverWebhookEvent(supabase, quote.user_id, 'quote.accepted', {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'accepted',
        signature_status: 'signed',
        signed_by: String(signerName).trim(),
      }),
    ]);

    return jsonResponse({ success: true, status: 'signed' });
  } catch (err) {
    console.error('quote-sign-submit error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
