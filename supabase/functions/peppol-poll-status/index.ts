import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';

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
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new HttpError(400, 'invoice_id is required');

    // Load invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, company_id, peppol_document_id, peppol_status')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();

    if (!invoice?.peppol_document_id) throw new HttpError(400, 'No Peppol document ID for this invoice');

    // Already final? No need to poll
    if (['delivered', 'accepted', 'error', 'rejected'].includes(invoice.peppol_status)) {
      return new Response(JSON.stringify({ status: invoice.peppol_status, final: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load Scrada credentials
    let companyQuery = supabase
      .from('company')
      .select('id, scrada_company_id, scrada_api_key, scrada_password')
      .eq('user_id', user.id);
    if (invoice.company_id) {
      companyQuery = companyQuery.eq('id', invoice.company_id);
    } else {
      companyQuery = companyQuery.order('created_at', { ascending: true }).limit(1);
    }
    const { data: company } = await companyQuery.single();

    if (!company?.scrada_api_key) throw new HttpError(400, 'Scrada credentials not configured');

    // Poll Scrada
    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const statusUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolOutbound/${invoice.peppol_document_id}/status`;

    const scradaResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': company.scrada_api_key,
        'X-PASSWORD': company.scrada_password,
        'Language': 'FR',
      },
    });

    if (!scradaResponse.ok) {
      const errText = await scradaResponse.text();
      return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaData = await scradaResponse.json();

    const statusMap: Record<string, string> = {
      'Created': 'pending',
      'Processed': 'delivered',
      'Error': 'error',
    };
    const mappedStatus = statusMap[scradaData.status] || scradaData.status?.toLowerCase() || 'pending';
    const isFinal = ['delivered', 'error', 'rejected'].includes(mappedStatus);

    // Update invoice if status changed
    if (mappedStatus !== invoice.peppol_status) {
      await supabase.from('invoices').update({
        peppol_status: mappedStatus,
        peppol_error_message: scradaData.errorMessage || null,
      }).eq('id', invoice_id);

      await supabase.from('peppol_transmission_log').insert({
        user_id: user.id, company_id: invoice.company_id || company.id, invoice_id, direction: 'outbound',
        status: mappedStatus, ap_provider: 'scrada',
        ap_document_id: invoice.peppol_document_id,
        error_message: scradaData.errorMessage || null,
        metadata: scradaData,
      });
    }

    return new Response(JSON.stringify({
      status: mappedStatus, final: isFinal,
      scradaStatus: scradaData.status,
      errorMessage: scradaData.errorMessage || null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
