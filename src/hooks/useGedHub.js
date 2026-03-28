import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { setStoredActiveCompanyId } from '@/utils/activeCompanyStorage';
import {
  buildGedDocumentVersionIndex,
  buildGedVersionStoragePath,
  computeBlobSha256Hex,
  enrichDocumentsWithGedVersionInfo,
} from '@/services/gedVersioning';
import {
  computeRetentionUntilFromDays,
  enrichGedDocumentsWithRetentionInfo,
  normalizeGedRetentionPolicyPayload,
  resolveGedRetentionPolicy,
} from '@/services/gedRetentionPolicies';
import {
  enrichGedDocumentsWithWorkflowInfo,
  normalizeGedWorkflowComment,
  normalizeGedWorkflowPayload,
} from '@/services/gedWorkflow';
import {
  exportCreditNotePDF,
  exportDeliveryNotePDF,
  exportInvoicePDF,
  exportPurchaseOrderPDF,
  exportQuotePDF,
} from '@/services/exportDocuments';
import { exportSupplierInvoicePDF } from '@/services/exportSupplierRecords';
import { extractInvoiceData } from '@/services/invoiceExtractionService';
import { linkLineItemsToProducts } from '@/services/supplierInvoiceLineItemLinking';

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
const normalizeCompanyId = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const ACCOUNTING_SOURCE_TABLES = new Set(['invoices', 'supplier_invoices']);
const SCANNABLE_ACCOUNTING_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const GED_VERSION_TABLE = 'document_hub_versions';
const sanitizeFileName = (value) =>
  String(value || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
const addDays = (dateString, days) => {
  const value = new Date(`${dateString}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const formatSequenceDate = (value) => value.replace(/-/g, '');
const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
const normalizeIsoDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isValidIsoDate(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};
const toFiniteNumberOrNull = (value) => {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
};
const toFiniteNumberOrDefault = (value, fallback = 0) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Number(numeric.toFixed(2));
  return Number(fallback || 0);
};
const generateDocumentNumber = (sourceTable, dateString) => {
  const stamp = formatSequenceDate(dateString);
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  if (sourceTable === 'invoices') return `INV-${stamp}-${seq}`;
  if (sourceTable === 'quotes') return `QT-${stamp}-${seq}`;
  if (sourceTable === 'credit_notes') return `AV-${stamp}-${seq}`;
  if (sourceTable === 'delivery_notes') return `BL-${stamp}-${seq}`;
  if (sourceTable === 'purchase_orders') return `PO-${stamp}-${seq}`;
  if (sourceTable === 'supplier_invoices') return `SUP-${stamp}-${seq}`;
  return `DOC-${stamp}-${seq}`;
};

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

export const useGedHub = (options = {}) => {
  const { disableAutoFetch = false } = options;
  const { toast } = useToast();
  const { activeCompanyId } = useCompanyScope();
  const { activeCompany } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const effectiveCompanyId = activeCompany?.id || activeCompanyId;
  const scopeRecoveryAttemptsRef = useRef(new Set());

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(null);
  const [mutating, setMutating] = useState(false);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(false);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [retentionPoliciesLoading, setRetentionPoliciesLoading] = useState(false);
  const [workflowRows, setWorkflowRows] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  const applyEffectiveCompanyScope = useCallback(
    (query, options = {}) => {
      const { column = 'company_id', includeUnassigned = false } = options;
      if (!effectiveCompanyId) return query;
      if (includeUnassigned) {
        return query.or(`${column}.is.null,${column}.eq.${effectiveCompanyId}`);
      }
      return query.eq(column, effectiveCompanyId);
    },
    [effectiveCompanyId]
  );

  const detectReadableCompanyId = useCallback(async () => {
    const probeTables = [
      'invoices',
      'quotes',
      'supplier_invoices',
      'purchase_orders',
      'credit_notes',
      'delivery_notes',
    ];
    for (const table of probeTables) {
      const { data, error } = await supabase.from(table).select('company_id').not('company_id', 'is', null).limit(1);
      if (error) continue;
      const companyId = data?.[0]?.company_id;
      if (companyId) {
        return companyId;
      }
    }

    return null;
  }, []);

  const fetchCounterparties = useCallback(async () => {
    if (!effectiveCompanyId) {
      setClients([]);
      setSuppliers([]);
      return;
    }

    setCounterpartiesLoading(true);
    try {
      let clientsQuery = supabase.from('clients').select('id, company_name').order('company_name', { ascending: true });
      clientsQuery = applyEffectiveCompanyScope(clientsQuery);

      let suppliersQuery = supabase
        .from('suppliers')
        .select('id, company_name')
        .order('company_name', { ascending: true });
      suppliersQuery = applyEffectiveCompanyScope(suppliersQuery);

      const [{ data: clientsRows, error: clientsError }, { data: suppliersRows, error: suppliersError }] =
        await Promise.all([clientsQuery, suppliersQuery]);

      if (clientsError) throw clientsError;
      if (suppliersError) throw suppliersError;

      setClients(clientsRows || []);
      setSuppliers(suppliersRows || []);
    } catch (error) {
      console.error('GED HUB counterparties fetch error', error);
      toast({
        title: 'Erreur GED HUB',
        description: error?.message || 'Impossible de charger les tiers.',
        variant: 'destructive',
      });
    } finally {
      setCounterpartiesLoading(false);
    }
  }, [applyEffectiveCompanyScope, effectiveCompanyId, toast]);

  const fetchDocuments = useCallback(async () => {
    if (!effectiveCompanyId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    try {
      let invoicesQuery = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      invoicesQuery = applyEffectiveCompanyScope(invoicesQuery);

      let quotesQuery = supabase.from('quotes').select('*').order('created_at', { ascending: false });
      quotesQuery = applyEffectiveCompanyScope(quotesQuery);

      let creditNotesQuery = supabase.from('credit_notes').select('*').order('created_at', { ascending: false });
      creditNotesQuery = applyEffectiveCompanyScope(creditNotesQuery);

      let deliveryNotesQuery = supabase.from('delivery_notes').select('*').order('created_at', { ascending: false });
      deliveryNotesQuery = applyEffectiveCompanyScope(deliveryNotesQuery);

      let purchaseOrdersQuery = supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
      purchaseOrdersQuery = applyEffectiveCompanyScope(purchaseOrdersQuery, { includeUnassigned: true });

      let supplierInvoicesQuery = supabase
        .from('supplier_invoices')
        .select('*')
        .order('created_at', { ascending: false });
      supplierInvoicesQuery = applyEffectiveCompanyScope(supplierInvoicesQuery);

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
      metadataQuery = applyEffectiveCompanyScope(metadataQuery);
      const metadataResult = await metadataQuery;
      if (metadataResult.error?.code === 'PGRST205') {
        metadataRows = [];
      } else {
        metadataRows = metadataResult.data || [];
        metadataError = metadataResult.error || null;
      }

      setRetentionPoliciesLoading(true);
      let retentionPolicyRows = [];
      let retentionPolicyError = null;
      try {
        let retentionPolicyQuery = supabase.from('document_hub_retention_policies').select('*');
        retentionPolicyQuery = applyEffectiveCompanyScope(retentionPolicyQuery);
        const retentionPolicyResult = await retentionPolicyQuery;
        if (retentionPolicyResult.error?.code === 'PGRST205') {
          retentionPolicyRows = [];
        } else {
          retentionPolicyRows = retentionPolicyResult.data || [];
          retentionPolicyError = retentionPolicyResult.error || null;
        }
      } finally {
        setRetentionPoliciesLoading(false);
      }

      setWorkflowLoading(true);
      let workflowRowsData = [];
      let workflowError = null;
      try {
        let workflowQuery = supabase.from('document_hub_workflows').select('*');
        workflowQuery = applyEffectiveCompanyScope(workflowQuery);
        const workflowResult = await workflowQuery;
        if (workflowResult.error?.code === 'PGRST205') {
          workflowRowsData = [];
        } else {
          workflowRowsData = workflowResult.data || [];
          workflowError = workflowResult.error || null;
        }
      } finally {
        setWorkflowLoading(false);
      }

      let versionRows = [];
      let versionError = null;
      let versionQuery = supabase.from(GED_VERSION_TABLE).select('*').order('version', { ascending: false });
      versionQuery = applyEffectiveCompanyScope(versionQuery);
      const versionResult = await versionQuery;
      if (versionResult.error?.code === 'PGRST205') {
        versionRows = [];
      } else {
        versionRows = versionResult.data || [];
        versionError = versionResult.error || null;
      }

      const firstError =
        invoicesError ||
        quotesError ||
        creditNotesError ||
        deliveryNotesError ||
        purchaseOrdersError ||
        supplierInvoicesError ||
        metadataError ||
        retentionPolicyError ||
        workflowError ||
        versionError;

      if (firstError) {
        throw firstError;
      }

      const hasScopedRows =
        (invoices?.length || 0) +
          (quotes?.length || 0) +
          (creditNotes?.length || 0) +
          (deliveryNotes?.length || 0) +
          (purchaseOrders?.length || 0) +
          (supplierInvoices?.length || 0) >
        0;

      const normalizedEffectiveCompanyId = normalizeCompanyId(effectiveCompanyId);
      if (!hasScopedRows && normalizedEffectiveCompanyId) {
        const attemptedForCurrentScope = scopeRecoveryAttemptsRef.current.has(normalizedEffectiveCompanyId);
        if (!attemptedForCurrentScope) {
          scopeRecoveryAttemptsRef.current.add(normalizedEffectiveCompanyId);
          const detectedCompanyId = await detectReadableCompanyId();
          if (detectedCompanyId && normalizeCompanyId(detectedCompanyId) !== normalizedEffectiveCompanyId) {
            setStoredActiveCompanyId(detectedCompanyId);
            return;
          }
        }
      }

      const metadataMap = new Map(
        (metadataRows || []).map((row) => [makeMetadataKey(row.source_table, row.source_id), row])
      );
      const retentionPolicyIndex = Array.isArray(retentionPolicyRows) ? retentionPolicyRows : [];
      const workflowIndex = Array.isArray(workflowRowsData) ? workflowRowsData : [];
      const versionIndex = buildGedDocumentVersionIndex(versionRows || []);

      const unified = [
        ...mapRowsToDocuments('invoices', invoices),
        ...mapRowsToDocuments('quotes', quotes),
        ...mapRowsToDocuments('credit_notes', creditNotes),
        ...mapRowsToDocuments('delivery_notes', deliveryNotes),
        ...mapRowsToDocuments('purchase_orders', purchaseOrders),
        ...mapRowsToDocuments('supplier_invoices', supplierInvoices),
      ].map((doc) => {
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
      });

      const retentionBackfillPayload = unified
        .map((doc) => {
          if (doc.retentionUntil) {
            return null;
          }

          const retentionPolicy = resolveGedRetentionPolicy(retentionPolicyIndex, {
            sourceTable: doc.sourceTable,
            docCategory: doc.docCategory,
          });
          const automaticRetentionUntil = computeRetentionUntilFromDays(
            doc.createdAt || doc.raw?.created_at || new Date().toISOString(),
            retentionPolicy?.retention_days
          );

          if (!automaticRetentionUntil) {
            return null;
          }

          return {
            company_id: doc.raw?.company_id || effectiveCompanyId,
            source_table: doc.sourceTable,
            source_id: doc.sourceId,
            doc_category: doc.docCategory || 'general',
            retention_until: automaticRetentionUntil,
          };
        })
        .filter(Boolean);

      if (retentionBackfillPayload.length > 0) {
        const { error: retentionBackfillError } = await supabase
          .from('document_hub_metadata')
          .upsert(retentionBackfillPayload, {
            onConflict: 'company_id,source_table,source_id',
          });
        if (retentionBackfillError && retentionBackfillError.code !== 'PGRST205') {
          throw retentionBackfillError;
        }
      }

      const unifiedWithVersions = enrichGedDocumentsWithWorkflowInfo(
        enrichGedDocumentsWithRetentionInfo(
          enrichDocumentsWithGedVersionInfo(unified, versionIndex),
          retentionPolicyIndex
        ),
        workflowIndex
      ).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setDocuments(unifiedWithVersions);
      setRetentionPolicies(retentionPolicyRows || []);
      setWorkflowRows(workflowRowsData || []);
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
  }, [effectiveCompanyId, applyEffectiveCompanyScope, detectReadableCompanyId, toast]);

  const createDocumentDraft = async (payload = {}, options = {}) => {
    const { skipRefresh = false } = options;
    const sourceTable = payload.sourceTable;
    const companyId = effectiveCompanyId;

    if (!sourceTable || !SOURCE_CONFIG[sourceTable]) {
      throw new Error('Type de document invalide.');
    }
    if (!companyId) {
      throw new Error('Aucune societe active detectee.');
    }

    if (sourceTable === 'supplier_invoices' && !payload.supplierId) {
      throw new Error('Veuillez selectionner un fournisseur.');
    }
    if (sourceTable !== 'supplier_invoices' && !payload.clientId) {
      throw new Error('Veuillez selectionner un client.');
    }

    setMutating(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.id) throw new Error('Session utilisateur introuvable.');

      const baseDate = payload.date || new Date().toISOString().slice(0, 10);
      const dueDate = payload.dueDate || addDays(baseDate, 30);
      const amount = Number(payload.amount);
      const safeAmount = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
      const currency = String(
        payload.currency || activeCompany?.accounting_currency || activeCompany?.currency || 'EUR'
      ).toUpperCase();
      const number = payload.number || generateDocumentNumber(sourceTable, baseDate);

      let insertPayload = {};
      if (sourceTable === 'invoices') {
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          client_id: payload.clientId,
          invoice_number: number,
          status: 'draft',
          payment_status: 'unpaid',
          date: baseDate,
          due_date: dueDate,
          total_ht: safeAmount,
          total_ttc: safeAmount,
          tax_rate: 0,
          amount_paid: 0,
          balance_due: safeAmount,
          currency,
          notes: payload.notes || null,
          file_url: null,
        };
      } else if (sourceTable === 'quotes') {
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          client_id: payload.clientId,
          quote_number: number,
          status: 'draft',
          date: baseDate,
          total_ht: safeAmount,
          total_ttc: safeAmount,
          tax_rate: 0,
          currency,
          notes: payload.notes || null,
          file_url: null,
        };
      } else if (sourceTable === 'credit_notes') {
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          client_id: payload.clientId,
          credit_note_number: number,
          status: 'draft',
          date: baseDate,
          total_ht: safeAmount,
          total_ttc: safeAmount,
          notes: payload.notes || null,
          file_url: null,
        };
      } else if (sourceTable === 'delivery_notes') {
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          client_id: payload.clientId,
          delivery_note_number: number,
          status: 'draft',
          date: baseDate,
          notes: payload.notes || null,
          file_url: null,
        };
      } else if (sourceTable === 'purchase_orders') {
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          client_id: payload.clientId,
          po_number: number,
          status: 'draft',
          date: baseDate,
          due_date: dueDate,
          total: safeAmount,
          notes: payload.notes || null,
          file_url: null,
        };
      } else if (sourceTable === 'supplier_invoices') {
        const safeVatRate = 0;
        const safeVatAmount = 0;
        insertPayload = {
          user_id: user.id,
          company_id: companyId,
          supplier_id: payload.supplierId,
          invoice_number: number,
          invoice_date: baseDate,
          due_date: dueDate,
          total_ht: safeAmount,
          vat_rate: safeVatRate,
          vat_amount: safeVatAmount,
          total_amount: safeAmount,
          total_ttc: safeAmount,
          payment_status: 'pending',
          approval_status: 'pending',
          notes: payload.notes || null,
          file_url: null,
        };
      }

      const { data: createdRecord, error: createError } = await supabase
        .from(sourceTable)
        .insert(insertPayload)
        .select('*')
        .single();

      if (createError) throw createError;

      if (!skipRefresh) {
        await fetchDocuments();
      }

      return createdRecord;
    } finally {
      setMutating(false);
    }
  };

  const persistDocumentFileUrl = useCallback(async (document, companyId, storagePath) => {
    let { error: updateError } = await supabase
      .from(document.sourceTable)
      .update({
        file_url: storagePath,
        file_generated_at: new Date().toISOString(),
      })
      .eq('id', document.sourceId)
      .eq('company_id', companyId);

    if (updateError && String(updateError?.message || '').includes('file_generated_at')) {
      const retry = await supabase
        .from(document.sourceTable)
        .update({ file_url: storagePath })
        .eq('id', document.sourceId)
        .eq('company_id', companyId);
      updateError = retry.error;
    }

    if (updateError) {
      throw updateError;
    }
  }, []);

  const extractAccountingPayload = useCallback(async ({ file, userId, accessToken, sourceTable, storagePath }) => {
    if (!SCANNABLE_ACCOUNTING_MIME_TYPES.has(file.type)) {
      throw new Error(
        'Pour les documents comptables, utilisez un fichier PDF ou image (jpg, png, webp) afin de declencher le scan IA et la journalisation automatique.'
      );
    }

    let extractionPath = storagePath;
    if (sourceTable !== 'supplier_invoices') {
      const extension =
        String(file.name || '')
          .split('.')
          .pop() || 'pdf';
      const fileName = sanitizeFileName(`${Date.now()}-scan-${extension}`);
      extractionPath = `${userId}/ged-hub-extract/${fileName}`;
      const { error: extractionUploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(extractionPath, file, {
          upsert: true,
          contentType: file.type || undefined,
        });
      if (extractionUploadError) throw extractionUploadError;
    }

    const extracted = await extractInvoiceData({
      filePath: extractionPath,
      fileType: file.type,
      userId,
      accessToken,
    });
    if (!extracted) {
      throw new Error('Extraction IA impossible sur ce document comptable.');
    }
    return extracted;
  }, []);

  const applySupplierInvoiceExtraction = useCallback(
    async ({ document, companyId, extracted }) => {
      const { data: currentInvoice, error: currentInvoiceError } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('id', document.sourceId)
        .eq('company_id', companyId)
        .single();
      if (currentInvoiceError) throw currentInvoiceError;

      const invoiceDate =
        normalizeIsoDate(extracted?.invoice_date) ||
        currentInvoice.invoice_date ||
        new Date().toISOString().slice(0, 10);
      const dueDate = normalizeIsoDate(extracted?.due_date) || currentInvoice.due_date || addDays(invoiceDate, 30);
      const totalHT = toFiniteNumberOrDefault(extracted?.total_ht, currentInvoice.total_ht);
      const vatAmount = toFiniteNumberOrDefault(
        extracted?.total_tva ?? extracted?.vat_amount,
        currentInvoice.vat_amount
      );
      let totalTTC = toFiniteNumberOrNull(extracted?.total_ttc ?? extracted?.total_amount);
      if (totalTTC == null || totalTTC <= 0) {
        totalTTC = Number((totalHT + vatAmount).toFixed(2));
      }
      const vatRate = toFiniteNumberOrNull(extracted?.tva_rate ?? extracted?.vat_rate);
      const extractedNumber = String(extracted?.invoice_number || '').trim();
      const nextStatus =
        !currentInvoice.status || currentInvoice.status === 'draft' || currentInvoice.status === 'pending'
          ? 'received'
          : currentInvoice.status;

      const updatePayload = {
        invoice_number: extractedNumber || currentInvoice.invoice_number,
        invoice_date: invoiceDate,
        due_date: dueDate,
        total_ht: totalHT,
        vat_amount: vatAmount,
        vat_rate: vatRate ?? currentInvoice.vat_rate ?? 0,
        total_amount: totalTTC,
        total_ttc: totalTTC,
        supplier_name_extracted: extracted?.supplier_name || currentInvoice.supplier_name_extracted || null,
        supplier_address_extracted: extracted?.supplier_address || currentInvoice.supplier_address_extracted || null,
        supplier_vat_number: extracted?.supplier_vat_number || currentInvoice.supplier_vat_number || null,
        payment_terms: extracted?.payment_terms || currentInvoice.payment_terms || null,
        iban: extracted?.iban || currentInvoice.iban || null,
        bic: extracted?.bic || currentInvoice.bic || null,
        ai_extracted: true,
        ai_confidence: toFiniteNumberOrNull(extracted?.confidence),
        ai_raw_response: extracted,
        ai_extracted_at: new Date().toISOString(),
        status: nextStatus,
        payment_status: currentInvoice.payment_status || 'pending',
        approval_status: currentInvoice.approval_status || 'pending',
      };

      const { error: updateError } = await supabase
        .from('supplier_invoices')
        .update(updatePayload)
        .eq('id', document.sourceId)
        .eq('company_id', companyId);
      if (updateError) throw updateError;

      const lineItems = Array.isArray(extracted?.line_items) ? extracted.line_items : [];
      if (lineItems.length === 0) return;

      const { count: existingLineItemsCount, error: existingLineItemsError } = await supabase
        .from('supplier_invoice_line_items')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', document.sourceId);
      if (existingLineItemsError) throw existingLineItemsError;
      if ((existingLineItemsCount || 0) > 0) return;

      let mappedLineItems = lineItems;
      if (currentInvoice.supplier_id) {
        let productsQuery = supabase
          .from('products')
          .select('id, product_name, sku, supplier_id, is_active')
          .eq('supplier_id', currentInvoice.supplier_id)
          .eq('is_active', true);
        productsQuery = applyEffectiveCompanyScope(productsQuery);
        const { data: supplierProducts, error: supplierProductsError } = await productsQuery;
        if (supplierProductsError) throw supplierProductsError;
        mappedLineItems = linkLineItemsToProducts(mappedLineItems, supplierProducts || []);
      }

      const insertLineItems = mappedLineItems.map((item, index) => ({
        invoice_id: document.sourceId,
        description: String(item?.description || '').trim(),
        quantity: toFiniteNumberOrDefault(item?.quantity, 1),
        unit_price: toFiniteNumberOrDefault(item?.unit_price, 0),
        total: toFiniteNumberOrDefault(item?.total, 0),
        vat_rate: toFiniteNumberOrNull(item?.vat_rate),
        user_product_id: item?.user_product_id || null,
        sort_order: index,
      }));

      const { error: lineItemsInsertError } = await supabase
        .from('supplier_invoice_line_items')
        .insert(insertLineItems);
      if (lineItemsInsertError) throw lineItemsInsertError;
    },
    [applyEffectiveCompanyScope]
  );

  const applySalesInvoiceExtraction = useCallback(async ({ document, companyId, extracted }) => {
    const { data: currentInvoice, error: currentInvoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', document.sourceId)
      .eq('company_id', companyId)
      .single();
    if (currentInvoiceError) throw currentInvoiceError;

    const invoiceDate =
      normalizeIsoDate(extracted?.invoice_date) || currentInvoice.date || new Date().toISOString().slice(0, 10);
    const dueDate = normalizeIsoDate(extracted?.due_date) || currentInvoice.due_date || addDays(invoiceDate, 30);
    const totalHT = toFiniteNumberOrDefault(extracted?.total_ht, currentInvoice.total_ht);
    const vatAmount = toFiniteNumberOrNull(extracted?.total_tva);
    let totalTTC = toFiniteNumberOrNull(extracted?.total_ttc);
    if (totalTTC == null || totalTTC <= 0) {
      const fallbackVat = vatAmount ?? Math.max(0, toFiniteNumberOrDefault(currentInvoice.total_ttc, 0) - totalHT);
      totalTTC = Number((totalHT + fallbackVat).toFixed(2));
    }
    const taxAmount = vatAmount ?? Number(Math.max(0, totalTTC - totalHT).toFixed(2));
    const taxRate = toFiniteNumberOrNull(extracted?.tva_rate ?? extracted?.vat_rate) ?? currentInvoice.tax_rate ?? 0;
    const extractedNumber = String(extracted?.invoice_number || '').trim();
    const nextStatus = !currentInvoice.status || currentInvoice.status === 'draft' ? 'sent' : currentInvoice.status;

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        invoice_number: extractedNumber || currentInvoice.invoice_number,
        date: invoiceDate,
        due_date: dueDate,
        total_ht: totalHT,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_ttc: totalTTC,
        balance_due: currentInvoice.payment_status === 'paid' ? 0 : totalTTC,
        status: nextStatus,
        payment_status: currentInvoice.payment_status || 'unpaid',
      })
      .eq('id', document.sourceId)
      .eq('company_id', companyId);
    if (updateError) throw updateError;

    const lineItems = Array.isArray(extracted?.line_items) ? extracted.line_items : [];
    if (lineItems.length === 0) return;

    const { count: existingLineItemsCount, error: existingLineItemsError } = await supabase
      .from('invoice_items')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', document.sourceId);
    if (existingLineItemsError) throw existingLineItemsError;
    if ((existingLineItemsCount || 0) > 0) return;

    const invoiceLineItems = lineItems.map((item) => ({
      invoice_id: document.sourceId,
      description: String(item?.description || '').trim(),
      quantity: toFiniteNumberOrDefault(item?.quantity, 1),
      unit_price: toFiniteNumberOrDefault(item?.unit_price, 0),
      total: toFiniteNumberOrDefault(item?.total, 0),
      item_type: 'manual',
    }));

    const { error: lineItemsInsertError } = await supabase.from('invoice_items').insert(invoiceLineItems);
    if (lineItemsInsertError) throw lineItemsInsertError;
  }, []);

  const processAccountingDocumentUpload = useCallback(
    async ({ document, file, companyId, storagePath, userId, accessToken }) => {
      if (!ACCOUNTING_SOURCE_TABLES.has(document.sourceTable)) return null;
      const extracted = await extractAccountingPayload({
        file,
        userId,
        accessToken,
        sourceTable: document.sourceTable,
        storagePath,
      });

      if (document.sourceTable === 'supplier_invoices') {
        await applySupplierInvoiceExtraction({ document, companyId, extracted });
      } else if (document.sourceTable === 'invoices') {
        await applySalesInvoiceExtraction({ document, companyId, extracted });
      }

      return extracted;
    },
    [applySalesInvoiceExtraction, applySupplierInvoiceExtraction, extractAccountingPayload]
  );

  const uploadDocumentFile = async (document, file, options = {}) => {
    const { skipRefresh = false } = options;
    if (!document?.sourceTable || !document?.sourceId) {
      throw new Error('Document invalide pour le televersement.');
    }
    if (!file) {
      throw new Error('Aucun fichier selectionne.');
    }

    const bucket = SOURCE_CONFIG[document.sourceTable]?.bucket;
    if (!bucket) {
      throw new Error('Bucket de stockage introuvable pour ce type de document.');
    }

    const companyId = document?.raw?.company_id || effectiveCompanyId;
    if (!companyId) {
      throw new Error('Aucune societe active detectee.');
    }

    setMutating(true);
    let uploadedPath = null;
    try {
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionResult?.session?.user?.id;
      const accessToken = sessionResult?.session?.access_token || null;
      if (!userId) {
        throw new Error('Session utilisateur introuvable.');
      }

      const extension =
        String(file.name || '')
          .split('.')
          .pop() || 'pdf';
      const baseName = sanitizeFileName(String(file.name || `document.${extension}`));
      const contentHash = await computeBlobSha256Hex(file);

      const resolveCurrentDocumentHash = async (bucketName, fileUrl) => {
        if (!fileUrl) return null;
        try {
          let binaryData = null;
          if (/^https?:\/\//i.test(String(fileUrl))) {
            const response = await fetch(fileUrl);
            if (!response.ok) return null;
            binaryData = await response.blob();
          } else {
            const { data, error } = await supabase.storage.from(bucketName).download(fileUrl);
            if (error || !data) return null;
            binaryData = data;
          }

          return await computeBlobSha256Hex(binaryData);
        } catch (compareError) {
          console.warn('GED HUB version compare skipped', compareError);
          return null;
        }
      };

      let versioningAvailable = true;
      let latestVersion = null;
      const { data: latestVersionResult, error: latestVersionError } = await supabase
        .from(GED_VERSION_TABLE)
        .select('*')
        .eq('company_id', companyId)
        .eq('source_table', document.sourceTable)
        .eq('source_id', document.sourceId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersionError) {
        if (latestVersionError.code === 'PGRST205') {
          versioningAvailable = false;
        } else {
          throw latestVersionError;
        }
      } else {
        latestVersion = latestVersionResult || null;
      }

      if (latestVersion?.content_hash && latestVersion.content_hash === contentHash) {
        return {
          duplicated: true,
          version: Number(latestVersion.version) || 1,
          contentHash,
          storagePath: latestVersion.storage_path || latestVersion.file_url || document.fileUrl || null,
          latestVersion,
        };
      }

      if (!latestVersion && document.fileUrl) {
        const currentHash = await resolveCurrentDocumentHash(bucket, document.fileUrl);
        if (currentHash && currentHash === contentHash) {
          return {
            duplicated: true,
            version: Number(document.currentVersion) || 1,
            contentHash,
            storagePath: document.fileUrl,
            latestVersion: null,
          };
        }
      }

      const nextVersion = Math.max(Number(latestVersion?.version) || Number(document.currentVersion) || 0, 0) + 1;
      const storagePath = buildGedVersionStoragePath({
        userId,
        sourceTable: document.sourceTable,
        sourceId: document.sourceId,
        version: nextVersion,
        contentHash,
        fileName: baseName,
      });

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadError) throw uploadError;
      uploadedPath = storagePath;

      const extractionResult = await processAccountingDocumentUpload({
        document,
        file,
        companyId,
        storagePath,
        userId,
        accessToken,
      });

      const versionPayload = {
        company_id: companyId,
        source_table: document.sourceTable,
        source_id: document.sourceId,
        version: nextVersion,
        content_hash: contentHash,
        file_name: baseName,
        file_size: file.size ?? null,
        mime_type: file.type || null,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_url: storagePath,
        created_by: userId,
      };

      if (versioningAvailable) {
        const { error: versionInsertError } = await supabase.from(GED_VERSION_TABLE).insert(versionPayload);
        if (versionInsertError) {
          if (versionInsertError.code === 'PGRST205') {
            versioningAvailable = false;
          } else {
            throw versionInsertError;
          }
        }
      }

      await persistDocumentFileUrl(document, companyId, storagePath);

      if (!skipRefresh) {
        await fetchDocuments();
      }

      return {
        storagePath,
        accountingExtraction: extractionResult,
        duplicated: false,
        version: nextVersion,
        contentHash,
        versionRow: versionPayload,
      };
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from(bucket)
          .remove([uploadedPath])
          .catch(() => {});
      }
      throw error;
    } finally {
      setMutating(false);
    }
  };

  const createAndUploadDocument = async (payload = {}, file) => {
    const createdRecord = await createDocumentDraft(payload, { skipRefresh: true });
    const createdDocument = {
      ...mapRowsToDocuments(payload.sourceTable, [createdRecord])[0],
      raw: createdRecord,
    };
    await uploadDocumentFile(createdDocument, file, { skipRefresh: true });
    await fetchDocuments();
    return createdRecord;
  };

  const upsertMetadata = async (document, patch) => {
    const resolvedCompanyId = document?.raw?.company_id || document?.company_id || effectiveCompanyId;
    if (!resolvedCompanyId) {
      throw new Error('Aucune societe active detectee pour la mise a jour des metadonnees.');
    }

    const resolvedDocCategory = patch.doc_category ?? document.docCategory ?? 'general';
    const retentionPolicy = resolveGedRetentionPolicy(retentionPolicies, {
      sourceTable: document.sourceTable,
      docCategory: resolvedDocCategory,
    });
    const patchHasRetention = Object.prototype.hasOwnProperty.call(patch, 'retention_until');
    const explicitRetention = patchHasRetention ? String(patch.retention_until || '').trim() || null : undefined;
    const automaticRetentionUntil = computeRetentionUntilFromDays(
      document.createdAt || document.raw?.created_at || new Date().toISOString(),
      retentionPolicy?.retention_days
    );
    const resolvedRetentionUntil =
      explicitRetention ??
      (patchHasRetention ? automaticRetentionUntil : document.retentionUntil || automaticRetentionUntil || null);

    const payload = {
      company_id: resolvedCompanyId,
      source_table: document.sourceTable,
      source_id: document.sourceId,
      doc_category: resolvedDocCategory,
      confidentiality_level: patch.confidentiality_level ?? document.confidentialityLevel ?? 'internal',
      tags: Array.isArray(patch.tags) ? patch.tags : document.tags || [],
      retention_until: resolvedRetentionUntil,
      is_starred: patch.is_starred ?? document.isStarred ?? false,
      notes: patch.notes ?? document.notes ?? null,
    };

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

  const saveRetentionPolicy = async (payload = {}) => {
    const resolvedCompanyId = effectiveCompanyId;
    if (!resolvedCompanyId) {
      throw new Error('Aucune societe active detectee pour les politiques de retention.');
    }

    const normalizedPayload = normalizeGedRetentionPolicyPayload(payload);
    const record = {
      company_id: resolvedCompanyId,
      ...normalizedPayload,
      updated_by: (await supabase.auth.getUser()).data?.user?.id || null,
    };

    const { data, error } = await supabase.from('document_hub_retention_policies').upsert(record, {
      onConflict: 'company_id,source_table,doc_category',
    });

    if (error) {
      throw error;
    }

    await fetchDocuments();
    return data;
  };

  const refreshRetentionPolicies = async () => {
    await fetchDocuments();
  };

  const persistWorkflowState = async ({ document, workflowStatus, comment }) => {
    const resolvedCompanyId = effectiveCompanyId;
    if (!resolvedCompanyId) {
      throw new Error('Aucune societe active detectee pour le workflow GED.');
    }

    const normalizedPayload = normalizeGedWorkflowPayload({
      sourceTable: document?.sourceTable,
      sourceId: document?.sourceId,
      workflowStatus,
      comment,
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;

    const now = new Date().toISOString();
    const cleanedComment = normalizeGedWorkflowComment(comment) || document?.workflowComment || null;
    const basePayload = {
      company_id: resolvedCompanyId,
      ...normalizedPayload,
      comment: cleanedComment,
      updated_by: user?.id || null,
    };

    let payload = { ...basePayload };
    if (normalizedPayload.workflow_status === 'pending_review') {
      payload = {
        ...payload,
        requested_by: user?.id || null,
        requested_at: now,
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        signed_by: null,
        signed_at: null,
      };
    } else if (normalizedPayload.workflow_status === 'approved') {
      payload = {
        ...payload,
        requested_by: document?.workflowRequestedBy || user?.id || null,
        requested_at: document?.workflowRequestedAt || now,
        approved_by: user?.id || null,
        approved_at: now,
        rejected_by: null,
        rejected_at: null,
        signed_by: null,
        signed_at: null,
      };
    } else if (normalizedPayload.workflow_status === 'rejected') {
      payload = {
        ...payload,
        requested_by: document?.workflowRequestedBy || user?.id || null,
        requested_at: document?.workflowRequestedAt || now,
        approved_by: null,
        approved_at: null,
        rejected_by: user?.id || null,
        rejected_at: now,
        signed_by: null,
        signed_at: null,
      };
    } else if (normalizedPayload.workflow_status === 'signed') {
      payload = {
        ...payload,
        requested_by: document?.workflowRequestedBy || user?.id || null,
        requested_at: document?.workflowRequestedAt || now,
        approved_by: document?.workflowApprovedBy || user?.id || null,
        approved_at: document?.workflowApprovedAt || now,
        rejected_by: null,
        rejected_at: null,
        signed_by: user?.id || null,
        signed_at: now,
      };
    }

    const { data, error } = await supabase.from('document_hub_workflows').upsert(payload, {
      onConflict: 'company_id,source_table,source_id',
    });

    if (error?.code === 'PGRST205') {
      toast({
        title: 'Workflow GED indisponible',
        description: 'La table document_hub_workflows nest pas encore deployee sur cet environnement.',
        variant: 'destructive',
      });
      return null;
    }

    if (error) {
      throw error;
    }

    await fetchDocuments();
    return data;
  };

  const requestDocumentWorkflow = async (document, payload = {}) =>
    persistWorkflowState({
      document,
      workflowStatus: 'pending_review',
      comment: payload.comment,
    });

  const approveDocumentWorkflow = async (document, payload = {}) =>
    persistWorkflowState({
      document,
      workflowStatus: 'approved',
      comment: payload.comment,
    });

  const rejectDocumentWorkflow = async (document, payload = {}) =>
    persistWorkflowState({
      document,
      workflowStatus: 'rejected',
      comment: payload.comment,
    });

  const signDocumentWorkflow = async (document, payload = {}) =>
    persistWorkflowState({
      document,
      workflowStatus: 'signed',
      comment: payload.comment,
    });

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
    if (disableAutoFetch) return undefined;
    void fetchDocuments();
    return undefined;
  }, [disableAutoFetch, fetchDocuments]);

  useEffect(() => {
    if (disableAutoFetch) return undefined;
    void fetchCounterparties();
    return undefined;
  }, [disableAutoFetch, fetchCounterparties]);

  return {
    documents,
    loading,
    generatingKey,
    mutating,
    clients,
    suppliers,
    counterpartiesLoading,
    fetchDocuments,
    createDocumentDraft,
    createAndUploadDocument,
    uploadDocumentFile,
    upsertMetadata,
    retentionPolicies,
    retentionPoliciesLoading,
    saveRetentionPolicy,
    refreshRetentionPolicies,
    workflowRows,
    workflowLoading,
    requestDocumentWorkflow,
    approveDocumentWorkflow,
    rejectDocumentWorkflow,
    signDocumentWorkflow,
    getDocumentAccessUrl,
    generatePdf,
    sourceConfig: SOURCE_CONFIG,
  };
};
