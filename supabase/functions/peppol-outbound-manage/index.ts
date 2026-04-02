import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

type JsonRecord = Record<string, unknown>;

type CancelAttemptResult =
  | { ok: true; endpoint: string; response: unknown }
  | { ok: false; unsupported: true; details: string[] }
  | { ok: false; unsupported: false; status: number; message: string };

const parseJsonSafe = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const parseTextSafe = async (res: Response) => {
  try {
    return await res.text();
  } catch {
    return '';
  }
};

const normalizeStatus = (rawStatus: unknown): string => {
  const normalized = String(rawStatus || '')
    .trim()
    .toLowerCase();
  const statusMap: Record<string, string> = {
    created: 'pending',
    processed: 'delivered',
    error: 'error',
    rejected: 'rejected',
    accepted: 'accepted',
    delivered: 'delivered',
    sent: 'sent',
    pending: 'pending',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  };
  return statusMap[normalized] || normalized || 'pending';
};

const isFinalStatus = (status: string) => {
  return ['delivered', 'accepted', 'error', 'rejected', 'cancelled'].includes(status);
};

const resolveOutboundStatus = async (
  scradaBaseUrl: string,
  scradaCompanyId: string,
  documentId: string,
  scradaHeaders: Record<string, string>
) => {
  const statusEndpoints = [
    `${scradaBaseUrl}/company/${scradaCompanyId}/peppol/outbound/document/${documentId}/info`,
    `${scradaBaseUrl}/company/${scradaCompanyId}/peppolOutbound/${documentId}/status`,
  ];

  const errors: string[] = [];

  for (const endpoint of statusEndpoints) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { ...scradaHeaders, Accept: 'application/json' },
    });

    if (response.ok) {
      const payload = await parseJsonSafe(response);
      const status = normalizeStatus((payload as JsonRecord | null)?.status);
      return {
        status,
        payload,
        endpoint,
      };
    }

    const errorText = await parseTextSafe(response);
    errors.push(`${response.status} ${endpoint}: ${errorText || 'No response body'}`);
  }

  return {
    status: null,
    payload: null,
    endpoint: null,
    errors,
  };
};

