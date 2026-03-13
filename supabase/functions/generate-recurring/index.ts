import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isAuthorizedInternalRequest, unauthorizedInternalRequestResponse } from '../_shared/internalAuth.ts';

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

  if (!isAuthorizedInternalRequest(req)) {
    return unauthorizedInternalRequestResponse(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: results, error: generationError } = await supabase.rpc(
      'generate_due_recurring_invoices',
      { p_today: today },
    );

    if (generationError) throw generationError;

    return new Response(
      JSON.stringify({ success: true, generated: results?.length || 0, results: results || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
