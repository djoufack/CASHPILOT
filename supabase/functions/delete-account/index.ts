// Supabase Edge Function: delete-account
// Deletes all user data and the auth account for GDPR compliance

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DELETE_CONFIRMATION_PHRASE = 'DELETE_MY_ACCOUNT';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createServiceClient();

  try {
    const user = await requireAuthenticatedUser(req);

    const userId = user.id;
    const rateLimit = checkRateLimit(userId, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      keyPrefix: 'delete-account',
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';

    if (confirmation !== DELETE_CONFIRMATION_PHRASE) {
      return new Response(
        JSON.stringify({ error: `Invalid confirmation. Send { confirmation: "${DELETE_CONFIRMATION_PHRASE}" }` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete user data from all tables (order matters for FK constraints)
    const tablesToDelete = [
      'consent_logs',
      'data_export_requests',
      'credit_transactions',
      'user_credits',
      'invoice_line_items',
      'supplier_invoice_line_items',
      'supplier_invoices',
      'invoices',
      'quotes',
      'purchase_orders',
      'credit_notes',
      'delivery_notes',
      'expenses',
      'payments',
      'projects',
      'products',
      'clients',
      'suppliers',
      'bank_transactions',
      'audit_log',
      'notifications',
      'profiles',
    ];

    const deletionLog: Array<{ table: string; status: string; count: number; error?: string }> = [];

    for (const table of tablesToDelete) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);

        deletionLog.push({ table, status: error ? 'error' : 'deleted', count: count || 0, error: error?.message });
      } catch (tableError) {
        // Table might not exist, continue
        deletionLog.push({
          table,
          status: 'skipped',
          count: 0,
          error: tableError instanceof Error ? tableError.message : 'unknown_error',
        });
      }
    }

    // Delete storage files
    try {
      const buckets = ['supplier-invoices', 'documents', 'avatars', 'exports'];
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
          await supabase.storage.from(bucket).remove(paths);
        }
      }
    } catch (e) {
      console.error('Storage cleanup error:', e);
    }

    // Delete auth user (must be last)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw new HttpError(500, 'Failed to delete auth account');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account and all data deleted', log: deletionLog }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete account error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'Account deletion failed';

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
