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
  'Access-Control-Expose-Headers': 'content-type, content-disposition, x-cashpilot-source-format',
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

const pickFirstText = (values: unknown[]): string | null => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
};

const resolveInboundSenderName = (doc: Record<string, unknown>): string | null =>
  pickFirstText([
    doc.senderCommercialName,
    doc.senderTradeName,
    doc.senderName,
    doc.supplierPartyName,
    doc.supplierName,
    doc.supplierLegalName,
    doc.companyName,
    doc.legalName,
  ]);

const resolveInboundSenderPeppolId = (doc: Record<string, unknown>): string | null =>
  pickFirstText([doc.peppolSenderID, doc.senderID, doc.senderPeppolId, doc.sender_peppol_id, doc.sender]);

const resolveInboundInvoiceRef = (doc: Record<string, unknown>): string | null =>
  pickFirstText([doc.invoiceNumber, doc.number, doc.invoiceNo, doc.internalNumber, doc.reference]);

const resolveInboundReceivedAt = (doc: Record<string, unknown>): string =>
  String(
    pickFirstText([
      doc.scradaReceivedAt,
      doc.receivedAt,
      doc.createdOn,
      doc.peppolC3Timestamp,
      doc.c3Timestamp,
      doc.peppolC2Timestamp,
      doc.c2Timestamp,
    ]) || new Date().toISOString()
  );

const resolveRegistrationName = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const nested = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : null;
  const details = root.details && typeof root.details === 'object' ? (root.details as Record<string, unknown>) : null;
  return pickFirstText([
    root.name,
    root.companyName,
    root.legalName,
    root.partyName,
    root.registeredName,
    nested?.name,
    nested?.companyName,
    nested?.legalName,
    nested?.partyName,
    details?.name,
    details?.companyName,
    details?.legalName,
    details?.partyName,
  ]);
};

const decodeXmlText = (value: string | null): string | null => {
  const text = String(value || '').trim();
  if (!text) return null;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

const compactErrorBody = (value: string | null): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
};

const sanitizeFileSegment = (value: string | null, fallback: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const normalized = raw.replace(/[^A-Za-z0-9._-]/g, '_');
  return normalized || fallback;
};

const resolveInboundDownloadFormat = (value: unknown): 'pdf' | 'ubl' | 'original' => {
  const format = String(value || '')
    .trim()
    .toLowerCase();
  if (format === 'pdf') return 'pdf';
  if (format === 'xml' || format === 'ubl') return 'ubl';
  return 'original';
};

const resolveInboundExtensionFromContentType = (contentType: string, fallback: string): string => {
  const mime = String(contentType || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('json')) return 'json';
  if (mime.includes('xml')) return 'xml';
  if (mime.includes('zip')) return 'zip';
  return fallback;
};

const fetchScradaWithFallback = async (
  urls: string[],
  options: RequestInit
): Promise<{ response: Response; url: string }> => {
  let bestFailure: { response: Response; url: string; body: string } | null = null;

  for (const url of urls) {
    const response = await fetch(url, options);
    if (response.ok) {
      return { response, url };
    }

    const body = await response.text().catch(() => '');
    if (!bestFailure || response.status !== 404) {
      bestFailure = { response, url, body };
    }
  }

  if (!bestFailure) {
    throw new HttpError(502, 'Scrada request failed');
  }

  const status = bestFailure.response.status;
  const reason = compactErrorBody(bestFailure.body);
  const endpoint = bestFailure.url.replace(/^https?:\/\/[^/]+/i, '');
  const message = reason ? `Scrada error ${status} on ${endpoint}: ${reason}` : `Scrada error ${status} on ${endpoint}`;

  throw new HttpError(status === 404 ? 404 : 502, message);
};

const captureFirstXmlValue = (xml: string, pattern: RegExp): string | null => {
  const match = xml.match(pattern);
  if (!match) return null;
  return decodeXmlText(match[1] || null);
};

