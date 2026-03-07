// Supabase Edge Function: export-user-data
// Exports all user data as JSON for GDPR compliance (Right of Portability - Article 20)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
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

  const supabase = createServiceClient();

  try {
    const user = await requireAuthenticatedUser(req);
    const userId = user.id;

    const rateLimit = checkRateLimit(userId, {
      maxRequests: 2,
      windowMs: 6 * 60 * 60 * 1000,
      keyPrefix: 'export-user-data',
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, corsHeaders);
    }

    const processingThresholdIso = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
    const { data: inProgressExport } = await supabase
      .from('data_export_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .gte('requested_at', processingThresholdIso)
      .maybeSingle();

    if (inProgressExport?.id) {
      throw new HttpError(409, 'An export is already being generated. Please wait a few minutes.');
    }

    // Create a data export request record
    const { data: exportRequest, error: insertError } = await supabase
      .from('data_export_requests')
      .insert([{
        user_id: userId,
        status: 'processing',
        requested_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create export request:', insertError);
      // Continue anyway - the export itself is more important
    }

    // Collect data from all user-related tables
    const tablesToExport = [
      'profiles',
      'clients',
      'invoices',
      'invoice_line_items',
      'quotes',
      'projects',
      'expenses',
      'payments',
      'suppliers',
      'products',
      'purchase_orders',
      'credit_notes',
      'delivery_notes',
      'notifications',
      'audit_log',
      'bank_transactions',
      'user_credits',
      'credit_transactions',
      'consent_logs',
      'data_export_requests',
      'supplier_invoices',
      'supplier_invoice_line_items',
      'recurring_invoices',
      'services',
      'categories',
      'tasks',
    ];

    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      gdpr_article: 'Article 20 - Right to data portability',
      user_id: userId,
      user_email: user.email,
      user_metadata: user.user_metadata,
      data: {} as Record<string, unknown>,
    };

    const collectionLog: Array<{ table: string; count: number; status: string }> = [];

    // Query all tables in parallel for better performance
    const queryResults = await Promise.allSettled(
      tablesToExport.map((table) =>
        supabase.from(table).select('*').eq('user_id', userId).then(res => ({ table, ...res }))
      )
    );

    for (let index = 0; index < queryResults.length; index += 1) {
      const result = queryResults[index];
      if (result.status === 'fulfilled') {
        const { table, data, error } = result.value;
        if (!error && data) {
          (exportData.data as Record<string, unknown>)[table] = data;
          collectionLog.push({ table, count: data.length, status: 'success' });
        } else if (error) {
          collectionLog.push({ table, count: 0, status: `error: ${error.message}` });
        }
      } else {
        // Table might not exist or have different structure, skip
        const table = tablesToExport[index];
        collectionLog.push({ table, count: 0, status: 'skipped' });
      }
    }

    // Generate the JSON export
    const jsonContent = JSON.stringify(exportData, null, 2);
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonContent);
    const fileSize = jsonBytes.length;

    // Upload to Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `gdpr/${userId}/${timestamp}.json`;

    // Ensure the 'exports' bucket exists
    try {
      await supabase.storage.createBucket('exports', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
    } catch {
      // Bucket might already exist, ignore
    }

    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filePath, jsonBytes, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);

      // Update export request as failed if we created one
      if (exportRequest) {
        await supabase
          .from('data_export_requests')
          .update({ status: 'failed' })
          .eq('id', exportRequest.id);
      }

      // Even if storage fails, return the data directly
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Data exported (direct download - storage upload failed)',
          data: exportData,
          file_size: fileSize,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(filePath, 3600);

    const fileUrl = signedUrlData?.signedUrl || null;

    // Update the export request record
    if (exportRequest) {
      await supabase
        .from('data_export_requests')
        .update({
          status: 'completed',
          file_url: fileUrl,
          file_size: fileSize,
          completed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        })
        .eq('id', exportRequest.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data export completed',
        file_url: fileUrl,
        file_size: fileSize,
        tables_exported: collectionLog.filter(l => l.status === 'success').length,
        total_records: collectionLog.reduce((sum, l) => sum + l.count, 0),
        log: collectionLog,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Export user data error:', error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : 'Unable to export user data';

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
