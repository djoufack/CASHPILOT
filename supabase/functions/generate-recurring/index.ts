import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isAuthorizedInternalRequest, unauthorizedInternalRequestResponse } from '../_shared/internalAuth.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isAuthorizedInternalRequest(req)) {
    return unauthorizedInternalRequestResponse(corsHeaders);
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional body parameters (supports both JSON body and default)
    let today: string;
    let limit: number | undefined;
    try {
      if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
        const body = await req.json();
        today = body?.today || new Date().toISOString().split('T')[0];
        limit = body?.limit;
      } else {
        today = new Date().toISOString().split('T')[0];
      }
    } catch {
      today = new Date().toISOString().split('T')[0];
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid date format: "${today}". Expected YYYY-MM-DD.`,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Build RPC parameters
    const rpcParams: Record<string, unknown> = { p_today: today };
    if (limit !== undefined && Number.isInteger(limit) && limit > 0) {
      rpcParams.p_limit = limit;
    }

    // Call the atomic SQL function.
    // generate_due_recurring_invoices runs as a single PostgreSQL transaction:
    //   - FOR UPDATE SKIP LOCKED prevents concurrent duplicate processing
    //   - Idempotency: the function checks for existing invoices before inserting
    //   - If any step fails, the entire transaction is rolled back (no partial data)
    //   - Per-row errors are caught and reported without aborting the batch
    const { data: results, error: generationError } = await supabase.rpc('generate_due_recurring_invoices', rpcParams);

    if (generationError) {
      console.error(
        '[generate-recurring] RPC error:',
        JSON.stringify({
          message: generationError.message,
          code: generationError.code,
          details: generationError.details,
          hint: generationError.hint,
          date: today,
        })
      );

      // Distinguish between different error types
      const statusCode =
        generationError.code === '42501'
          ? 403 // insufficient privilege
          : generationError.code === '42883'
            ? 501 // function not found
            : 500;

      return new Response(
        JSON.stringify({
          success: false,
          error: generationError.message,
          code: generationError.code,
          hint: generationError.hint || undefined,
          date: today,
        }),
        { status: statusCode, headers: jsonHeaders }
      );
    }

    const allResults = results || [];
    const generated = allResults.filter((r: { status: string }) => r.status === 'generated');
    const skipped = allResults.filter((r: { status: string }) => r.status === 'skipped_duplicate');
    const errors = allResults.filter(
      (r: { status: string }) => r.status !== 'generated' && r.status !== 'skipped_duplicate'
    );

    const elapsed = Date.now() - startTime;

    console.log(
      '[generate-recurring] Completed:',
      JSON.stringify({
        date: today,
        total: allResults.length,
        generated: generated.length,
        skipped: skipped.length,
        errors: errors.length,
        elapsed_ms: elapsed,
      })
    );

    // If there were per-row errors but some succeeded, return 207 Multi-Status
    const httpStatus =
      errors.length > 0 && generated.length > 0 ? 207 : errors.length > 0 && generated.length === 0 ? 500 : 200;

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        date: today,
        generated: generated.length,
        skipped: skipped.length,
        errors: errors.length,
        elapsed_ms: elapsed,
        results: allResults,
      }),
      { status: httpStatus, headers: jsonHeaders }
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(
      '[generate-recurring] Unexpected error:',
      JSON.stringify({
        message: errorMessage,
        stack: errorStack,
        elapsed_ms: elapsed,
      })
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        elapsed_ms: elapsed,
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
