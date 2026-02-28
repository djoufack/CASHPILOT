import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, peppol_document_id, peppol_status')
      .eq('id', invoice_id)
      .single();

    if (!invoice?.peppol_document_id) {
      return new Response(JSON.stringify({ error: 'No Peppol document ID for this invoice' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already final? No need to poll
    if (['delivered', 'accepted', 'error', 'rejected'].includes(invoice.peppol_status)) {
      return new Response(JSON.stringify({ status: invoice.peppol_status, final: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load Scrada credentials
    const { data: company } = await supabase
      .from('company')
      .select('scrada_company_id, scrada_api_key, scrada_password')
      .eq('user_id', user.id)
      .single();

    if (!company?.scrada_api_key) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        user_id: user.id, invoice_id, direction: 'outbound',
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
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