const extractInboundUblMetadata = (
  ublXml: string
): { senderName: string | null; invoiceNumber: string | null; invoiceDate: string | null } => {
  const supplierSection =
    ublXml.match(/<cac:AccountingSupplierParty[\s\S]*?<\/cac:AccountingSupplierParty>/i)?.[0] || ublXml;

  const senderName = pickFirstText([
    captureFirstXmlValue(supplierSection, /<cbc:RegistrationName[^>]*>([\s\S]*?)<\/cbc:RegistrationName>/i),
    captureFirstXmlValue(supplierSection, /<cbc:Name[^>]*>([\s\S]*?)<\/cbc:Name>/i),
    captureFirstXmlValue(ublXml, /<cbc:RegistrationName[^>]*>([\s\S]*?)<\/cbc:RegistrationName>/i),
  ]);

  const invoiceNumber = pickFirstText([
    captureFirstXmlValue(ublXml, /<Invoice[\s\S]*?<cbc:ID[^>]*>([\s\S]*?)<\/cbc:ID>/i),
    captureFirstXmlValue(ublXml, /<cbc:ID[^>]*>([\s\S]*?)<\/cbc:ID>/i),
  ]);

  const invoiceDate = pickFirstText([
    captureFirstXmlValue(ublXml, /<cbc:IssueDate[^>]*>([\s\S]*?)<\/cbc:IssueDate>/i),
    captureFirstXmlValue(ublXml, /<cbc:TaxPointDate[^>]*>([\s\S]*?)<\/cbc:TaxPointDate>/i),
  ]);

  return {
    senderName: senderName || null,
    invoiceNumber: invoiceNumber || null,
    invoiceDate: invoiceDate || null,
  };
};

const looksLikePeppolId = (value: string | null): boolean => {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^\d{4}:[A-Za-z0-9._-]+$/i.test(text);
};

const shouldUpdateSenderName = (
  existingSenderName: unknown,
  existingSenderPeppolId: unknown,
  newSenderName: string | null
): boolean => {
  const existingName = String(existingSenderName || '').trim();
  const existingPeppolId = String(existingSenderPeppolId || '').trim();
  const candidate = String(newSenderName || '').trim();
  if (!candidate) return false;
  if (!existingName) return true;
  if (existingName === candidate) return false;
  if (looksLikePeppolId(existingName)) return true;
  if (existingPeppolId && existingName === existingPeppolId) return true;
  return false;
};