const tryCancelNetwork = async (
  scradaBaseUrl: string,
  scradaCompanyId: string,
  documentId: string,
  scradaHeaders: Record<string, string>
): Promise<CancelAttemptResult> => {
  const endpoints = [
    { method: 'DELETE', path: `/company/${scradaCompanyId}/peppol/outbound/document/${documentId}` },
    { method: 'POST', path: `/company/${scradaCompanyId}/peppol/outbound/document/${documentId}/cancel` },
    { method: 'PUT', path: `/company/${scradaCompanyId}/peppol/outbound/document/${documentId}/cancel` },
    { method: 'DELETE', path: `/company/${scradaCompanyId}/peppolOutbound/${documentId}` },
    { method: 'POST', path: `/company/${scradaCompanyId}/peppolOutbound/${documentId}/cancel` },
    { method: 'PUT', path: `/company/${scradaCompanyId}/peppolOutbound/${documentId}/cancel` },
  ];

  const unsupportedDetails: string[] = [];

  for (const candidate of endpoints) {
    const endpoint = `${scradaBaseUrl}${candidate.path}`;
    const response = await fetch(endpoint, {
      method: candidate.method,
      headers: {
        ...scradaHeaders,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const payload = await parseJsonSafe(response);
      return { ok: true, endpoint: `${candidate.method} ${candidate.path}`, response: payload };
    }

    const bodyText = await parseTextSafe(response);

    if (response.status === 404 || response.status === 405) {
      unsupportedDetails.push(`${response.status} ${candidate.method} ${candidate.path}`);
      continue;
    }

    return {
      ok: false,
      unsupported: false,
      status: response.status,
      message: bodyText || `Scrada returned HTTP ${response.status}`,
    };
  }

  return {
    ok: false,
    unsupported: true,
    details: unsupportedDetails,
  };
};

const isPeppolLikeInvoice = (invoice: JsonRecord, outboundLogInvoiceIds: Set<string> = new Set()) => {
  const invoiceId = String(invoice.id || '').trim();
  const status = String(invoice.peppol_status || '')
    .trim()
    .toLowerCase();
  const hasDocumentId = String(invoice.peppol_document_id || '').trim().length > 0;
  const notes = String(invoice.notes || '').toLowerCase();

  return (
    (status && status !== 'none') ||
    hasDocumentId ||
    notes.includes('import ubl externe') ||
    outboundLogInvoiceIds.has(invoiceId)
  );
};

const countInvoiceAccountingEntries = async (
  supabase: ReturnType<typeof createAuthClient>,
  userId: string,
  companyId: string,
  invoiceIds: string[]
) => {
  if (!invoiceIds.length) return 0;
  const { count, error } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .in('source_type', ['invoice', 'invoice_reversal'])
    .in('source_id', invoiceIds);

  if (error) throw error;
  return Number(count || 0);
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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const invoiceId = String(body?.invoice_id || '').trim();
    const allowedActions = ['cancel_network', 'delete_local', 'delete_invoice_db', 'purge_peppol_db'];

    if (!allowedActions.includes(action)) {
      throw new HttpError(
        400,
        `action must be one of: ${allowedActions.join(', ')}`
      );
    }

    const scoped = await getScopedCompany<JsonRecord>(
      supabase,
      user.id,
      'id, scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted',
      body?.company_id
    );
    const company = scoped.company;
    const companyId = String(scoped.companyId);

    if (action === 'purge_peppol_db') {
      const { data: outboundLogRows, error: outboundLogError } = await supabase
        .from('peppol_transmission_log')
        .select('invoice_id')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('direction', 'outbound')
        .not('invoice_id', 'is', null);

      if (outboundLogError) throw outboundLogError;

      const outboundLogInvoiceIds = new Set(
        (outboundLogRows || [])
          .map((row) => String((row as JsonRecord).invoice_id || '').trim())
          .filter(Boolean)
      );

      const { data: companyInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number, peppol_status, peppol_document_id, notes')
        .eq('user_id', user.id)
        .eq('company_id', companyId);

      if (invoicesError) throw invoicesError;

      const candidates = ((companyInvoices || []) as JsonRecord[]).filter((invoice) =>
        isPeppolLikeInvoice(invoice, outboundLogInvoiceIds)
      );
      const candidateIds = candidates
        .map((invoice) => String(invoice.id || '').trim())
        .filter(Boolean);

      if (!candidateIds.length) {
        return new Response(
          JSON.stringify({
            success: true,
            action,
            purgedInvoices: 0,
            accountingEntriesBeforeDelete: 0,
            message: 'No Peppol invoices found for purge',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const accountingEntriesBeforeDelete = await countInvoiceAccountingEntries(
        supabase,
        user.id,
        companyId,
        candidateIds
      );

      const { data: deletedInvoices, error: deleteInvoicesError } = await supabase
        .from('invoices')
        .delete()
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .in('id', candidateIds)
        .select('id');

      if (deleteInvoicesError) throw deleteInvoicesError;

      return new Response(
        JSON.stringify({
          success: true,
          action,
          purgedInvoices: Number(deletedInvoices?.length || 0),
          accountingEntriesBeforeDelete,
          invoiceIds: candidateIds,
          message: 'Peppol invoices purged from DB and accounting chain updated',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invoiceId) throw new HttpError(400, 'invoice_id is required');

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, user_id, company_id, peppol_status, peppol_document_id, notes')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (invoiceError || !invoice) {
      throw new HttpError(404, 'Invoice not found');
    }

    if (action === 'delete_invoice_db') {
      const { count: outboundLogCount, error: outboundLogCountError } = await supabase
        .from('peppol_transmission_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('invoice_id', invoice.id)
        .eq('direction', 'outbound');

      if (outboundLogCountError) throw outboundLogCountError;

      if (!isPeppolLikeInvoice(invoice as JsonRecord, new Set(outboundLogCount ? [invoice.id] : []))) {
        throw new HttpError(409, 'Only Peppol-tagged invoices can be deleted with this action');
      }

      const accountingEntriesBeforeDelete = await countInvoiceAccountingEntries(supabase, user.id, companyId, [invoice.id]);

      const { data: deletedInvoices, error: deleteInvoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .select('id');

      if (deleteInvoiceError) throw deleteInvoiceError;
      if (!deletedInvoices?.length) throw new HttpError(404, 'Invoice not found');

      return new Response(
        JSON.stringify({
          success: true,
          action,
          invoice_id: invoice.id,
          accountingEntriesBeforeDelete,
          message: 'Peppol invoice deleted from DB and accounting chain updated',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_local') {
      if (['delivered', 'accepted'].includes(String(invoice.peppol_status || '').toLowerCase())) {
        throw new HttpError(
          409,
          'Delivered/accepted invoices cannot be removed locally to preserve Peppol audit integrity'
        );
      }

      const { error: deleteLogError } = await supabase
        .from('peppol_transmission_log')
        .delete()
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('invoice_id', invoice.id)
        .eq('direction', 'outbound');

      if (deleteLogError) throw deleteLogError;

      const { error: resetInvoiceError } = await supabase
        .from('invoices')
        .update({
          peppol_status: 'none',
          peppol_document_id: null,
          peppol_sent_at: null,
          peppol_error_message: null,
        })
        .eq('id', invoice.id)
        .eq('user_id', user.id);

      if (resetInvoiceError) throw resetInvoiceError;

      return new Response(
        JSON.stringify({
          success: true,
          action,
          invoice_id: invoice.id,
          message: 'Local outbound trace removed and invoice reset',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!company.scrada_company_id || !apiKey || !password) {
      throw new HttpError(400, 'Scrada credentials not configured for this company');
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password,
      Language: 'FR',
    };

    if (!invoice.peppol_document_id) {
      throw new HttpError(400, 'No Peppol document found on this invoice');
    }

    const documentId = String(invoice.peppol_document_id);

    const statusProbe = await resolveOutboundStatus(
      scradaBaseUrl,
      String(company.scrada_company_id),
      documentId,
      scradaHeaders
    );

    if (statusProbe.status && isFinalStatus(statusProbe.status)) {
      throw new HttpError(
        409,
        `This document is already in final status "${statusProbe.status}" and can no longer be cancelled on Scrada`
      );
    }

    const cancelResult = await tryCancelNetwork(
      scradaBaseUrl,
      String(company.scrada_company_id),
      documentId,
      scradaHeaders
    );

    if (!cancelResult.ok) {
      if (cancelResult.unsupported) {
        throw new HttpError(
          422,
          `Scrada cancellation endpoint not available for this account/document (${cancelResult.details.join('; ')})`
        );
      }

      throw new HttpError(cancelResult.status || 502, cancelResult.message);
    }

    const cancellationMetadata = {
      cancelledAt: new Date().toISOString(),
      scradaEndpoint: cancelResult.endpoint,
      scradaResponse: cancelResult.response,
      statusProbe,
    };

    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update({
        peppol_status: 'cancelled',
        peppol_error_message: null,
      })
      .eq('id', invoice.id)
      .eq('user_id', user.id);

    if (invoiceUpdateError) throw invoiceUpdateError;

    const { error: logError } = await supabase.from('peppol_transmission_log').insert({
      user_id: user.id,
      company_id: companyId,
      invoice_id: invoice.id,
      direction: 'outbound',
      status: 'cancelled',
      ap_provider: 'scrada',
      ap_document_id: documentId,
      metadata: cancellationMetadata,
    });

    if (logError) throw logError;

    return new Response(
      JSON.stringify({
        success: true,
        action,
        invoice_id: invoice.id,
        document_id: documentId,
        cancelled: true,
        cancellationEndpoint: cancelResult.endpoint,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
