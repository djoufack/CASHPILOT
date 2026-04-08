import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { extractInvoiceData } from '@/services/invoiceExtractionService';
import { buildPeppolQueueAssessment } from '@/services/peppolValidation';
import { generateInvoiceNumber } from '@/utils/calculations';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';

const toText = (value) => String(value ?? '').trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const SCANNABLE_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const OUTBOUND_IMPORT_NOTE_PREFIX = 'Import PDF Peppol';

const sanitizeFileName = (fileName) =>
  String(fileName || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

const normalizeIsoDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
};

const detectMimeFromName = (fileName) => {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

const resolveUniqueInvoiceNumber = async (userId, requestedNumber) => {
  const base = toText(requestedNumber) || `INV-${Date.now()}`;
  let candidate = base;
  let suffix = 1;

  while (suffix < 500) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', userId)
      .eq('invoice_number', candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return `${base}-${Date.now()}`;
};

const extractTagText = (xml, tagName) => {
  if (!xml) return '';
  const escapedTag = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<(?:[\\w-]+:)?${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escapedTag}>`, 'i');
  return toText(xml.match(regex)?.[1] || '');
};

const parseInboundUblSummary = (ublXml) => {
  const xml = toText(ublXml);
  if (!xml) return null;

  return {
    invoiceNumber:
      toText(xml.match(/<(?:[\w-]+:)?Invoice\b[^>]*>[\s\S]*?<(?:[\w-]+:)?ID\b[^>]*>([^<]+)<\/(?:[\w-]+:)?ID>/i)?.[1]) ||
      null,
    issueDate: extractTagText(xml, 'IssueDate') || null,
    senderName:
      (extractTagText(xml, 'AccountingSupplierParty') &&
        (extractTagText(extractTagText(xml, 'AccountingSupplierParty'), 'Name') ||
          extractTagText(extractTagText(xml, 'AccountingSupplierParty'), 'RegistrationName'))) ||
      extractTagText(xml, 'RegistrationName') ||
      null,
    totalExclVat: toNumber(extractTagText(xml, 'TaxExclusiveAmount'), 0),
    totalVat: toNumber(extractTagText(xml, 'TaxAmount'), 0),
    totalInclVat:
      toNumber(extractTagText(xml, 'PayableAmount'), 0) || toNumber(extractTagText(xml, 'TaxInclusiveAmount'), 0),
  };
};

/**
 * Hook that encapsulates all Peppol-related Supabase queries and mutations.
 * Replaces direct supabase.from() and supabase.functions.invoke() calls
 * previously embedded in PeppolPage.jsx.
 */
export function usePeppol() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const inboundPdfCacheRef = useRef(new Map());
  const inboundUblCacheRef = useRef(new Map());
  const inboundFetchInFlightRef = useRef(new Map());

  useEffect(() => {
    inboundPdfCacheRef.current.clear();
    inboundUblCacheRef.current.clear();
    inboundFetchInFlightRef.current.clear();
  }, [company?.id, user?.id]);

  // ─── Outbound invoices ───
  const {
    data: invoices,
    loading: loadingInvoices,
    refetch: fetchOutboundInvoices,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('invoices')
        .select(
          `
          *,
          client:clients!fk_invoices_client_scope(id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled),
          items:invoice_items(id, description, quantity, unit_price, total)
        `
        )
        .eq('user_id', user.id)
        .in('status', ['sent', 'paid', 'partial', 'overdue', 'cancelled'])
        .order('created_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── Inbound documents ───
  const {
    data: inboundDocuments,
    loading: loadingInbound,
    refetch: fetchInboundDocuments,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('peppol_inbound_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false });
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── Supplier invoices linked to inbound Peppol docs (business status source) ───
  const {
    data: inboundSupplierInvoices,
    loading: loadingInboundSupplierInvoices,
    refetch: fetchInboundSupplierInvoices,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user || !company?.id) return [];
      let query = supabase
        .from('supplier_invoices')
        .select(
          'id, company_id, invoice_number, payment_status, status, due_date, notes, updated_at, dispute_status, disputed_at, dispute_note'
        )
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .order('updated_at', { ascending: false })
        .limit(500);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, company?.id, applyCompanyScope], defaultData: [], enabled: !!user && !!company?.id }
  );

  // ─── All transmission logs ───
  const {
    data: allLogs,
    loading: loadingLogs,
    refetch: fetchAllLogs,
  } = useSupabaseQuery(
    async (_guard) => {
      if (!user) return [];
      let query = supabase
        .from('peppol_transmission_log')
        .select(`*, invoice:invoices(id, invoice_number)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      query = applyCompanyScope(query, { includeUnassigned: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    { deps: [user?.id, applyCompanyScope], defaultData: [], enabled: !!user }
  );

  // ─── AP account info ───
  const [apInfo, setApInfo] = useState(null);
  const [loadingApInfo, setLoadingApInfo] = useState(false);

  const fetchApInfo = useCallback(async () => {
    if (!user) return;
    setLoadingApInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('peppol-account-info', {
        body: { company_id: company?.id || null },
      });
      if (error) throw error;
      setApInfo(data);
    } catch (err) {
      console.error('Error fetching AP info:', err);
      setApInfo(null);
    } finally {
      setLoadingApInfo(false);
    }
  }, [company?.id, user]);

  // ─── Fetch invoice items (for send dialog, view, UBL export) ───
  const fetchInvoiceItems = useCallback(async (invoiceId) => {
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
    if (error) throw error;
    return data || [];
  }, []);

  // ─── Sync inbound (edge function) ───
  const [syncingInbound, setSyncingInbound] = useState(false);
  const [managingOutbound, setManagingOutbound] = useState(false);
  const [importingOutboundQueue, setImportingOutboundQueue] = useState(false);
  const [outboundImportProgress, setOutboundImportProgress] = useState({ current: 0, total: 0, currentLabel: '' });

  const invokeInboundAction = useCallback(
    async (action, payload = {}) => {
      if (!user) return null;
      const { data, error } = await supabase.functions.invoke('peppol-inbound', {
        body: {
          action,
          company_id: company?.id || null,
          ...payload,
        },
      });
      if (error) throw error;
      return data;
    },
    [company?.id, user]
  );

  const syncInbound = useCallback(async () => {
    if (!user) return null;
    setSyncingInbound(true);
    try {
      return await invokeInboundAction('sync');
    } catch (err) {
      const details = await readFunctionErrorData(err);
      throw details || err;
    } finally {
      setSyncingInbound(false);
    }
  }, [invokeInboundAction, user]);

  const fetchInboundAction = useCallback(
    async (action, documentId, { asBlob = false, timeoutMs = 20000 } = {}) => {
      if (!documentId) return null;
      const inFlightKey = `${action}:${String(documentId)}:${asBlob ? 'blob' : 'json'}`;

      if (inboundFetchInFlightRef.current.has(inFlightKey)) {
        return inboundFetchInFlightRef.current.get(inFlightKey);
      }

      const requestPromise = (async () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) {
          throw new Error('Configuration Supabase manquante.');
        }

        const resolveAccessToken = async ({ allowRefresh = false, forceRefresh = false } = {}) => {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          const currentToken = sessionData?.session?.access_token;
          if (currentToken && !forceRefresh) return currentToken;

          if (!allowRefresh) return null;

          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          return refreshData?.session?.access_token || null;
        };

        const performRequest = async (accessToken) => {
          if (!accessToken) {
            throw new Error('Session expirée. Veuillez vous reconnecter.');
          }
          return await fetch(`${supabaseUrl}/functions/v1/peppol-inbound`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action,
              company_id: company?.id || null,
              document_id: documentId,
            }),
            signal: controller.signal,
          });
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const initialToken = await resolveAccessToken({ allowRefresh: true });
          let response = await performRequest(initialToken);

          if (response.status === 401) {
            const refreshedToken = await resolveAccessToken({ allowRefresh: true, forceRefresh: true });
            response = await performRequest(refreshedToken);
          }

          if (!response.ok) {
            const text = await response.text();
            let reason = text || `Erreur ${response.status}`;
            try {
              const parsed = JSON.parse(text);
              reason = parsed?.error || parsed?.message || reason;
            } catch {
              // Keep raw text reason.
            }
            throw new Error(reason);
          }

          if (asBlob) {
            const blob = await response.blob();
            if (!blob || blob.size === 0) {
              throw new Error('PDF vide retourné par Scrada.');
            }
            return blob;
          }

          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            return { raw: text };
          }
        } catch (error) {
          if (error?.name === 'AbortError') {
            throw new Error('Délai dépassé lors de la récupération du document.');
          }
          throw error;
        } finally {
          clearTimeout(timer);
        }
      })();

      inboundFetchInFlightRef.current.set(inFlightKey, requestPromise);
      try {
        return await requestPromise;
      } finally {
        inboundFetchInFlightRef.current.delete(inFlightKey);
      }
    },
    [company?.id]
  );

  const fetchInboundUbl = useCallback(
    async (documentId, options = {}) => {
      if (!documentId) return null;
      const localUbl = toText(options?.cachedUbl || '');
      if (localUbl) {
        inboundUblCacheRef.current.set(documentId, localUbl);
        return localUbl;
      }
      if (inboundUblCacheRef.current.has(documentId)) {
        return inboundUblCacheRef.current.get(documentId);
      }
      const timeoutMs = Number(options?.timeoutMs || 20_000);
      const data = await fetchInboundAction('get_ubl', documentId, { asBlob: false, timeoutMs });
      const ubl = data?.ubl || null;
      if (ubl) inboundUblCacheRef.current.set(documentId, ubl);
      return ubl;
    },
    [fetchInboundAction]
  );

  const fetchInboundPdf = useCallback(
    async (documentId, options = {}) => {
      if (!documentId) return null;
      const forceRefresh = options?.forceRefresh === true;
      const timeoutMs = Number(options?.timeoutMs || 45_000);
      if (!forceRefresh && inboundPdfCacheRef.current.has(documentId)) {
        return inboundPdfCacheRef.current.get(documentId);
      }
      const pdfBlob = await fetchInboundAction('get_pdf', documentId, { asBlob: true, timeoutMs });
      inboundPdfCacheRef.current.set(documentId, pdfBlob);
      return pdfBlob;
    },
    [fetchInboundAction]
  );

  const warmInboundDocuments = useCallback(
    async (documents, { includePdf = true, limit = 2 } = {}) => {
      const docs = Array.isArray(documents) ? documents : [];
      if (docs.length === 0) return;

      const selectedDocs = docs
        .filter((doc) => toText(doc?.scrada_document_id))
        .slice(0, Math.max(1, Number(limit || 1)));

      await Promise.allSettled(
        selectedDocs.map(async (doc) => {
          const documentId = toText(doc?.scrada_document_id);
          if (!documentId) return;

          const cachedUbl = toText(doc?.ubl_xml || '');
          if (cachedUbl) {
            inboundUblCacheRef.current.set(documentId, cachedUbl);
          } else {
            await fetchInboundUbl(documentId, { timeoutMs: 20_000 });
          }

          if (includePdf) {
            await fetchInboundPdf(documentId, { timeoutMs: 45_000 });
          }
        })
      );
    },
    [fetchInboundPdf, fetchInboundUbl]
  );

  const upsertSupplierForInbound = useCallback(
    async (doc) => {
      if (!user?.id || !company?.id) {
        throw new Error('Aucune societe active detectee.');
      }
      const supplierName = (doc?.sender_name || `Fournisseur ${doc?.sender_peppol_id || ''}`).trim();
      const baseName = supplierName || `Fournisseur ${String(doc?.scrada_document_id || '').slice(0, 8)}`;
      const senderPeppolId = toText(doc?.sender_peppol_id);
      const peppolNote = senderPeppolId ? `Peppol sender: ${senderPeppolId}` : null;

      let query = supabase
        .from('suppliers')
        .select('id, company_name, contact_person, notes')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .ilike('company_name', baseName)
        .limit(1);
      query = applyCompanyScope(query);

      const { data: existingSupplier, error: lookupError } = await query.maybeSingle();
      if (lookupError) throw lookupError;
      if (existingSupplier) {
        const patch = {};
        const incomingContact = toText(doc?.sender_name);
        const currentContact = toText(existingSupplier.contact_person);
        if (incomingContact && incomingContact !== currentContact) {
          patch.contact_person = incomingContact;
        }

        if (peppolNote) {
          const currentNotes = toText(existingSupplier.notes);
          if (!currentNotes.includes(peppolNote)) {
            patch.notes = currentNotes ? `${currentNotes}\n${peppolNote}` : peppolNote;
          }
        }

        if (Object.keys(patch).length > 0) {
          const { data: updatedSupplier, error: updateError } = await supabase
            .from('suppliers')
            .update(patch)
            .eq('id', existingSupplier.id)
            .eq('user_id', user.id)
            .eq('company_id', company.id)
            .select('id, company_name, contact_person, notes')
            .single();
          if (updateError) throw updateError;
          return updatedSupplier;
        }

        return existingSupplier;
      }

      const { data: createdSupplier, error: createError } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          company_id: company.id,
          company_name: baseName,
          contact_person: doc?.sender_name || null,
          notes: peppolNote,
          status: 'active',
          supplier_type: 'service',
        })
        .select('id, company_name, contact_person, notes')
        .single();
      if (createError) throw createError;
      return createdSupplier;
    },
    [applyCompanyScope, company?.id, user?.id]
  );

  const sendInboundToGed = useCallback(
    async (doc) => {
      if (!user || !company?.id || !doc?.scrada_document_id) {
        throw new Error('Document entrant invalide.');
      }

      let parsedUbl = null;
      const needsUblFallback =
        !doc?.invoice_date ||
        !doc?.invoice_number ||
        !doc?.sender_name ||
        (Number(doc?.total_incl_vat || 0) <= 0 && Number(doc?.total_excl_vat || 0) <= 0);
      if (needsUblFallback) {
        try {
          const ublXml = await fetchInboundUbl(doc.scrada_document_id, { cachedUbl: doc?.ubl_xml || null });
          parsedUbl = parseInboundUblSummary(ublXml);
        } catch {
          parsedUbl = null;
        }
      }

      const enrichedDoc = {
        ...doc,
        sender_name: doc?.sender_name || parsedUbl?.senderName || null,
        invoice_number: doc?.invoice_number || parsedUbl?.invoiceNumber || null,
        invoice_date: doc?.invoice_date || parsedUbl?.issueDate || null,
        total_excl_vat:
          Number(doc?.total_excl_vat || 0) > 0 ? Number(doc.total_excl_vat) : Number(parsedUbl?.totalExclVat || 0),
        total_vat: Number(doc?.total_vat || 0) > 0 ? Number(doc.total_vat) : Number(parsedUbl?.totalVat || 0),
        total_incl_vat:
          Number(doc?.total_incl_vat || 0) > 0 ? Number(doc.total_incl_vat) : Number(parsedUbl?.totalInclVat || 0),
      };

      const supplier = await upsertSupplierForInbound(enrichedDoc);
      const invoiceDate = String(enrichedDoc.invoice_date || doc.received_at || new Date().toISOString()).slice(0, 10);
      const totalExcl = Number(enrichedDoc.total_excl_vat || 0);
      const totalVat = Number(enrichedDoc.total_vat || 0);
      const totalIncl = Number(enrichedDoc.total_incl_vat || totalExcl + totalVat || 0);
      const vatRate = totalExcl > 0 ? Number(((totalVat / totalExcl) * 100).toFixed(2)) : 0;
      const inboundNumber =
        String(enrichedDoc.invoice_number || '').trim() || `PEPPOL-IN-${String(doc.scrada_document_id).slice(0, 10)}`;

      const { data: createdInvoice, error: createInvoiceError } = await supabase
        .from('supplier_invoices')
        .insert({
          user_id: user.id,
          company_id: company.id,
          supplier_id: supplier.id,
          invoice_number: inboundNumber,
          invoice_date: invoiceDate,
          due_date: invoiceDate,
          status: 'received',
          total_ht: totalExcl || totalIncl,
          vat_rate: vatRate,
          vat_amount: totalVat,
          total_amount: totalIncl || totalExcl,
          total_ttc: totalIncl || totalExcl,
          payment_status: 'pending',
          approval_status: 'pending',
          notes: `Import Peppol entrant ${doc.scrada_document_id}`,
        })
        .select('id, invoice_number')
        .single();
      if (createInvoiceError || !createdInvoice) throw createInvoiceError || new Error('Creation facture impossible');

      const pdfBlob = await fetchInboundPdf(doc.scrada_document_id);
      if (!pdfBlob) throw new Error('PDF Scrada indisponible.');

      const safeFileNumber = String(createdInvoice.invoice_number || 'supplier-invoice').replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );
      const storagePath = `${user.id}/peppol-inbound/${Date.now()}-${safeFileNumber}.pdf`;
      const { error: uploadError } = await supabase.storage.from('supplier-invoices').upload(storagePath, pdfBlob, {
        upsert: true,
        contentType: 'application/pdf',
      });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('supplier_invoices')
        .update({
          file_url: storagePath,
          file_generated_at: new Date().toISOString(),
        })
        .eq('id', createdInvoice.id)
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      // Keep GED metadata coherent so the document is visible and tagged as accounting by default.
      await supabase.from('document_hub_metadata').upsert(
        {
          company_id: company.id,
          source_table: 'supplier_invoices',
          source_id: createdInvoice.id,
          doc_category: 'accounting',
          confidentiality_level: 'internal',
          notes: `Source Peppol entrant: ${doc.scrada_document_id}`,
          tags: ['peppol', 'scrada', 'inbound', 'pending_payment'],
        },
        { onConflict: 'company_id,source_table,source_id' }
      );

      // Mark inbound Peppol document as integrated in accounting workflow.
      const inboundMetadata = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
      const { error: inboundUpdateError } = await supabase
        .from('peppol_inbound_documents')
        .update({
          status: 'processed',
          metadata: {
            ...inboundMetadata,
            supplier_invoice_id: createdInvoice.id,
            accounting_integration_status: 'integrated',
            accounting_integrated_at: new Date().toISOString(),
            supplier_invoice_payment_status: 'pending',
          },
        })
        .eq('id', doc.id)
        .eq('user_id', user.id)
        .eq('company_id', company.id);
      if (inboundUpdateError) throw inboundUpdateError;

      return {
        supplierInvoiceId: createdInvoice.id,
        invoiceNumber: createdInvoice.invoice_number,
        storagePath,
      };
    },
    [company?.id, fetchInboundPdf, fetchInboundUbl, upsertSupplierForInbound, user]
  );

  const listGedXmlDocuments = useCallback(async () => {
    if (!user) return [];
    let query = supabase
      .from('document_hub_versions')
      .select(
        'id, company_id, source_table, source_id, version, file_name, mime_type, storage_bucket, storage_path, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(120);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter((row) => {
      const mime = String(row.mime_type || '').toLowerCase();
      const fileName = String(row.file_name || '').toLowerCase();
      return mime.includes('xml') || fileName.endsWith('.xml');
    });
  }, [applyCompanyScope, user]);

  const downloadGedXmlDocument = useCallback(async (versionRow) => {
    if (!versionRow?.storage_bucket || !versionRow?.storage_path) {
      throw new Error('Version GED invalide.');
    }
    const { data, error } = await supabase.storage.from(versionRow.storage_bucket).download(versionRow.storage_path);
    if (error) throw error;
    return await data.text();
  }, []);

  const listGedScannableDocuments = useCallback(async () => {
    if (!user) return [];
    let query = supabase
      .from('document_hub_versions')
      .select(
        'id, company_id, source_table, source_id, version, file_name, mime_type, storage_bucket, storage_path, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(200);
    query = applyCompanyScope(query, { includeUnassigned: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter((row) => {
      const mime = String(row.mime_type || '').toLowerCase();
      const fileName = String(row.file_name || '').toLowerCase();
      return (
        SCANNABLE_MIME_TYPES.has(mime) ||
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.webp')
      );
    });
  }, [applyCompanyScope, user]);

  const downloadGedBinaryDocument = useCallback(async (versionRow) => {
    if (!versionRow?.storage_bucket || !versionRow?.storage_path) {
      throw new Error('Version GED invalide.');
    }
    const { data, error } = await supabase.storage.from(versionRow.storage_bucket).download(versionRow.storage_path);
    if (error) throw error;
    return data;
  }, []);

  const resolveOutboundQueueClient = useCallback(
    async ({ companyId, invoiceNumber, extracted }) => {
      if (!user?.id || !companyId) throw new Error('Aucune societe active detectee.');

      const rawEndpointCandidate = toText(
        extracted?.buyer_peppol_endpoint_id ||
          extracted?.buyer_peppol_id ||
          extracted?.customer_peppol_id ||
          extracted?.receiver_peppol_id ||
          extracted?.peppol_endpoint_id
      );
      const endpointParts = rawEndpointCandidate.includes(':')
        ? rawEndpointCandidate.split(':').map((part) => toText(part))
        : [];
      const endpointId = toText(endpointParts.length === 2 ? endpointParts[1] : rawEndpointCandidate);
      const endpointScheme = toText(
        endpointParts.length === 2
          ? endpointParts[0]
          : extracted?.buyer_peppol_scheme_id || extracted?.customer_peppol_scheme_id || ''
      );

      const buyerNameCandidates = [
        extracted?.customer_name,
        extracted?.buyer_name,
        extracted?.client_name,
        extracted?.buyer_company_name,
        extracted?.bill_to_name,
        extracted?.recipient_name,
      ]
        .map((value) => toText(value))
        .filter(Boolean);

      const fallbackName = `Client a corriger${invoiceNumber ? ` (${invoiceNumber})` : ''}`;
      const clientName = buyerNameCandidates[0] || fallbackName;

      if (endpointId) {
        let endpointQuery = supabase
          .from('clients')
          .select('id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled')
          .eq('user_id', user.id)
          .eq('company_id', companyId)
          .eq('peppol_endpoint_id', endpointId)
          .limit(1);
        endpointQuery = applyCompanyScope(endpointQuery, { includeUnassigned: false });
        const { data: endpointMatches, error: endpointError } = await endpointQuery;
        if (endpointError) throw endpointError;
        if (endpointMatches?.[0]) return endpointMatches[0];
      }

      if (clientName) {
        let nameQuery = supabase
          .from('clients')
          .select('id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled')
          .eq('user_id', user.id)
          .eq('company_id', companyId)
          .ilike('company_name', clientName)
          .limit(1);
        nameQuery = applyCompanyScope(nameQuery, { includeUnassigned: false });
        const { data: nameMatches, error: nameError } = await nameQuery;
        if (nameError) throw nameError;
        if (nameMatches?.[0]) {
          if (endpointId && !toText(nameMatches[0].peppol_endpoint_id)) {
            const { data: updatedClient, error: updateClientError } = await supabase
              .from('clients')
              .update({
                peppol_endpoint_id: endpointId,
                peppol_scheme_id: endpointScheme || '0208',
                electronic_invoicing_enabled: true,
              })
              .eq('id', nameMatches[0].id)
              .eq('user_id', user.id)
              .eq('company_id', companyId)
              .select(
                'id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled'
              )
              .single();
            if (updateClientError) throw updateClientError;
            return updatedClient;
          }
          return nameMatches[0];
        }
      }

      const { data: createdClient, error: createClientError } = await supabase
        .from('clients')
        .insert(
          withCompanyScope({
            user_id: user.id,
            company_id: companyId,
            company_name: clientName,
            contact_name: clientName,
            peppol_endpoint_id: endpointId || null,
            peppol_scheme_id: endpointId ? endpointScheme || '0208' : null,
            electronic_invoicing_enabled: !!endpointId,
            notes: `${OUTBOUND_IMPORT_NOTE_PREFIX} - client cree automatiquement`,
          })
        )
        .select('id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled')
        .single();
      if (createClientError) throw createClientError;
      return createdClient;
    },
    [applyCompanyScope, user?.id, withCompanyScope]
  );

  const createOutboundQueueInvoiceFromExtraction = useCallback(
    async ({ companyId, extracted, client, sourceOrigin, sourceLabel, invoiceStoragePath }) => {
      if (!user?.id || !companyId) throw new Error('Aucune societe active detectee.');

      const today = new Date().toISOString().slice(0, 10);
      const invoiceDate = normalizeIsoDate(extracted?.invoice_date) || today;
      const dueDate = normalizeIsoDate(extracted?.due_date) || addDays(invoiceDate, 30);
      const totalHT = toFiniteNumberOrNull(extracted?.total_ht) ?? 0;
      const totalVAT = toFiniteNumberOrNull(extracted?.total_tva);
      let totalTTC = toFiniteNumberOrNull(extracted?.total_ttc);
      if (totalTTC == null) {
        totalTTC = Number((totalHT + (totalVAT ?? 0)).toFixed(2));
      }

      const computedTaxRate =
        toFiniteNumberOrNull(extracted?.tva_rate ?? extracted?.vat_rate) ??
        (totalHT > 0 && totalVAT != null ? Number(((totalVAT / totalHT) * 100).toFixed(2)) : 0);

      const requestedInvoiceNumber = toText(extracted?.invoice_number);
      const fallbackNumber = await generateInvoiceNumber(supabase, user.id);
      const invoiceNumber = await resolveUniqueInvoiceNumber(user.id, requestedInvoiceNumber || fallbackNumber);
      const reference = toText(extracted?.reference || extracted?.purchase_order || invoiceNumber) || invoiceNumber;
      const currency = toText(extracted?.currency).toUpperCase() || 'EUR';

      const { data: createdInvoice, error: createInvoiceError } = await supabase
        .from('invoices')
        .insert(
          withCompanyScope({
            user_id: user.id,
            company_id: companyId,
            client_id: client?.id || null,
            invoice_number: invoiceNumber,
            date: invoiceDate,
            due_date: dueDate,
            total_ht: totalHT,
            total_ttc: totalTTC,
            tax_rate: computedTaxRate,
            status: 'sent',
            payment_status: 'unpaid',
            currency,
            reference,
            file_url: invoiceStoragePath || null,
            file_generated_at: invoiceStoragePath ? new Date().toISOString() : null,
            peppol_status: 'none',
            notes: `${OUTBOUND_IMPORT_NOTE_PREFIX} (${sourceOrigin || 'disk'}: ${sourceLabel || 'document'})`,
          })
        )
        .select('*')
        .single();
      if (createInvoiceError || !createdInvoice) throw createInvoiceError || new Error('Creation facture impossible');

      const extractedItems = Array.isArray(extracted?.line_items) ? extracted.line_items : [];
      const invoiceItemsPayload =
        extractedItems.length > 0
          ? extractedItems.map((item, index) => {
              const quantity = toFiniteNumberOrNull(item?.quantity) ?? 1;
              const unitPrice = toFiniteNumberOrNull(item?.unit_price) ?? 0;
              const lineTotal =
                toFiniteNumberOrNull(item?.total) ??
                Number((Math.max(0, quantity) * Math.max(0, unitPrice)).toFixed(2));
              return {
                invoice_id: createdInvoice.id,
                description: toText(item?.description) || `Ligne ${index + 1}`,
                quantity: Math.max(0, quantity),
                unit_price: Math.max(0, unitPrice),
                total: Math.max(0, lineTotal),
                item_type: 'manual',
              };
            })
          : [
              {
                invoice_id: createdInvoice.id,
                description: 'Ligne importee automatiquement depuis PDF',
                quantity: 1,
                unit_price: Math.max(0, totalHT || totalTTC || 0),
                total: Math.max(0, totalHT || totalTTC || 0),
                item_type: 'manual',
              },
            ];

      const { data: insertedItems, error: createItemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsPayload)
        .select('id, description, quantity, unit_price, total');
      if (createItemsError) throw createItemsError;

      const assessment = buildPeppolQueueAssessment({
        invoice: {
          ...createdInvoice,
          total_vat:
            totalVAT != null
              ? totalVAT
              : Number((Number(createdInvoice.total_ttc || 0) - Number(createdInvoice.total_ht || 0)).toFixed(2)),
        },
        seller: company || {},
        buyer: client || {},
        items: insertedItems || [],
      });

      const { data: updatedInvoice, error: updateInvoiceError } = await supabase
        .from('invoices')
        .update({
          peppol_error_message: assessment.ready ? null : assessment.reasonText,
        })
        .eq('id', createdInvoice.id)
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .select('*')
        .single();
      if (updateInvoiceError) throw updateInvoiceError;

      return {
        invoice: updatedInvoice || createdInvoice,
        items: insertedItems || [],
        queueStatus: assessment.queueStatus,
        reasons: assessment.reasons,
      };
    },
    [company, user?.id, withCompanyScope]
  );

  // ─── Refresh all data ───
  const refreshAll = useCallback(() => {
    fetchOutboundInvoices();
    fetchInboundDocuments();
    fetchInboundSupplierInvoices();
    fetchAllLogs();
  }, [fetchAllLogs, fetchInboundDocuments, fetchInboundSupplierInvoices, fetchOutboundInvoices]);

  const processSingleOutboundImport = useCallback(
    async ({ fileBlob, fileName, mimeType, sourceOrigin, sourceLabel }) => {
      if (!user?.id || !company?.id) throw new Error('Aucune societe active detectee.');
      const safeMime = toText(mimeType).toLowerCase() || detectMimeFromName(fileName);
      if (!SCANNABLE_MIME_TYPES.has(safeMime)) {
        throw new Error('Format non supporte. Utilisez PDF, JPG, PNG ou WEBP.');
      }

      const safeName = sanitizeFileName(fileName || `import-${Date.now()}`);
      const extractionPath = `${user.id}/peppol-outbound-import/${Date.now()}-${safeName}`;
      const outboundStoragePath = `${user.id}/peppol-outbound/${Date.now()}-${safeName}`;

      const { error: uploadForExtractionError } = await supabase.storage
        .from('supplier-invoices')
        .upload(extractionPath, fileBlob, {
          upsert: true,
          contentType: safeMime,
        });
      if (uploadForExtractionError) throw uploadForExtractionError;

      const { error: uploadForInvoiceError } = await supabase.storage
        .from('invoices')
        .upload(outboundStoragePath, fileBlob, {
          upsert: true,
          contentType: safeMime,
        });
      if (uploadForInvoiceError) {
        console.warn('Peppol outbound invoice upload skipped:', uploadForInvoiceError);
      }

      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionResult?.session?.access_token || null;
      if (!accessToken) throw new Error('Session utilisateur indisponible.');

      const extracted = await extractInvoiceData({
        filePath: extractionPath,
        fileType: safeMime,
        userId: user.id,
        accessToken,
      });
      if (!extracted) throw new Error('Extraction IA impossible pour ce document.');

      const candidateInvoiceNumber = toText(extracted?.invoice_number);
      const client = await resolveOutboundQueueClient({
        companyId: company.id,
        invoiceNumber: candidateInvoiceNumber,
        extracted,
      });

      return await createOutboundQueueInvoiceFromExtraction({
        companyId: company.id,
        extracted,
        client,
        sourceOrigin: sourceOrigin || 'disk',
        sourceLabel: sourceLabel || safeName,
        invoiceStoragePath: uploadForInvoiceError ? null : outboundStoragePath,
      });
    },
    [company?.id, createOutboundQueueInvoiceFromExtraction, resolveOutboundQueueClient, user?.id]
  );

  const importDiskFilesToOutboundQueue = useCallback(
    async (files) => {
      const queue = Array.from(files || []).filter(Boolean);
      if (!user || !company?.id) throw new Error('Aucune societe active detectee.');
      if (queue.length === 0) return { total: 0, imported: [], failed: [] };

      setImportingOutboundQueue(true);
      setOutboundImportProgress({ current: 0, total: queue.length, currentLabel: '' });
      const imported = [];
      const failed = [];

      try {
        for (let index = 0; index < queue.length; index += 1) {
          const file = queue[index];
          const label = toText(file?.name) || `document-${index + 1}`;
          setOutboundImportProgress({ current: index + 1, total: queue.length, currentLabel: label });
          try {
            const result = await processSingleOutboundImport({
              fileBlob: file,
              fileName: label,
              mimeType: file?.type,
              sourceOrigin: 'disk',
              sourceLabel: label,
            });
            imported.push(result);
          } catch (error) {
            failed.push({ fileName: label, message: error?.message || String(error) });
          }
        }
      } finally {
        setImportingOutboundQueue(false);
        setOutboundImportProgress({ current: 0, total: 0, currentLabel: '' });
        refreshAll();
      }

      return { total: queue.length, imported, failed };
    },
    [company?.id, processSingleOutboundImport, refreshAll, user]
  );

  const importGedDocumentsToOutboundQueue = useCallback(
    async (versions) => {
      const queue = Array.isArray(versions) ? versions.filter(Boolean) : [];
      if (!user || !company?.id) throw new Error('Aucune societe active detectee.');
      if (queue.length === 0) return { total: 0, imported: [], failed: [] };

      setImportingOutboundQueue(true);
      setOutboundImportProgress({ current: 0, total: queue.length, currentLabel: '' });
      const imported = [];
      const failed = [];

      try {
        for (let index = 0; index < queue.length; index += 1) {
          const version = queue[index];
          const label = toText(version?.file_name) || `ged-${index + 1}`;
          setOutboundImportProgress({ current: index + 1, total: queue.length, currentLabel: label });

          try {
            const blob = await downloadGedBinaryDocument(version);
            const mime = toText(version?.mime_type) || blob?.type || detectMimeFromName(label);
            const result = await processSingleOutboundImport({
              fileBlob: blob,
              fileName: label,
              mimeType: mime,
              sourceOrigin: 'ged',
              sourceLabel: `${label}${version?.id ? `#${version.id}` : ''}`,
            });
            imported.push(result);
          } catch (error) {
            failed.push({ fileName: label, message: error?.message || String(error) });
          }
        }
      } finally {
        setImportingOutboundQueue(false);
        setOutboundImportProgress({ current: 0, total: 0, currentLabel: '' });
        refreshAll();
      }

      return { total: queue.length, imported, failed };
    },
    [company?.id, downloadGedBinaryDocument, processSingleOutboundImport, refreshAll, user]
  );

  const importAndSendExternalUbl = useCallback(
    async ({ ublXml, sourceOrigin, sourceLabel }) => {
      if (!user) return null;
      const { data, error } = await supabase.functions.invoke('peppol-import-and-send', {
        body: {
          company_id: company?.id || null,
          ubl_xml: ublXml,
          source_origin: sourceOrigin || 'external',
          source_label: sourceLabel || 'external-ubl',
        },
      });
      if (error) throw error;
      return data;
    },
    [company?.id, user]
  );

  // ─── Outbound management (cancel/delete) ───
  const manageOutbound = useCallback(
    async (action, payload = {}) => {
      if (!user) return null;
      setManagingOutbound(true);
      try {
        const { data, error } = await supabase.functions.invoke('peppol-outbound-manage', {
          body: {
            action,
            company_id: company?.id || null,
            ...payload,
          },
        });
        if (error) throw error;
        return data;
      } catch (err) {
        const details = await readFunctionErrorData(err);
        throw details || err;
      } finally {
        setManagingOutbound(false);
      }
    },
    [company?.id, user]
  );

  const cancelOutboundNetwork = useCallback(
    async (invoiceId) => manageOutbound('cancel_network', { invoice_id: invoiceId }),
    [manageOutbound]
  );

  const deleteOutboundLocal = useCallback(
    async (invoiceId) => manageOutbound('delete_local', { invoice_id: invoiceId }),
    [manageOutbound]
  );

  const deleteOutboundInvoiceDb = useCallback(
    async (invoiceId) => manageOutbound('delete_invoice_db', { invoice_id: invoiceId }),
    [manageOutbound]
  );

  const purgeAllPeppolInvoices = useCallback(async () => manageOutbound('purge_peppol_db'), [manageOutbound]);

  const setOutboundDisputeStatus = useCallback(
    async (invoiceId, { open, note = null } = {}) => {
      if (!user || !company?.id || !invoiceId) return null;
      const payload = open
        ? {
            dispute_status: 'open',
            disputed_at: new Date().toISOString(),
            dispute_note: note || 'Litige Peppol',
          }
        : {
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          };

      const { data, error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', invoiceId)
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    [company?.id, user]
  );

  const setInboundDisputeStatus = useCallback(
    async (supplierInvoiceId, { open, note = null } = {}) => {
      if (!user || !company?.id || !supplierInvoiceId) return null;
      const payload = open
        ? {
            dispute_status: 'open',
            disputed_at: new Date().toISOString(),
            dispute_note: note || 'Litige Peppol entrant',
          }
        : {
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          };

      const { data, error } = await supabase
        .from('supplier_invoices')
        .update(payload)
        .eq('id', supplierInvoiceId)
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    [company?.id, user]
  );

  const updateInboundOperationalStatus = useCallback(
    async (documentId, nextStatus) => {
      if (!user || !company?.id || !documentId) return null;
      const normalized = String(nextStatus || '').toLowerCase();
      const statusMap = {
        a_traiter: 'new',
        en_revue: 'processed',
        archivee: 'archived',
        new: 'new',
        processed: 'processed',
        archived: 'archived',
      };
      const targetStatus = statusMap[normalized];
      if (!targetStatus) {
        throw new Error('Statut operationnel entrant invalide.');
      }

      const { data, error } = await supabase
        .from('peppol_inbound_documents')
        .update({ status: targetStatus })
        .eq('id', documentId)
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .select('id, status')
        .single();
      if (error) throw error;
      return data;
    },
    [company?.id, user]
  );

  const updateOutboundBusinessStatus = useCallback(
    async (invoiceId, nextStatus) => {
      if (!user || !company?.id || !invoiceId) return null;
      const invoice = (invoices || []).find((row) => row.id === invoiceId);
      if (!invoice) throw new Error('Facture introuvable.');

      const normalized = String(nextStatus || '').toLowerCase();
      if (normalized === 'litige') {
        return await setOutboundDisputeStatus(invoiceId, { open: true });
      }

      if (normalized === 'paye') {
        const total = Number(invoice.total_ttc || 0);
        const balanceDue = Math.max(0, Number(invoice.balance_due || 0));
        const amountToSettle = balanceDue > 0 ? balanceDue : total;

        if (amountToSettle > 0) {
          const paymentPayload = withCompanyScope({
            user_id: user.id,
            client_id: invoice.client_id || null,
            invoice_id: invoice.id,
            payment_date: new Date().toISOString().slice(0, 10),
            amount: amountToSettle,
            payment_method: 'bank_transfer',
            reference: `PEPPOL-${invoice.invoice_number || invoice.id}`,
            notes: 'Reglement depuis vue Peppol',
            is_lump_sum: false,
          });
          const { error: paymentError } = await supabase.from('payments').insert(paymentPayload);
          if (paymentError) throw paymentError;
        }

        const { data, error } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            payment_status: 'paid',
            balance_due: 0,
            amount_paid: Number(invoice.total_ttc || invoice.amount_paid || 0),
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          })
          .eq('id', invoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      const baseUpdate = {
        dispute_status: 'none',
        disputed_at: null,
        dispute_note: null,
      };

      if (normalized === 'echue') {
        const { data, error } = await supabase
          .from('invoices')
          .update({
            ...baseUpdate,
            status: 'overdue',
          })
          .eq('id', invoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      if (normalized === 'envoye' || normalized === 'non_paye') {
        const { data, error } = await supabase
          .from('invoices')
          .update({
            ...baseUpdate,
            status: 'sent',
            payment_status: normalized === 'non_paye' ? 'unpaid' : String(invoice.payment_status || 'unpaid'),
          })
          .eq('id', invoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      throw new Error('Statut metier sortant invalide.');
    },
    [company?.id, invoices, setOutboundDisputeStatus, user, withCompanyScope]
  );

  const updateInboundBusinessStatus = useCallback(
    async (supplierInvoiceId, nextStatus) => {
      if (!user || !company?.id || !supplierInvoiceId) return null;
      const normalized = String(nextStatus || '').toLowerCase();
      if (normalized === 'litige') {
        return await setInboundDisputeStatus(supplierInvoiceId, { open: true });
      }

      if (normalized === 'paye') {
        const { data, error } = await supabase
          .from('supplier_invoices')
          .update({
            payment_status: 'paid',
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          })
          .eq('id', supplierInvoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      if (normalized === 'echue') {
        const { data, error } = await supabase
          .from('supplier_invoices')
          .update({
            payment_status: 'overdue',
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          })
          .eq('id', supplierInvoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      if (normalized === 'non_paye') {
        const { data, error } = await supabase
          .from('supplier_invoices')
          .update({
            payment_status: 'pending',
            dispute_status: 'none',
            disputed_at: null,
            dispute_note: null,
          })
          .eq('id', supplierInvoiceId)
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }

      throw new Error('Statut metier entrant invalide.');
    },
    [company?.id, setInboundDisputeStatus, user]
  );

  return {
    // Outbound invoices
    invoices,
    loadingInvoices,
    fetchOutboundInvoices,

    // Inbound documents
    inboundDocuments,
    loadingInbound,
    fetchInboundDocuments,
    inboundSupplierInvoices,
    loadingInboundSupplierInvoices,
    fetchInboundSupplierInvoices,

    // All logs (journal)
    allLogs,
    loadingLogs,
    fetchAllLogs,

    // AP info
    apInfo,
    loadingApInfo,
    fetchApInfo,

    // Invoice items
    fetchInvoiceItems,

    // Sync inbound
    syncingInbound,
    syncInbound,
    fetchInboundUbl,
    fetchInboundPdf,
    warmInboundDocuments,
    sendInboundToGed,
    listGedXmlDocuments,
    listGedScannableDocuments,
    downloadGedXmlDocument,
    downloadGedBinaryDocument,
    importAndSendExternalUbl,
    importDiskFilesToOutboundQueue,
    importGedDocumentsToOutboundQueue,
    importingOutboundQueue,
    outboundImportProgress,
    managingOutbound,
    cancelOutboundNetwork,
    deleteOutboundLocal,
    deleteOutboundInvoiceDb,
    purgeAllPeppolInvoices,
    setOutboundDisputeStatus,
    setInboundDisputeStatus,
    updateOutboundBusinessStatus,
    updateInboundBusinessStatus,
    updateInboundOperationalStatus,

    // Convenience
    refreshAll,
  };
}