const shouldUpdateInvoiceNumber = (existingInvoiceNumber: unknown, newInvoiceNumber: string | null): boolean => {
  const existingValue = String(existingInvoiceNumber || '').trim();
  const candidate = String(newInvoiceNumber || '').trim();
  if (!candidate) return false;
  if (!existingValue) return true;
  if (existingValue === candidate) return false;

  // Older syncs may have stored ordinal placeholders (1,2,3,4) instead of invoice references.
  if (/^\d{1,4}$/.test(existingValue)) {
    return true;
  }

  return false;
};

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
      const senderNameCache = new Map<string, string | null>();
      const ublMetadataCache = new Map<
        string,
        { senderName: string | null; invoiceNumber: string | null; invoiceDate: string | null } | null
      >();

      const resolveSenderCommercialName = async (senderPeppolId: string | null): Promise<string | null> => {
        const normalized = String(senderPeppolId || '').trim();
        if (!normalized) return null;
        if (senderNameCache.has(normalized)) return senderNameCache.get(normalized) || null;

        const checkUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolRegistration/check/${encodeURIComponent(normalized)}`;
        try {
          const response = await fetch(checkUrl, {
            method: 'GET',
            headers: { ...scradaHeaders, Accept: 'application/json' },
          });
          if (!response.ok) {
            senderNameCache.set(normalized, null);
            return null;
          }
          const payload = await response.json().catch(() => null);
          const name = resolveRegistrationName(payload);
          senderNameCache.set(normalized, name || null);
          return name || null;
        } catch {
          senderNameCache.set(normalized, null);
          return null;
        }
      };

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

      const resolveDocumentUblMetadata = async (
        documentId: string
      ): Promise<{ senderName: string | null; invoiceNumber: string | null; invoiceDate: string | null } | null> => {
        const normalized = String(documentId || '').trim();
        if (!normalized) return null;
        if (ublMetadataCache.has(normalized)) return ublMetadataCache.get(normalized) || null;

        const ublUrl = `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${encodeURIComponent(normalized)}`;
        try {
          const response = await fetch(ublUrl, {
            method: 'GET',
            headers: { ...scradaHeaders, Accept: 'application/xml' },
          });
          if (!response.ok) {
            ublMetadataCache.set(normalized, null);
            return null;
          }
          const ublXml = await response.text();
          const metadata = extractInboundUblMetadata(ublXml);
          ublMetadataCache.set(normalized, metadata);
          return metadata;
        } catch {
          ublMetadataCache.set(normalized, null);
          return null;
        }
      };

      const backfillStoredInboundDocuments = async (): Promise<number> => {
        const { data: storedDocs, error: storedDocsError } = await supabase
          .from('peppol_inbound_documents')
          .select('id, scrada_document_id, sender_peppol_id, sender_name, invoice_number, invoice_date')
          .eq('user_id', user.id)
          .eq('company_id', companyId)
          .order('received_at', { ascending: false })
          .limit(25);
        if (storedDocsError) throw storedDocsError;

        let backfilled = 0;
        for (const row of storedDocs || []) {
          const docId = String(row.scrada_document_id || '').trim();
          if (!docId) continue;

          const senderPeppolId = String(row.sender_peppol_id || '').trim() || null;
          let senderNameFromRegistry: string | null = null;
          if (senderPeppolId) {
            senderNameFromRegistry = await resolveSenderCommercialName(senderPeppolId);
          }

          const ublMetadata = await resolveDocumentUblMetadata(docId);
          const candidateSenderName = senderNameFromRegistry || ublMetadata?.senderName || null;
          const candidateInvoiceNumber = ublMetadata?.invoiceNumber || null;
          const candidateInvoiceDate = ublMetadata?.invoiceDate || null;

          const updatePayload: Record<string, unknown> = {};
          if (shouldUpdateSenderName(row.sender_name, row.sender_peppol_id, candidateSenderName)) {
            updatePayload.sender_name = candidateSenderName;
          }
          if (shouldUpdateInvoiceNumber(row.invoice_number, candidateInvoiceNumber)) {
            updatePayload.invoice_number = candidateInvoiceNumber;
          }
          if (!String(row.invoice_date || '').trim() && candidateInvoiceDate) {
            updatePayload.invoice_date = candidateInvoiceDate;
          }

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateError } = await supabase
              .from('peppol_inbound_documents')
              .update(updatePayload)
              .eq('id', String(row.id || ''))
              .eq('user_id', user.id)
              .eq('company_id', companyId);
            if (updateError) throw updateError;
            backfilled += 1;
          }
        }

        return backfilled;
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
        const backfilledDocuments = await backfillStoredInboundDocuments();
        return new Response(
          JSON.stringify({
            synced: true,
            totalFromScrada: 0,
            newDocuments: 0,
            requiredCredits: 0,
            backfilledDocuments,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: existingDocs, error: existingDocsError } = await supabase
        .from('peppol_inbound_documents')
        .select('id, scrada_document_id, sender_peppol_id, sender_name, invoice_number, invoice_date, received_at')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .in('scrada_document_id', candidateIds);
      if (existingDocsError) throw existingDocsError;

      const existingByDocId = new Map(
        (existingDocs || []).map((row) => [String(row.scrada_document_id || '').trim(), row as Record<string, unknown>])
      );
      const newDocuments: Array<{ docId: string; doc: Record<string, unknown>; shouldConfirm: boolean }> = [];
      for (const [docId, payload] of candidateDocuments.entries()) {
        const existing = existingByDocId.get(docId);
        if (existing) {
          const updatePayload: Record<string, unknown> = {};
          const senderPeppolId =
            resolveInboundSenderPeppolId(payload.doc) || String(existing.sender_peppol_id || '').trim() || null;
          let senderName = resolveInboundSenderName(payload.doc);
          if (!senderName && senderPeppolId) {
            senderName = await resolveSenderCommercialName(senderPeppolId);
          }
          let invoiceRef = resolveInboundInvoiceRef(payload.doc);
          let invoiceDate = String(payload.doc.invoiceDate || '').trim() || null;
          if (!senderName || !invoiceRef || !invoiceDate) {
            const ublMetadata = await resolveDocumentUblMetadata(docId);
            if (!senderName && ublMetadata?.senderName) senderName = ublMetadata.senderName;
            if (!invoiceRef && ublMetadata?.invoiceNumber) invoiceRef = ublMetadata.invoiceNumber;
            if (!invoiceDate && ublMetadata?.invoiceDate) invoiceDate = ublMetadata.invoiceDate;
          }
          const receivedAt = resolveInboundReceivedAt(payload.doc);

          if (!String(existing.sender_peppol_id || '').trim() && senderPeppolId) {
            updatePayload.sender_peppol_id = senderPeppolId;
          }
          if (shouldUpdateSenderName(existing.sender_name, existing.sender_peppol_id, senderName)) {
            updatePayload.sender_name = senderName;
          }
          if (shouldUpdateInvoiceNumber(existing.invoice_number, invoiceRef)) {
            updatePayload.invoice_number = invoiceRef;
          }
          if (!String(existing.invoice_date || '').trim() && invoiceDate) {
            updatePayload.invoice_date = invoiceDate;
          }
          if (!String(existing.received_at || '').trim() && receivedAt) {
            updatePayload.received_at = receivedAt;
          }

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateError } = await supabase
              .from('peppol_inbound_documents')
              .update(updatePayload)
              .eq('id', String(existing.id || ''))
              .eq('user_id', user.id)
              .eq('company_id', companyId);
            if (updateError) throw updateError;
          }

          continue;
        }
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
        const inboundRows: Record<string, unknown>[] = [];
        for (const { docId, doc } of newDocuments) {
          const senderPeppolId = resolveInboundSenderPeppolId(doc);
          let senderName = resolveInboundSenderName(doc);
          if (!senderName && senderPeppolId) {
            senderName = await resolveSenderCommercialName(senderPeppolId);
          }
          let invoiceNumber = resolveInboundInvoiceRef(doc);
          let invoiceDate = String(doc.invoiceDate || '').trim() || null;
          if (!senderName || !invoiceNumber || !invoiceDate) {
            const ublMetadata = await resolveDocumentUblMetadata(docId);
            if (!senderName && ublMetadata?.senderName) senderName = ublMetadata.senderName;
            if (!invoiceNumber && ublMetadata?.invoiceNumber) invoiceNumber = ublMetadata.invoiceNumber;
            if (!invoiceDate && ublMetadata?.invoiceDate) invoiceDate = ublMetadata.invoiceDate;
          }

          inboundRows.push({
            user_id: user.id,
            company_id: companyId,
            scrada_document_id: docId,
            sender_peppol_id: senderPeppolId,
            sender_name: senderName,
            document_type: String(doc.documentType || 'invoice'),
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            total_excl_vat: Number(doc.totalExclVat || doc.totalExclVAT || 0) || null,
            total_vat: Number(doc.totalVat || doc.totalVAT || 0) || null,
            total_incl_vat: Number(doc.totalInclVat || doc.totalInclVAT || 0) || null,
            currency: String(doc.currency || 'EUR'),
            status: 'new',
            metadata: doc,
            received_at: resolveInboundReceivedAt(doc),
          });
        }

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
      const encodedDocumentId = encodeURIComponent(String(body.document_id));
      const candidates = [
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${encodedDocumentId}`,
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/document/${encodedDocumentId}`,
      ];
      const { response: scradaResponse } = await fetchScradaWithFallback(candidates, {
        method: 'GET',
        headers: { ...scradaHeaders, Accept: 'application/xml' },
      });
      const ublXml = await scradaResponse.text();
      return new Response(JSON.stringify({ ubl: ublXml }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_pdf' && body.document_id) {
      const encodedDocumentId = encodeURIComponent(String(body.document_id));
      const candidates = [
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${encodedDocumentId}/pdf`,
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/document/${encodedDocumentId}/pdf`,
      ];
      const { response: scradaResponse } = await fetchScradaWithFallback(candidates, {
        method: 'GET',
        headers: { ...scradaHeaders, Accept: 'application/pdf' },
      });
      const pdfBuffer = await scradaResponse.arrayBuffer();
      return new Response(pdfBuffer, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
      });
    }

    if (action === 'download' && body.document_id) {
      const encodedDocumentId = encodeURIComponent(String(body.document_id));
      const requestedFormat = resolveInboundDownloadFormat(body.format);
      const formatSuffix = requestedFormat === 'pdf' ? '/pdf' : '';
      const candidates = [
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppol/inbound/document/${encodedDocumentId}${formatSuffix}`,
        `${scradaBaseUrl}/company/${company.scrada_company_id}/peppolInbound/document/${encodedDocumentId}${formatSuffix}`,
      ];
      const { response: scradaResponse } = await fetchScradaWithFallback(candidates, {
        method: 'GET',
        headers: {
          ...scradaHeaders,
          Accept: requestedFormat === 'pdf' ? 'application/pdf' : 'application/xml, text/xml, */*',
        },
      });

      const payload = await scradaResponse.arrayBuffer();
      const contentType =
        scradaResponse.headers.get('content-type') ||
        (requestedFormat === 'pdf' ? 'application/pdf' : 'application/xml;charset=utf-8');
      const safeDocumentId = sanitizeFileSegment(String(body.document_id), 'document');
      const defaultExtension = requestedFormat === 'pdf' ? 'pdf' : requestedFormat === 'ubl' ? 'xml' : 'dat';
      const extension = resolveInboundExtensionFromContentType(contentType, defaultExtension);
      const fileName = `Peppol-Inbound-${safeDocumentId}.${extension}`;

      return new Response(payload, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'x-cashpilot-source-format': requestedFormat,
        },
      });
    }

    throw new HttpError(400, 'Unknown action. Use: list, sync, get_ubl, get_pdf, download');
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof HttpError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
