import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { encryptSecretValue } from '../_shared/scradaCredentials.ts';
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
    const user = await requireAuthenticatedUser(req);
    const { company_id, scrada_company_id, scrada_api_key, scrada_password } = await req.json();

    if (!company_id) throw new HttpError(400, 'company_id is required');
    if (!scrada_company_id || !scrada_api_key || !scrada_password) {
      throw new HttpError(400, 'scrada_company_id, scrada_api_key and scrada_password are required');
    }

    const supabase = createServiceClient();

    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id, user_id')
      .eq('id', company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company || company.user_id !== user.id) {
      throw new HttpError(403, 'Forbidden');
    }

    const encryptedApiKey = await encryptSecretValue(scrada_api_key);
    const encryptedPassword = await encryptSecretValue(scrada_password);

    const { error: updateError } = await supabase
      .from('company')
      .update({
        scrada_company_id,
        scrada_api_key_encrypted: encryptedApiKey,
        scrada_password_encrypted: encryptedPassword,
        scrada_api_key: null,
        scrada_password: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
