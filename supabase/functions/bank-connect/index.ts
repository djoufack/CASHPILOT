import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { provider_id, company_id, redirect_url } = await req.json();

    if (!provider_id) {
      return jsonResponse({ error: 'Missing provider_id' }, 400);
    }
    if (!company_id) {
      return jsonResponse({ error: 'Missing company_id' }, 400);
    }

    // Verify company ownership
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id')
      .eq('id', company_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (companyError || !company) {
      return jsonResponse({ error: 'Company not found or access denied' }, 403);
    }

    // Fetch the provider
    const { data: provider, error: providerError } = await supabase
      .from('bank_providers')
      .select('*')
      .eq('id', provider_id)
      .eq('is_active', true)
      .maybeSingle();

    if (providerError || !provider) {
      return jsonResponse({ error: 'Bank provider not found or inactive' }, 404);
    }

    // Simulate Open Banking authorization flow
    // In production, this would call the actual provider API (Plaid Link, Nordigen, Bridge, Tink)
    const simulatedConsentId = crypto.randomUUID();
    const consentExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Create a pending connection
    const { data: connection, error: insertError } = await supabase
      .from('bank_account_connections')
      .insert({
        user_id: authUser.id,
        company_id,
        bank_provider_id: provider.id,
        institution_name: provider.name,
        status: 'active',
        consent_id: simulatedConsentId,
        consent_expires_at: consentExpiresAt,
        metadata: {
          provider_api_type: provider.api_type,
          simulated: true,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: `Failed to create connection: ${insertError.message}` }, 500);
    }

    // In simulation mode, we generate a fake authorization URL
    const baseRedirect = redirect_url || `${Deno.env.get('APP_URL') || 'https://cashpilot.tech'}/app/embedded-banking`;
    const authorizationUrl = `${baseRedirect}?connected=1&connection_id=${connection.id}&provider=${encodeURIComponent(provider.name)}`;

    return jsonResponse({
      success: true,
      connection_id: connection.id,
      authorization_url: authorizationUrl,
      consent_id: simulatedConsentId,
      consent_expires_at: consentExpiresAt,
      provider: {
        id: provider.id,
        name: provider.name,
        api_type: provider.api_type,
      },
      simulated: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});
