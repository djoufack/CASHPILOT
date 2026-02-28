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

    // Load Scrada credentials
    const { data: company } = await supabase
      .from('company')
      .select('scrada_company_id, scrada_api_key, scrada_password, peppol_endpoint_id, peppol_scheme_id')
      .eq('user_id', user.id)
      .single();

    if (!company?.scrada_api_key || !company?.scrada_company_id) {
      return new Response(JSON.stringify({ error: 'Scrada credentials not configured', configured: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const headers = {
      'X-API-KEY': company.scrada_api_key,
      'X-PASSWORD': company.scrada_password,
      'Language': 'FR',
    };

    // 1. Fetch company profile from Scrada
    let companyProfile = null;
    try {
      const companyRes = await fetch(
        `${scradaBaseUrl}/company/${company.scrada_company_id}`,
        { method: 'GET', headers }
      );
      if (companyRes.ok) {
        companyProfile = await companyRes.json();
      }
    } catch { /* ignore */ }

    // 2. Check own Peppol registration status
    let registrationStatus = null;
    if (company.peppol_endpoint_id) {
      const peppolId = `${company.peppol_scheme_id || '0208'}:${company.peppol_endpoint_id}`;
      try {
        const regRes = await fetch(
          `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration/check/${encodeURIComponent(peppolId)}`,
          { method: 'GET', headers }
        );
        if (regRes.ok) {
          registrationStatus = { registered: true, details: await regRes.json() };
        } else if (regRes.status === 404) {
          registrationStatus = { registered: false };
        }
      } catch { /* ignore */ }
    }

    // 3. Fetch recent outbound documents (last 20)
    let recentDocuments: any[] = [];
    try {
      const docsRes = await fetch(
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolOutbound?limit=20`,
        { method: 'GET', headers }
      );
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        recentDocuments = Array.isArray(docsData) ? docsData : (docsData.items || docsData.data || []);
      }
    } catch { /* ignore */ }

    // 4. Fetch supported document types / profiles
    let supportedProfiles: any[] = [];
    try {
      const profRes = await fetch(
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration`,
        { method: 'GET', headers }
      );
      if (profRes.ok) {
        const profData = await profRes.json();
        supportedProfiles = Array.isArray(profData) ? profData : (profData.profiles || profData.documentTypes || [profData]);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      configured: true,
      companyProfile,
      registrationStatus,
      recentDocuments,
      supportedProfiles,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
