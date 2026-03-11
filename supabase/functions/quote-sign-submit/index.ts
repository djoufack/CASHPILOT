import { createServiceClient } from '../_shared/billing.ts';
import { deliverWebhookEvent } from '../_shared/webhooks.ts';
import { computeProofHmac } from '../_shared/accountingConnectors.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
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

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { token, signerName, signatureDataUrl, action } = await req.json();
    const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim() || null;
    const userAgent = req.headers.get('user-agent') || null;
    const acceptLanguage = req.headers.get('accept-language') || null;
    const requestId = req.headers.get('x-request-id') || null;

    if (!token) {
      return jsonResponse({ error: 'token required' }, 400);
    }

    const normalizedAction = action === 'reject' ? 'reject' : 'sign';

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, user_id, company_id, quote_number, signer_email, status, signature_status, signature_token_expires_at')
      .eq('signature_token', token)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quote) return jsonResponse({ error: 'Invalid token' }, 404);
    if (quote.signature_status !== 'pending') return jsonResponse({ error: 'Signature request is no longer pending' }, 400);
    if (!quote.signature_token_expires_at || new Date(quote.signature_token_expires_at) <= new Date()) {
      return jsonResponse({ error: 'Signature link expired' }, 410);
    }

    const { data: esignSettings } = await supabase
      .from('company_esign_settings')
      .select('provider, mode')
      .eq('company_id', quote.company_id)
      .maybeSingle();

    const provider = esignSettings?.provider || 'native';

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

      await supabase
        .from('quote_signature_evidence')
        .insert({
          quote_id: quote.id,
          user_id: quote.user_id,
          company_id: quote.company_id,
          provider,
          action: 'rejected',
          signer_email: quote.signer_email || null,
          ip_address: clientIp,
          user_agent: userAgent,
          accept_language: acceptLanguage,
          request_id: requestId,
          metadata: {
            mode: esignSettings?.mode || 'redirect',
          },
          signed_at: new Date().toISOString(),
        });

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

    const normalizedSignerName = String(signerName).trim();
    const { contentType, bytes } = decodeDataUrl(signatureDataUrl);
    const signatureSha256 = await sha256Hex(bytes);
    const filePath = `${quote.user_id}/${quote.id}/signature-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(filePath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const signatureUrl = `storage://signatures/${filePath}`;
    const signedAt = new Date().toISOString();
    const proofMaterial = [
      quote.id,
      signedAt,
      signatureSha256,
      clientIp || '',
      userAgent || '',
      acceptLanguage || '',
      normalizedSignerName,
    ].join('|');
    const evidenceSecret = (Deno.env.get('SIGNATURE_EVIDENCE_SECRET') || '').trim();
    const proofToken = evidenceSecret
      ? await computeProofHmac(evidenceSecret, proofMaterial)
      : signatureSha256;

    const { error: signError } = await supabase
      .from('quotes')
      .update({
        signature_status: 'signed',
        status: 'accepted',
        signed_by: normalizedSignerName,
        signed_at: signedAt,
        signature_url: signatureUrl,
      })
      .eq('id', quote.id)
      .eq('signature_token', token);

    if (signError) throw signError;

    await supabase
      .from('quote_signature_evidence')
      .insert({
        quote_id: quote.id,
        user_id: quote.user_id,
        company_id: quote.company_id,
        provider,
        action: 'signed',
        signer_name: normalizedSignerName,
        signer_email: quote.signer_email || null,
        signature_sha256: signatureSha256,
        signature_storage_url: signatureUrl,
        ip_address: clientIp,
        user_agent: userAgent,
        accept_language: acceptLanguage,
        request_id: requestId,
        proof_token: proofToken,
        metadata: {
          mode: esignSettings?.mode || 'redirect',
          provider,
        },
        signed_at: signedAt,
      });

    await Promise.all([
      deliverWebhookEvent(supabase, quote.user_id, 'quote.signed', {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'accepted',
        signature_status: 'signed',
        signed_by: normalizedSignerName,
        signature_sha256: signatureSha256,
        signature_provider: provider,
      }),
      deliverWebhookEvent(supabase, quote.user_id, 'quote.accepted', {
        id: quote.id,
        quote_number: quote.quote_number,
        status: 'accepted',
        signature_status: 'signed',
        signed_by: normalizedSignerName,
        signature_sha256: signatureSha256,
        signature_provider: provider,
      }),
    ]);

    return jsonResponse({ success: true, status: 'signed', provider, proofToken });
  } catch (err) {
    console.error('quote-sign-submit error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
