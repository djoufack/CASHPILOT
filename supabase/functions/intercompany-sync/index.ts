// Supabase Edge Function: intercompany-sync
// Creates a mirror invoice in a target company from a source invoice,
// and records the intercompany transaction.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUuid = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return value;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createAuthClient(authHeader);
    const admin = createServiceClient();

    const body = await req.json();
    const sourceCompanyId = validateUuid(body.source_company_id, 'source_company_id');
    const targetCompanyId = validateUuid(body.target_company_id, 'target_company_id');
    const invoiceId = validateUuid(body.invoice_id, 'invoice_id');

    if (sourceCompanyId === targetCompanyId) {
      throw new HttpError(400, 'Source and target companies must be different');
    }

    // Verify both companies belong to the user
    const [sourceRes, targetRes] = await Promise.all([
      supabase.from('company').select('id, name').eq('id', sourceCompanyId).eq('user_id', user.id).single(),
      supabase.from('company').select('id, name').eq('id', targetCompanyId).eq('user_id', user.id).single(),
    ]);

    if (sourceRes.error || !sourceRes.data) {
      throw new HttpError(404, 'Source company not found or unauthorized');
    }
    if (targetRes.error || !targetRes.data) {
      throw new HttpError(404, 'Target company not found or unauthorized');
    }

    // Verify active intercompany link exists
    const { data: link, error: linkError } = await supabase
      .from('intercompany_links')
      .select('id, link_type, is_active')
      .eq('company_id', sourceCompanyId)
      .eq('linked_company_id', targetCompanyId)
      .eq('is_active', true)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      throw new HttpError(400, 'No active intercompany link between these companies');
    }

    // Fetch source invoice
    const { data: sourceInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_ttc, total_ht, currency, date, due_date, status, client_id')
      .eq('id', invoiceId)
      .eq('company_id', sourceCompanyId)
      .single();

    if (invoiceError || !sourceInvoice) {
      throw new HttpError(404, 'Source invoice not found');
    }

    // Check if already synced
    const { data: existing } = await supabase
      .from('intercompany_transactions')
      .select('id')
      .eq('source_invoice_id', invoiceId)
      .eq('company_id', sourceCompanyId)
      .eq('linked_company_id', targetCompanyId)
      .maybeSingle();

    if (existing) {
      throw new HttpError(409, 'This invoice has already been synced to the target company');
    }

    // Fetch source invoice items
    const { data: sourceItems } = await supabase
      .from('invoice_items')
      .select('description, quantity, unit_price, total')
      .eq('invoice_id', invoiceId);

    // Create mirror invoice in target company (as a purchase/payable)
    const mirrorInvoiceNumber = `IC-${sourceInvoice.invoice_number || Date.now()}`;
    const { data: mirrorInvoice, error: mirrorError } = await admin
      .from('invoices')
      .insert({
        user_id: user.id,
        company_id: targetCompanyId,
        invoice_number: mirrorInvoiceNumber,
        total_ttc: sourceInvoice.total_ttc || 0,
        total_ht: sourceInvoice.total_ht || 0,
        currency: sourceInvoice.currency || 'EUR',
        date: sourceInvoice.date,
        due_date: sourceInvoice.due_date,
        status: 'draft',
        payment_status: 'unpaid',
        notes: `Inter-company mirror of ${sourceInvoice.invoice_number} from ${sourceRes.data.name}`,
      })
      .select('id')
      .single();

    if (mirrorError) {
      throw new HttpError(500, `Failed to create mirror invoice: ${mirrorError.message}`);
    }

    // Copy invoice items to mirror
    if (sourceItems && sourceItems.length > 0) {
      const mirrorItems = sourceItems.map((item) => ({
        invoice_id: mirrorInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      await admin.from('invoice_items').insert(mirrorItems);
    }

    // Record the intercompany transaction
    const transactionAmount = Number(sourceInvoice.total_ttc) || Number(sourceInvoice.total_ht) || 0;
    const { data: transaction, error: txError } = await supabase
      .from('intercompany_transactions')
      .insert({
        user_id: user.id,
        company_id: sourceCompanyId,
        linked_company_id: targetCompanyId,
        source_invoice_id: invoiceId,
        mirror_invoice_id: mirrorInvoice.id,
        amount: transactionAmount,
        currency: sourceInvoice.currency || 'EUR',
        transaction_type: 'sale',
        status: 'synced',
      })
      .select('*')
      .single();

    if (txError) {
      throw new HttpError(500, `Failed to record transaction: ${txError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        mirror_invoice_id: mirrorInvoice.id,
        mirror_invoice_number: mirrorInvoiceNumber,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});
