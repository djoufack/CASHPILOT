import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  consumeCredits,
  createAuthClient,
  HttpError,
  refundCredits,
  requireAuthenticatedUser,
  resolveCreditCost,
} from '../_shared/billing.ts';
import { getScopedCompany } from '../_shared/companyScope.ts';
import { resolveScradaCredentials } from '../_shared/scradaCredentials.ts';

import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const normalizeInboundDocuments = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }

  if (payload && typeof payload === 'object') {
    const maybeResults = (payload as { results?: unknown }).results;
    if (Array.isArray(maybeResults)) {
      return maybeResults as Record<string, unknown>[];
    }
  }

  return [];
};

const extractDocumentId = (doc: Record<string, unknown>): string => String(doc.id || doc.documentId || '').trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new HttpError(401, 'Missing authorization');
    }

    const user = await requireAuthenticatedUser(req);
    const supabase = createAuthClient(authHeader);
    const body = await req.json();
    const action = body.action || 'list';
    const requestedCompanyId = body.company_id;

    const { company, companyId } = await getScopedCompany(
      supabase,
      user.id,
      'id, peppol_endpoint_id, peppol_scheme_id, scrada_company_id, scrada_api_key, scrada_password, scrada_api_key_encrypted, scrada_password_encrypted',
      requestedCompanyId
    );

    const { apiKey, password } = await resolveScradaCredentials(company);
    if (!company?.scrada_company_id || !apiKey || !password) {
      throw new HttpError(400, 'Scrada credentials not configured');
    }

    const scradaBaseUrl = Deno.env.get('SCRADA_API_URL') || 'https://api.scrada.be/v1';
    const scradaHeaders = {
      'X-API-KEY': apiKey,
      'X-PASSWORD': password,
      Language: 'FR',
    };

    if (action === 'list') {
      const { data: docs } = await supabase
        .from('peppol_inbound_documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .order('received_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ documents: docs || [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync') {
      const endpointErrors: string[] = [];
      let hadSuccessfulFetch = false;

      const fetchDocumentsFromPath = async (path: string): Promise<Record<string, unknown>[] | null> => {
        const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}${path}`;
        const scradaResponse = await fetch(scradaUrl, {
          method: 'GET',
          headers: { ...scradaHeaders, 'Content-Type': 'application/json' },
        });

        if (!scradaResponse.ok) {
          const errText = await scradaResponse.text();
          endpointErrors.push(`${path} -> ${scradaResponse.status}: ${errText}`);
          return null;
        }

        const scradaPayload = await scradaResponse.json().catch(() => null);
        hadSuccessfulFetch = true;
        return normalizeInboundDocuments(scradaPayload);
      };

      const candidateDocuments = new Map<string, { doc: Record<string, unknown>; shouldConfirm: boolean }>();
      const addDocuments = (docs: Record<string, unknown>[], shouldConfirm: boolean) => {
        for (const doc of docs) {
          const docId = extractDocumentId(doc);
          if (!docId) continue;

          const existing = candidateDocuments.get(docId);
          if (existing) {
            existing.shouldConfirm = existing.shouldConfirm || shouldConfirm;
            continue;
          }
          candidateDocuments.set(docId, { doc, shouldConfirm });
        }
      };

      const unconfirmedDocs = await fetchDocumentsFromPath('/peppol/inbound/document/unconfirmed');
      if (unconfirmedDocs) {
        addDocuments(unconfirmedDocs, true);
      }

      // Fallback: recover missed webhooks / already-confirmed invoices from list endpoints.
      if (candidateDocuments.size === 0) {
        const fallbackPaths = ['/peppol/inbound/document', '/peppolInbound'];
        for (const path of fallbackPaths) {
          const listedDocs = await fetchDocumentsFromPath(path);
          if (listedDocs) {
            addDocuments(listedDocs, false);
            break;
          }
        }
      }

      if (!hadSuccessfulFetch && candidateDocuments.size === 0) {
        throw new HttpError(502, `Scrada API error on inbound sync: ${endpointErrors.join(' | ') || 'Unknown error'}`);
      }

      const candidateIds = Array.from(candidateDocuments.keys());
      if (candidateIds.length === 0) {
        return new Response(
          JSON.stringify({
            synced: true,
            totalFromScrada: 0,
            newDocuments: 0,
            requiredCredits: 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: existingDocs, error: existingDocsError } = await supabase
        .from('peppol_inbound_documents')
        .select('scrada_document_id')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .in('scrada_document_id', candidateIds);
      if (existingDocsError) throw existingDocsError;

      const existingIds = new Set((existingDocs || []).map((row) => String(row.scrada_document_id || '').trim()));
      const newDocuments: Array<{ docId: string; doc: Record<string, unknown>; shouldConfirm: boolean }> = [];
      for (const [docId, payload] of candidateDocuments.entries()) {
        if (existingIds.has(docId)) continue;
        newDocuments.push({ docId, doc: payload.doc, shouldConfirm: payload.shouldConfirm });
      }

      if (newDocuments.length === 0) {
        return new Response(
          JSON.stringify({
            synced: true,
            totalFromScrada: candidateDocuments.size,
            newDocuments: 0,
            requiredCredits: 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const peppolReceiveCredits = await resolveCreditCost(supabase, 'PEPPOL_RECEIVE_INVOICE');
      const requiredCredits = newDocuments.length * peppolReceiveCredits;
      let creditDeduction = null;

      try {
        creditDeduction = await consumeCredits(
          supabase,
          user.id,
          requiredCredits,
          `Peppol inbound sync (${newDocuments.length} invoices)`
        );
      } catch (error) {
        if (error instanceof HttpError && error.status === 402) {
          return new Response(
            JSON.stringify({
              error: 'insufficient_credits',
              insufficientCredits: true,
              requiredCredits,
              newDocuments: newDocuments.length,
            }),
            {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        throw error;
      }

      try {
        const inboundRows = newDocuments.map(({ docId, doc }) => ({
          user_id: user.id,
          company_id: companyId,
          scrada_document_id: docId,
          sender_peppol_id: String(doc.peppolSenderID || doc.senderID || '').trim() || null,
          sender_name: String(doc.senderName || doc.supplierPartyName || '').trim() || null,
          document_type: String(doc.documentType || 'invoice'),
          invoice_number: String(doc.invoiceNumber || doc.number || doc.internalNumber || '').trim() || null,
          invoice_date: String(doc.invoiceDate || '').trim() || null,
          total_excl_vat: Number(doc.totalExclVat || doc.totalExclVAT || 0) || null,
          total_vat: Number(doc.totalVat || doc.totalVAT || 0) || null,
          total_incl_vat: Number(doc.totalInclVat || doc.totalInclVAT || 0) || null,
          currency: String(doc.currency || 'EUR'),
          status: 'new',
          metadata: doc,
          received_at: String(
            doc.peppolC3Timestamp ||
              doc.peppolC2Timestamp ||
              doc.receivedAt ||
              doc.createdOn ||
              new Date().toISOString()
          ),
        }));

        const { error: insertDocsError } = await supabase.from('peppol_inbound_documents').insert(inboundRows);
        if (insertDocsError) throw insertDocsError;

        const confirmationResults: Array<{ documentId: string; confirmed: boolean; status: number }> = [];
        for (const { docId, shouldConfirm } of newDocuments) {
          if (!shouldConfirm) continue;
          const confirmUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${docId}/confirm`;
          const confirmResponse = await fetch(confirmUrl, {
            method: 'PUT',
            headers: { ...scradaHeaders, 'Content-Type': 'application/json' },
          });
          confirmationResults.push({
            documentId: docId,
            confirmed: confirmResponse.ok,
            status: confirmResponse.status,
          });
        }

        const confirmedDocuments = confirmationResults.filter((item) => item.confirmed).length;
        const confirmationFailures = confirmationResults.filter((item) => !item.confirmed);

        return new Response(
          JSON.stringify({
            synced: true,
            totalFromScrada: candidateDocuments.size,
            newDocuments: newDocuments.length,
            requiredCredits,
            confirmedDocuments,
            confirmationFailures,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        await refundCredits(
          supabase,
          user.id,
          creditDeduction,
          `Refund Peppol inbound sync (${newDocuments.length} invoices)`
        );
        throw error;
      }
    }

    if (action === 'get_ubl' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${body.document_id}`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { ...scradaHeaders, Accept: 'application/xml' },
      });

      if (!scradaResponse.ok) {
        throw new HttpError(404, 'Document not found in Scrada');
      }

      const ublXml = await scradaResponse.text();
      return new Response(JSON.stringify({ ubl: ublXml }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_pdf' && body.document_id) {
      const scradaUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${body.document_id}/pdf`;
      const scradaResponse = await fetch(scradaUrl, {
        method: 'GET',
        headers: { ...scradaHeaders, Accept: 'application/pdf' },
      });

      if (!scradaResponse.ok) {
        throw new HttpError(404, 'PDF not available');
      }

      const pdfBuffer = await scradaResponse.arrayBuffer();
      return new Response(pdfBuffer, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    throw new HttpError(400, 'Unknown action. Use: list, sync, get_ubl, get_pdf');
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
