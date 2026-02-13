// Supabase Edge Function: delete-account
// Deletes all user data and the auth account for GDPR compliance

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const { confirmation } = await req.json();

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return new Response(
        JSON.stringify({ error: 'Invalid confirmation. Send { confirmation: "DELETE_MY_ACCOUNT" }' }),
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

    const deletionLog = [];
    for (const table of tablesToDelete) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);

        deletionLog.push({ table, status: error ? 'error' : 'deleted', count: count || 0, error: error?.message });
      } catch (e) {
        // Table might not exist, continue
        deletionLog.push({ table, status: 'skipped', error: e.message });
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
      return new Response(
        JSON.stringify({ error: 'Failed to delete auth account', details: deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account and all data deleted', log: deletionLog }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
