import { createServiceClient, requireAuthenticatedUser, HttpError } from '../_shared/billing.ts';
import { deliverWebhookEvent } from '../_shared/webhooks.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const getDocumentEventPrefix = (documentType?: string | null) => (documentType === 'contract' ? 'contract' : 'quote');

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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const clientIp =
      (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || null;
    const userAgent = req.headers.get('user-agent') || null;
    const acceptLanguage = req.headers.get('accept-language') || null;
    const requestId = req.headers.get('x-request-id') || null;

    const { data: quoteMeta, error: quoteMetaError } = await supabase
      .from('quotes')
      .select('id, company_id, quote_number, document_type')
      .eq('id', quoteId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (quoteMetaError) {
      throw quoteMetaError;
    }

    if (!quoteMeta) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: esignSettings } = await supabase
      .from('company_esign_settings')
      .select('provider, mode')
      .eq('company_id', quoteMeta.company_id)
      .maybeSingle();

    const provider = esignSettings?.provider || 'native';
    const documentType = getDocumentEventPrefix(quoteMeta.document_type);

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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('quote_signature_evidence').insert({
      quote_id: quoteMeta.id,
      user_id: user.id,
      company_id: quoteMeta.company_id,
      provider,
      action: 'requested',
      signer_email: signerEmail || null,
      ip_address: clientIp,
      user_agent: userAgent,
      accept_language: acceptLanguage,
      request_id: requestId,
      metadata: {
        token_expires_at: expiresAt,
        mode: esignSettings?.mode || 'redirect',
      },
    });

    const appUrl = Deno.env.get('APP_URL') || 'https://cashpilot.tech';
    await deliverWebhookEvent(supabase, user.id, `${documentType}.sent`, {
      id: quoteId,
      quote_number: quoteMeta.quote_number,
      document_type: documentType,
      status: 'sent',
      signature_status: 'pending',
      signer_email: signerEmail || null,
      signature_token_expires_at: expiresAt,
      signature_provider: provider,
    });

    return new Response(
      JSON.stringify({
        signatureUrl: `${appUrl}/quote-sign/${token}`,
        expiresAt,
        provider,
        documentType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('quote-sign-request error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: err instanceof HttpError ? err.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
