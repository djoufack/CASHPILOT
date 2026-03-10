import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { consumeCredits, createAuthClient, HttpError, refundCredits, requireAuthenticatedUser, resolveCreditCost } from '../_shared/billing.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Missing authorization');
    }

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);
    const body = await req.json();
    const action = body.action || 'list';

    const { data: company } = await supabase
      .from('company')
      .select('peppol_endpoint_id, peppol_scheme_id, scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted')
      .eq('user_id', user.id)
      .single();

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!company?.scrada_company_id || !apiKey || !password) {
      throw new HttpError(400, 'Scrada credentials not configured');
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password,
      'Language': 'FR',
    };

    if (action === 'list') {
      const { data: docs } = await supabase
        .from('peppol_inbound_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ documents: docs || [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { ...scradaHeaders, 'Content-Type': 'application/json' },
      });

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        throw new HttpError(502, `Scrada API error: ${errText}`);
      }

      const scradaDocs = await scradaResponse.json();
      const documents = Array.isArray(scradaDocs) ? scradaDocs : [];
      const newDocuments = [];

      for (const doc of documents) {
        const docId = doc.id || doc.documentId;
        if (!docId) continue;

        const { data: existing } = await supabase
          .from('peppol_inbound_documents')
          .select('id')
          .eq('scrada_document_id', docId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          newDocuments.push({ docId, doc });
        }
      }

      if (newDocuments.length === 0) {
        return new Response(JSON.stringify({
          synced: true,
          totalFromScrada: documents.length,
          newDocuments: 0,
          requiredCredits: 0,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const peppolReceiveCredits = await resolveCreditCost(supabase, 'PEPPOL_RECEIVE_INVOICE');
      const requiredCredits = newDocuments.length * peppolReceiveCredits;
      let creditDeduction = null;

      try {
        creditDeduction = await consumeCredits(
          supabase,
          user.id,
          requiredCredits,
          `Peppol inbound sync (${newDocuments.length} invoices)`,
        );
      } catch (error) {
        if (error instanceof HttpError && error.status === 402) {
          return new Response(JSON.stringify({
            error: 'insufficient_credits',
            insufficientCredits: true,
            requiredCredits,
            newDocuments: newDocuments.length,
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }

      try {
        const inboundRows = newDocuments.map(({ docId, doc }) => ({
          user_id: user.id,
          scrada_document_id: docId,
          sender_peppol_id: doc.peppolSenderID || doc.senderID || null,
          sender_name: doc.senderName || null,
          document_type: doc.documentType || 'invoice',
          invoice_number: doc.invoiceNumber || null,
          invoice_date: doc.invoiceDate || null,
          total_excl_vat: doc.totalExclVat || null,
          total_vat: doc.totalVat || null,
          total_incl_vat: doc.totalInclVat || null,
          currency: doc.currency || 'EUR',
          status: 'new',
          metadata: doc,
          received_at: doc.receivedAt || doc.createdOn || new Date().toISOString(),
        }));

        const { error: insertDocsError } = await supabase
          .from('peppol_inbound_documents')
          .insert(inboundRows);
        if (insertDocsError) throw insertDocsError;
      } catch (error) {
        await refundCredits(
          supabase,
          user.id,
          creditDeduction,
          `Refund Peppol inbound sync (${newDocuments.length} invoices)`,
        );
        throw error;
      }

      return new Response(JSON.stringify({
        synced: true,
        totalFromScrada: documents.length,
        newDocuments: newDocuments.length,
        requiredCredits,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_ubl' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { ...scradaHeaders, 'Content-Type': 'application/xml' },
      });

      if (!scradaResponse.ok) {
        throw new HttpError(404, 'Document not found in Scrada');
      }

      const ublXml = await scradaResponse.text();
      return new Response(JSON.stringify({ ubl: ublXml }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_pdf' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}/pdf`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'X-PASSWORD': password,
        },
      });

      if (!scradaResponse.ok) {
        throw new HttpError(404, 'PDF not available');
      }

      const pdfBuffer = await scradaResponse.arrayBuffer();
      return new Response(pdfBuffer, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    throw new HttpError(400, 'Unknown action. Use: list, sync, get_ubl, get_pdf');
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});




