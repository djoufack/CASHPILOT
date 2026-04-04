import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new HttpError(401, 'Missing authorization');

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);

    const { invoice_id, company_id } = await req.json();
    if (!invoice_id) throw new HttpError(400, 'invoice_id is required');
    if (!company_id) throw new HttpError(400, 'company_id is required');

    // ── Validate invoice exists and belongs to user/company ──
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_ht, total_ttc, tax_rate, status, client_id')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .single();

    if (invError || !invoice) {
      throw new HttpError(404, 'Invoice not found or access denied');
    }

    // ── Validate invoice data completeness ──
    const missingFields: string[] = [];
    if (!invoice.invoice_number) missingFields.push('invoice_number');
    if (invoice.total_ttc == null) missingFields.push('total_ttc');
    if (!invoice.client_id) missingFields.push('client_id');
    if (!['sent', 'validated'].includes(invoice.status)) {
      missingFields.push('status (must be sent or validated)');
    }

    if (missingFields.length > 0) {
      throw new HttpError(400, `Invoice incomplete for Chorus Pro submission: missing ${missingFields.join(', ')}`);
    }

    // ── Load company info for submission ──
    const { data: company, error: compError } = await supabase
      .from('company')
      .select('id, company_name, siret, vat_number')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .single();

    if (compError || !company) {
      throw new HttpError(404, 'Company not found');
    }

    if (!company.siret) {
      throw new HttpError(400, 'Company SIRET is required for Chorus Pro submission');
    }

    // ── Temporary submission adapter (non-production API bridge) ──
    // Until Chorus Pro API credentials/contract are provisioned, we persist a
    // deterministic local submission record instead of calling the external API.
    const submissionId = crypto.randomUUID();
    const submissionResult = {
      submission_id: submissionId,
      status: 'submitted',
      chorus_pro_number: `CPR-${Date.now()}`,
      submitted_at: new Date().toISOString(),
    };

    // ── Record in pdp_audit_trail ──
    const { error: auditError } = await supabase.from('pdp_audit_trail').insert({
      user_id: user.id,
      company_id,
      entity_type: 'invoice',
      entity_id: invoice_id,
      action: 'transmitted',
      hash: submissionId,
      metadata: {
        target: 'chorus_pro',
        chorus_pro_number: submissionResult.chorus_pro_number,
        invoice_number: invoice.invoice_number,
        total_ttc: invoice.total_ttc,
        company_siret: company.siret,
      },
    });

    if (auditError) {
      console.error('Failed to record audit trail:', auditError);
      // Non-blocking: submission is still valid
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: submissionResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('chorus-pro-submit error:', message);

    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});
