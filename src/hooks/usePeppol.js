import { useState, useCallback } from 'react';
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
  const { applyCompanyScope } = useCompanyScope();

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
        .eq('status', 'sent')
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

  const fetchInboundUbl = useCallback(
    async (documentId) => {
      if (!documentId) return null;
      const data = await invokeInboundAction('get_ubl', { document_id: documentId });
      return data?.ubl || null;
    },
    [invokeInboundAction]
  );

  const fetchInboundPdf = useCallback(
    async (documentId) => {
      if (!documentId) return null;
      const { data, error } = await supabase.functions.invoke('peppol-inbound', {
        body: {
          action: 'get_pdf',
          company_id: company?.id || null,
          document_id: documentId,
        },
      });
      if (error) throw error;

      if (data instanceof Blob) return data;
      if (data instanceof ArrayBuffer) return new Blob([data], { type: 'application/pdf' });
      return new Blob([data], { type: 'application/pdf' });
    },
    [company?.id]
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
          const ublXml = await fetchInboundUbl(doc.scrada_document_id);
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
    async (action, invoiceId) => {
      if (!user) return null;
      setManagingOutbound(true);
      try {
        const { data, error } = await supabase.functions.invoke('peppol-outbound-manage', {
          body: {
            action,
            invoice_id: invoiceId,
            company_id: company?.id || null,
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
    async (invoiceId) => manageOutbound('cancel_network', invoiceId),
    [manageOutbound]
  );

  const deleteOutboundLocal = useCallback(
    async (invoiceId) => manageOutbound('delete_local', invoiceId),
    [manageOutbound]
  );

  // ─── Refresh all data ───
  const refreshAll = useCallback(() => {
    fetchOutboundInvoices();
    fetchInboundDocuments();
    fetchAllLogs();
  }, [fetchAllLogs, fetchInboundDocuments, fetchOutboundInvoices]);

  return {
    // Outbound invoices
    invoices,
    loadingInvoices,
    fetchOutboundInvoices,

    // Inbound documents
    inboundDocuments,
    loadingInbound,
    fetchInboundDocuments,

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
    sendInboundToGed,
    listGedXmlDocuments,
    downloadGedXmlDocument,
    importAndSendExternalUbl,
    managingOutbound,
    cancelOutboundNetwork,
    deleteOutboundLocal,

    // Convenience
    refreshAll,
  };
}
