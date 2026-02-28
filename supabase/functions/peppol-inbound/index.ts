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

    const body = await req.json();
    const action = body.action || 'list';

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

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': company.scrada_api_key,
      'X-PASSWORD': company.scrada_password,
      'Language': 'FR',
    };

    // List locally stored inbound documents
    if (action === 'list') {
      const { data: docs } = await supabase
        .from('peppol_inbound_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ documents: docs || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync: fetch from Scrada and store new documents locally
    if (action === 'sync') {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET', headers: { ...scradaHeaders, 'Content-Type': 'application/json' },
      });

      if (!scradaResponse.ok) {
        const errText = await scradaResponse.text();
        return new Response(JSON.stringify({ error: `Scrada API error: ${errText}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const scradaDocs = await scradaResponse.json();
      const documents = Array.isArray(scradaDocs) ? scradaDocs : [];
      let newCount = 0;

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
          await supabase.from('peppol_inbound_documents').insert({
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
          });
          newCount++;
        }
      }

      return new Response(JSON.stringify({
        synced: true, totalFromScrada: documents.length, newDocuments: newCount,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get UBL XML for a specific inbound document
    if (action === 'get_ubl' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET', headers: { ...scradaHeaders, 'Content-Type': 'application/xml' },
      });

      if (!scradaResponse.ok) {
        return new Response(JSON.stringify({ error: 'Document not found in Scrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ublXml = await scradaResponse.text();
      return new Response(JSON.stringify({ ubl: ublXml }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PDF for a specific inbound document
    if (action === 'get_pdf' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/${body.document_id}/pdf`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { 'X-API-KEY': company.scrada_api_key, 'X-PASSWORD': company.scrada_password },
      });

      if (!scradaResponse.ok) {
        return new Response(JSON.stringify({ error: 'PDF not available' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pdfBuffer = await scradaResponse.arrayBuffer();
      return new Response(pdfBuffer, {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: list, sync, get_ubl, get_pdf' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
