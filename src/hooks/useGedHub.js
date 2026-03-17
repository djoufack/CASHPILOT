import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import {
  exportCreditNotePDF,
  exportDeliveryNotePDF,
  exportInvoicePDF,
  exportPurchaseOrderPDF,
  exportQuotePDF,
} from '@/services/exportDocuments';
import { exportSupplierInvoicePDF } from '@/services/exportSupplierRecords';

const SOURCE_CONFIG = {
  invoices: {
    label: 'Facture',
    modulePath: '/app/invoices',
    bucket: 'invoices',
  },
  quotes: {
    label: 'Devis',
    modulePath: '/app/quotes',
    bucket: 'quotes',
  },
  credit_notes: {
    label: 'Avoir',
    modulePath: '/app/credit-notes',
    bucket: 'credit-notes',
  },
  delivery_notes: {
    label: 'Bon de livraison',
    modulePath: '/app/delivery-notes',
    bucket: 'delivery-notes',
  },
  purchase_orders: {
    label: 'Bon de commande',
    modulePath: '/app/purchase-orders',
    bucket: 'purchase-orders',
  },
  supplier_invoices: {
    label: 'Facture fournisseur',
    modulePath: '/app/supplier-invoices',
    bucket: 'supplier-invoices',
  },
};

const makeMetadataKey = (sourceTable, sourceId) => `${sourceTable}:${sourceId}`;

const mapRowsToDocuments = (sourceTable, rows) =>
  (rows || []).map((row) => {
    const config = SOURCE_CONFIG[sourceTable];
    const number =
      row.invoice_number ||
      row.quote_number ||
      row.credit_note_number ||
      row.delivery_note_number ||
      row.order_number ||
      row.po_number ||
      row.purchase_order_number ||
      row.reference ||
      row.number ||
      'N/A';
    const status = row.status || row.payment_status || row.approval_status || row.state || 'draft';
    const amount =
      row.total_ttc ??
      row.total_amount ??
      row.total ??
      row.total_ht ??
      row.amount_ttc ??
      row.amount_total ??
      row.amount_ht ??
      null;
    const counterpartyName =
      row.client?.company_name || row.supplier?.company_name || row.client_name || row.supplier_name || null;

    return {
      sourceTable,
      sourceId: row.id,
      modulePath: config.modulePath,
      sourceLabel: config.label,
      bucket: config.bucket,
      number,
      status,
      amount,
      currency: row.currency || row.currency_code || 'EUR',
      fileUrl: row.file_url || null,
      fileGeneratedAt: row.file_generated_at || null,
      counterpartyName,
      createdAt: row.created_at || row.date || row.issue_date || row.invoice_date || null,
      updatedAt: row.updated_at || row.modified_at || null,
      raw: row,
    };
  });

