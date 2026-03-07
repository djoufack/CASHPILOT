import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { consumeCredits, HttpError, refundCredits } from '../_shared/billing.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scrada-topic, x-scrada-hmac-sha256, x-scrada-company-id, x-scrada-event-id, x-scrada-triggered-at, x-scrada-attempt',
  ...SECURITY_HEADERS,
};

const PEPPOL_RECEIVE_CREDITS = 3;

async function verifyHmacSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedHex = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return computedHex === signature.toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // --- HMAC-SHA256 signature verification ---
  const rawBody = await req.text();
  const scradaWebhookSecret = Deno.env.get('SCRADA_WEBHOOK_SECRET');
  const allowInsecureWebhooks = Deno.env.get('ALLOW_INSECURE_WEBHOOKS') === 'true';
  const hmacHeader = req.headers.get('x-scrada-hmac-sha256') || '';

  if (scradaWebhookSecret) {
    if (!hmacHeader) {
      return new Response(JSON.stringify({ error: 'Missing x-scrada-hmac-sha256 header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const valid = await verifyHmacSignature(rawBody, hmacHeader, scradaWebhookSecret);
    if (!valid) {
      console.error('Peppol webhook HMAC signature verification failed');
      return new Response(JSON.stringify({ error: 'Invalid HMAC signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    if (!allowInsecureWebhooks) {
      console.error('SCRADA_WEBHOOK_SECRET is required for peppol-webhook');
      return new Response(JSON.stringify({ error: 'Webhook security misconfigured (missing SCRADA_WEBHOOK_SECRET)' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.warn('ALLOW_INSECURE_WEBHOOKS=true — skipping HMAC verification');
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const topic = req.headers.get('x-scrada-topic') || '';
    const scradaCompanyId = req.headers.get('x-scrada-company-id') || '';
    const eventId = req.headers.get('x-scrada-event-id') || '';

    // Find CashPilot user by Scrada company ID
    const { data: companyRecord } = await supabaseAdmin
      .from('company')
      .select('user_id, id, peppol_endpoint_id, peppol_scheme_id')
      .eq('scrada_company_id', scradaCompanyId)
      .maybeSingle();

    if (!companyRecord) {
      return new Response(JSON.stringify({ error: 'Unknown Scrada company ID' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = companyRecord.user_id;

    // Handle outbound status update
    if (topic === 'peppolOutboundDocument/statusUpdate') {
      const body = JSON.parse(rawBody);

      const statusMap: Record<string, string> = {
        'Created': 'pending',
        'Processed': 'delivered',
        'Error': 'error',
      };
      const mappedStatus = statusMap[body.status] || body.status?.toLowerCase() || 'pending';

      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('peppol_document_id', body.id)
        .maybeSingle();

      if (invoice) {
        await supabaseAdmin.from('invoices').update({
          peppol_status: mappedStatus,
          peppol_error_message: body.status === 'Error' ? (body.errorMessage || null) : null,
        }).eq('id', invoice.id);

        await supabaseAdmin.from('peppol_transmission_log').insert({
          user_id: userId, company_id: companyRecord.id, invoice_id: invoice.id, direction: 'outbound',
          status: mappedStatus, ap_provider: 'scrada', ap_document_id: body.id,
          error_message: body.errorMessage || null, metadata: body,
        });
      }

      return new Response(JSON.stringify({ received: true, topic }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle inbound document (new Peppol invoice received)
    if (topic === 'peppolInboundDocument/new') {
      const documentId = req.headers.get('x-scrada-document-id') || '';
      const senderPeppolId = req.headers.get('x-scrada-peppol-sender-id') || '';
      const contentType = req.headers.get('content-type') || '';

      let ublXml: string | null = null;
      if (contentType.includes('xml')) {
        ublXml = rawBody;
      }

      // Check for duplicates
      const { data: existing } = await supabaseAdmin
        .from('peppol_inbound_documents')
        .select('id')
        .eq('scrada_document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        let creditDeduction = null;

        try {
          creditDeduction = await consumeCredits(
            supabaseAdmin,
            userId,
            PEPPOL_RECEIVE_CREDITS,
            `Peppol inbound webhook ${documentId}`,
          );

          const metadata = {
            eventId,
            topic,
            senderPeppolId,
            c2MessageId: req.headers.get('x-scrada-peppol-c2-message-id'),
            c3Timestamp: req.headers.get('x-scrada-peppol-c3-timestamp'),
          };

          const { error: insertDocError } = await supabaseAdmin.from('peppol_inbound_documents').insert({
            user_id: userId,
            scrada_document_id: documentId,
            sender_peppol_id: senderPeppolId,
            document_type: 'invoice',
            ubl_xml: ublXml,
            status: 'new',
            metadata,
          });
          if (insertDocError) throw insertDocError;

          // Inbound Scrada documents are not linked to a local sales invoice.
          // The current transmission log schema requires invoice_id, so we persist
          // the inbound document itself and skip log insertion here.
        } catch (error) {
          if (creditDeduction) {
            await refundCredits(
              supabaseAdmin,
              userId,
              creditDeduction,
              `Refund Peppol inbound webhook ${documentId}`,
            );
          }

          if (error instanceof HttpError && error.status === 402) {
            return new Response(JSON.stringify({ error: 'insufficient_credits', documentId }), {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          throw error;
        }
      }

      return new Response(JSON.stringify({ received: true, topic, documentId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unknown topic — acknowledge anyway
    return new Response(JSON.stringify({ received: true, topic, unhandled: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
