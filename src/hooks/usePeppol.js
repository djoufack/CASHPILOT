import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';

const toText = (value) => String(value ?? '').trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
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
          client:clients!fk_invoices_client_scope(id, company_name, contact_name, peppol_endpoint_id, peppol_scheme_id, electronic_invoicing_enabled)
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
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !anonKey) {
          throw new Error('Configuration Supabase manquante.');
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/peppol-inbound`, {
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

      let query = supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .ilike('company_name', baseName)
        .limit(1);
      query = applyCompanyScope(query);

      const { data: existingSupplier, error: lookupError } = await query.maybeSingle();
      if (lookupError) throw lookupError;
      if (existingSupplier) return existingSupplier;

      const { data: createdSupplier, error: createError } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          company_id: company.id,
          company_name: baseName,
          contact_person: doc?.sender_name || null,
          notes: doc?.sender_peppol_id ? `Peppol sender: ${doc.sender_peppol_id}` : null,
          status: 'active',
          supplier_type: 'service',
        })
        .select('id, company_name')
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
          tags: ['peppol', 'scrada', 'inbound'],
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

  // ─── Refresh all data ───
  const refreshAll = useCallback(() => {
    fetchOutboundInvoices();
    fetchInboundDocuments();
    fetchInboundSupplierInvoices();
    fetchAllLogs();
  }, [fetchAllLogs, fetchInboundDocuments, fetchInboundSupplierInvoices, fetchOutboundInvoices]);

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
    downloadGedXmlDocument,
    importAndSendExternalUbl,
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