export const useGedHub = () => {
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope, activeCompanyId } = useCompanyScope();
  const { activeCompany } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!activeCompanyId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    try {
      let invoicesQuery = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      invoicesQuery = applyCompanyScope(invoicesQuery);

      let quotesQuery = supabase.from('quotes').select('*').order('created_at', { ascending: false });
      quotesQuery = applyCompanyScope(quotesQuery);

      let creditNotesQuery = supabase.from('credit_notes').select('*').order('created_at', { ascending: false });
      creditNotesQuery = applyCompanyScope(creditNotesQuery);

      let deliveryNotesQuery = supabase.from('delivery_notes').select('*').order('created_at', { ascending: false });
      deliveryNotesQuery = applyCompanyScope(deliveryNotesQuery);

      let purchaseOrdersQuery = supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
      purchaseOrdersQuery = applyCompanyScope(purchaseOrdersQuery, { includeUnassigned: true });

      let supplierInvoicesQuery = supabase
        .from('supplier_invoices')
        .select('*')
        .order('created_at', { ascending: false });
      supplierInvoicesQuery = applyCompanyScope(supplierInvoicesQuery);

      const [
        { data: invoices, error: invoicesError },
        { data: quotes, error: quotesError },
        { data: creditNotes, error: creditNotesError },
        { data: deliveryNotes, error: deliveryNotesError },
        { data: purchaseOrders, error: purchaseOrdersError },
        { data: supplierInvoices, error: supplierInvoicesError },
      ] = await Promise.all([
        invoicesQuery,
        quotesQuery,
        creditNotesQuery,
        deliveryNotesQuery,
        purchaseOrdersQuery,
        supplierInvoicesQuery,
      ]);

      let metadataRows = [];
      let metadataError = null;
      let metadataQuery = supabase.from('document_hub_metadata').select('*');
      metadataQuery = applyCompanyScope(metadataQuery);
      const metadataResult = await metadataQuery;
      if (metadataResult.error?.code === 'PGRST205') {
        metadataRows = [];
      } else {
        metadataRows = metadataResult.data || [];
        metadataError = metadataResult.error || null;
      }

      const firstError =
        invoicesError ||
        quotesError ||
        creditNotesError ||
        deliveryNotesError ||
        purchaseOrdersError ||
        supplierInvoicesError ||
        metadataError;

      if (firstError) {
        throw firstError;
      }

      const metadataMap = new Map(
        (metadataRows || []).map((row) => [makeMetadataKey(row.source_table, row.source_id), row])
      );

      const unified = [
        ...mapRowsToDocuments('invoices', invoices),
        ...mapRowsToDocuments('quotes', quotes),
        ...mapRowsToDocuments('credit_notes', creditNotes),
        ...mapRowsToDocuments('delivery_notes', deliveryNotes),
        ...mapRowsToDocuments('purchase_orders', purchaseOrders),
        ...mapRowsToDocuments('supplier_invoices', supplierInvoices),
      ]
        .map((doc) => {
          const metadata = metadataMap.get(makeMetadataKey(doc.sourceTable, doc.sourceId));
          return {
            ...doc,
            metadata: metadata || null,
            tags: metadata?.tags || [],
            docCategory: metadata?.doc_category || 'general',
            confidentialityLevel: metadata?.confidentiality_level || 'internal',
            retentionUntil: metadata?.retention_until || null,
            isStarred: metadata?.is_starred || false,
            notes: metadata?.notes || '',
          };
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setDocuments(unified);
    } catch (error) {
      console.error('GED HUB fetch error', error);
      toast({
        title: 'Erreur GED HUB',
        description: error?.message || 'Impossible de charger les documents federes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, toast]);

  const upsertMetadata = async (document, patch) => {
    const payload = withCompanyScope({
      source_table: document.sourceTable,
      source_id: document.sourceId,
      doc_category: patch.doc_category ?? document.docCategory ?? 'general',
      confidentiality_level: patch.confidentiality_level ?? document.confidentialityLevel ?? 'internal',
      tags: Array.isArray(patch.tags) ? patch.tags : document.tags || [],
      retention_until: patch.retention_until ?? document.retentionUntil ?? null,
      is_starred: patch.is_starred ?? document.isStarred ?? false,
      notes: patch.notes ?? document.notes ?? null,
    });

    const { error } = await supabase.from('document_hub_metadata').upsert(payload, {
      onConflict: 'company_id,source_table,source_id',
    });

    if (error?.code === 'PGRST205') {
      toast({
        title: 'Metadonnees indisponibles',
        description: 'La table document_hub_metadata nest pas encore deployee sur cet environnement.',
        variant: 'destructive',
      });
      return;
    }

    if (error) {
      throw error;
    }

    await fetchDocuments();
  };

  const getDocumentAccessUrl = async (document) => {
    if (!document.fileUrl) return null;
    if (document.fileUrl.startsWith('http')) {
      return document.fileUrl;
    }

    const bucket = SOURCE_CONFIG[document.sourceTable]?.bucket;
    if (!bucket) return null;

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(document.fileUrl, 3600);
    if (error) {
      throw error;
    }

    return data?.signedUrl || null;
  };

  const fetchSingleDocumentForExport = async (document) => {
    if (document.sourceTable === 'invoices') {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(*), items:invoice_items(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: null };
    }

    if (document.sourceTable === 'quotes') {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, client:clients(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: null };
    }

    if (document.sourceTable === 'credit_notes') {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*, client:clients(*), items:credit_note_items(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: null };
    }

    if (document.sourceTable === 'delivery_notes') {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select('*, client:clients(*), items:delivery_note_items(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: null };
    }

    if (document.sourceTable === 'purchase_orders') {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, client:clients(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: null };
    }

    if (document.sourceTable === 'supplier_invoices') {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*, supplier:suppliers(*)')
        .eq('id', document.sourceId)
        .single();
      if (error) throw error;
      return { record: data, supplier: data?.supplier || null };
    }

    throw new Error('Type de document non supporte.');
  };

  const generatePdf = async (document) => {
    const docKey = makeMetadataKey(document.sourceTable, document.sourceId);
    setGeneratingKey(docKey);
    try {
      const { record, supplier } = await fetchSingleDocumentForExport(document);

      if (document.sourceTable === 'invoices') {
        await exportInvoicePDF(record, activeCompany, invoiceSettings);
      } else if (document.sourceTable === 'quotes') {
        await exportQuotePDF(record, activeCompany);
      } else if (document.sourceTable === 'credit_notes') {
        await exportCreditNotePDF(record, activeCompany);
      } else if (document.sourceTable === 'delivery_notes') {
        await exportDeliveryNotePDF(record, activeCompany);
      } else if (document.sourceTable === 'purchase_orders') {
        await exportPurchaseOrderPDF(record, activeCompany);
      } else if (document.sourceTable === 'supplier_invoices') {
        await exportSupplierInvoicePDF(record, supplier, activeCompany, invoiceSettings);
      } else {
        throw new Error('Type de document non supporte.');
      }

      toast({
        title: 'Generation lancee',
        description: 'Le document a ete genere depuis le GED HUB.',
      });

      setTimeout(() => {
        void fetchDocuments();
      }, 1200);
    } catch (error) {
      console.error('GED HUB generate error', error);
      toast({
        title: 'Erreur generation',
        description: error?.message || 'Generation impossible.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    generatingKey,
    fetchDocuments,
    upsertMetadata,
    getDocumentAccessUrl,
    generatePdf,
  };
};
