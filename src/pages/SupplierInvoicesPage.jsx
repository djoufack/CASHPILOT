import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { formatDate } from '@/utils/dateLocale';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useCreditsGuard } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import UploadInvoiceModal from '@/components/UploadInvoiceModal';
import RejectApprovalDialog from '@/components/suppliers/RejectApprovalDialog';
import ApprovalHistoryDialog from '@/components/suppliers/ApprovalHistoryDialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/calculations';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { linkLineItemsToProducts } from '@/services/supplierInvoiceLineItemLinking';
import { buildCanonicalOperationsSnapshot } from '@/shared/canonicalOperationsSnapshot';
import { getApprovalWorkflowSummary } from '@/services/supplierApprovalWorkflow';
import { getThreeWayMatchPresentation, normalizeThreeWayMatchStatus } from '@/services/supplierThreeWayMatch';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { notifyPendingSupplierApproval } from '@/services/supplierApprovalNotifications';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Sparkles,
  Upload,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Receipt,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

const SupplierInvoicesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { company } = useCompany();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const { modalProps } = useCreditsGuard();
  const { toast } = useToast();

  // Data state
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [threeWayMatches, setThreeWayMatches] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [matchFilter, setMatchFilter] = useState('all');

  // Upload flow state
  const [isSupplierSelectOpen, setIsSupplierSelectOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Delete confirmation state
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [rejectTargetInvoice, setRejectTargetInvoice] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [historyInvoice, setHistoryInvoice] = useState(null);
  const [runningMatchInvoiceId, setRunningMatchInvoiceId] = useState(null);

  // Pagination
  const pagination = usePagination({ pageSize: 25 });

  const currency = resolveAccountingCurrency(company);

  // ---------- DATA FETCHING ----------

  const fetchAllInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('supplier_invoices')
        .select(
          `
          *,
          supplier:suppliers!supplier_invoices_supplier_id_fkey(id, company_name),
          approval_steps:supplier_invoice_approval_steps(id, level, required_role, status, approver_id, decided_at, comment)
        `
        )
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      toast({
        title: t('supplierInvoices.errorLoading', 'Erreur de chargement'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user, toast, t]);

  const fetchSuppliers = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase.from('suppliers').select('id, company_name').order('company_name');

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  }, [applyCompanyScope, user]);

  const fetchSupplierOrders = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('supplier_orders')
        .select(
          'id, supplier_id, order_number, order_status, total_amount, order_date, expected_delivery_date, actual_delivery_date'
        )
        .order('created_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) throw error;
      setSupplierOrders(data || []);
    } catch (err) {
      console.error('Error fetching supplier orders:', err);
    }
  }, [applyCompanyScope, user]);

  const fetchThreeWayMatches = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('supplier_invoice_three_way_matches')
        .select(
          'supplier_invoice_id, supplier_order_id, match_status, match_score, amount_variance, quantity_variance, received_total_amount, invoiced_total_amount, updated_at'
        )
        .order('updated_at', { ascending: false });

      query = applyCompanyScope(query);

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01') {
          setThreeWayMatches({});
          return;
        }
        throw error;
      }

      const byInvoice = {};
      for (const row of data || []) {
        byInvoice[row.supplier_invoice_id] = row;
      }
      setThreeWayMatches(byInvoice);
    } catch (err) {
      console.error('Error fetching supplier invoice 3-way matches:', err);
    }
  }, [applyCompanyScope, user]);

  useEffect(() => {
    if (user) {
      fetchAllInvoices();
      fetchSuppliers();
      fetchSupplierOrders();
      fetchThreeWayMatches();
    }
  }, [user, fetchAllInvoices, fetchSuppliers, fetchSupplierOrders, fetchThreeWayMatches]);

  // ---------- FILTERING ----------

  const filteredInvoices = invoices.filter((inv) => {
    const term = debouncedSearchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      (inv.invoice_number || '').toLowerCase().includes(term) ||
      (inv.supplier?.company_name || '').toLowerCase().includes(term) ||
      (inv.supplier_name_extracted || '').toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;

    const matchesSupplier = supplierFilter === 'all' || inv.supplier_id === supplierFilter;

    const currentApproval = inv.approval_status || 'pending';
    const matchesApproval = approvalFilter === 'all' || currentApproval === approvalFilter;

    const currentMatchStatus = normalizeThreeWayMatchStatus(
      threeWayMatches[inv.id]?.match_status || inv.three_way_match_status
    );
    const matchesThreeWay = matchFilter === 'all' || currentMatchStatus === matchFilter;

    return matchesSearch && matchesStatus && matchesSupplier && matchesApproval && matchesThreeWay;
  });

  // Pagination sync
  useEffect(() => {
    pagination.setTotalCount(filteredInvoices.length);
  }, [filteredInvoices.length, pagination]);

  const paginatedInvoices = filteredInvoices.slice(pagination.from, pagination.to + 1);

  useEffect(() => {
    setSelectedInvoiceIds((prev) => prev.filter((id) => filteredInvoices.some((invoice) => invoice.id === id)));
  }, [filteredInvoices]);

  const selectedIdSet = useMemo(() => new Set(selectedInvoiceIds), [selectedInvoiceIds]);
  const allPageSelected =
    paginatedInvoices.length > 0 && paginatedInvoices.every((invoice) => selectedIdSet.has(invoice.id));

  const toggleInvoiceSelection = useCallback((invoiceId, checked) => {
    setSelectedInvoiceIds((prev) => {
      const exists = prev.includes(invoiceId);
      if (checked && !exists) return [...prev, invoiceId];
      if (!checked && exists) return prev.filter((id) => id !== invoiceId);
      return prev;
    });
  }, []);

  const toggleSelectAllPage = useCallback(
    (checked) => {
      setSelectedInvoiceIds((prev) => {
        if (!checked) {
          return prev.filter((id) => !paginatedInvoices.some((invoice) => invoice.id === id));
        }

        const next = new Set(prev);
        for (const invoice of paginatedInvoices) {
          next.add(invoice.id);
        }
        return Array.from(next);
      });
    },
    [paginatedInvoices]
  );

  // ---------- KPI CALCULATIONS ----------

  const supplierInvoiceMetrics = useMemo(
    () => buildCanonicalOperationsSnapshot({ supplierInvoices: filteredInvoices }).suppliers.supplierInvoices,
    [filteredInvoices]
  );

  const totalCount = supplierInvoiceMetrics.totalCount;
  const totalAmount = supplierInvoiceMetrics.totalAmount;
  const pendingCount = supplierInvoiceMetrics.pendingCount;
  const pendingAmount = supplierInvoiceMetrics.pendingAmount;
  const overdueCount = supplierInvoiceMetrics.overdueCount;
  const overdueAmount = supplierInvoiceMetrics.overdueAmount;
  const paidCount = supplierInvoiceMetrics.paidCount;
  const approvalPendingCount = filteredInvoices.filter(
    (invoice) => (invoice.approval_status || 'pending') === 'pending'
  ).length;
  const approvedCount = filteredInvoices.filter(
    (invoice) => (invoice.approval_status || 'pending') === 'approved'
  ).length;
  const threeWayMatchedCount = filteredInvoices.filter((invoice) => {
    const status = normalizeThreeWayMatchStatus(
      threeWayMatches[invoice.id]?.match_status || invoice.three_way_match_status
    );
    return status === 'matched';
  }).length;

  // ---------- ACTIONS ----------

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({ payment_status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;

      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, payment_status: newStatus } : inv)));
      toast({
        title: t('supplierInvoices.statusUpdated', 'Statut mis a jour'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const runThreeWayMatch = useCallback(
    async (invoiceId, supplierOrderId = null, successMessage = null) => {
      setRunningMatchInvoiceId(invoiceId);
      try {
        const { error } = await supabase.rpc('supplier_invoice_run_three_way_match', {
          p_invoice_id: invoiceId,
          p_supplier_order_id: supplierOrderId,
        });

        if (error) throw error;

        await Promise.all([fetchAllInvoices(), fetchThreeWayMatches()]);
        toast({
          title: t('supplierInvoices.threeWayMatchUpdated', '3-way match mis a jour'),
          description: successMessage || null,
          className: 'bg-green-600 border-none text-white',
        });
      } catch (err) {
        toast({
          title: t('common.error', 'Erreur'),
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setRunningMatchInvoiceId(null);
      }
    },
    [fetchAllInvoices, fetchThreeWayMatches, t, toast]
  );

  const handleSupplierOrderLinkChange = async (invoiceId, nextValue) => {
    const nextSupplierOrderId = nextValue === 'auto' ? null : nextValue;

    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({ supplier_order_id: nextSupplierOrderId })
        .eq('id', invoiceId);

      if (error) throw error;

      await runThreeWayMatch(
        invoiceId,
        nextSupplierOrderId,
        t('supplierInvoices.threeWayOrderLinked', 'Commande liée et match recalculé.')
      );
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const notifyPendingApproval = useCallback(async (invoiceId, actionLabel) => {
    try {
      await notifyPendingSupplierApproval({
        invoiceId,
        action: actionLabel,
      });
    } catch (notifyError) {
      console.error('supplier approval notification failed', notifyError);
    }
  }, []);

  const handleAdvanceApproval = async (invoiceId) => {
    try {
      const { error } = await supabase.rpc('supplier_invoice_approve_step', {
        p_invoice_id: invoiceId,
      });
      if (error) throw error;

      await fetchAllInvoices();
      toast({
        title: t('supplierInvoices.approvalUpdated', 'Approbation mise a jour'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleRejectApproval = async (invoiceId, rejectedReasonValue = null) => {
    try {
      const { error } = await supabase.rpc('supplier_invoice_reject_step', {
        p_invoice_id: invoiceId,
        p_reason: rejectedReasonValue || null,
      });
      if (error) throw error;

      await fetchAllInvoices();
      toast({
        title: t('supplierInvoices.approvalUpdated', 'Approbation mise a jour'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleResetApproval = async (invoiceId, notifyAction = null) => {
    try {
      const { error } = await supabase.rpc('supplier_invoice_reset_approval_workflow', {
        p_invoice_id: invoiceId,
      });
      if (error) throw error;

      if (notifyAction) {
        await notifyPendingApproval(invoiceId, notifyAction);
      }
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleBulkApproval = async (approvalStatus) => {
    if (selectedInvoiceIds.length === 0) {
      toast({
        title: t('supplierInvoices.bulk.noSelection', 'Aucune facture sélectionnée'),
        variant: 'destructive',
      });
      return;
    }
    try {
      const tasks = selectedInvoiceIds.map((id) => {
        if (approvalStatus === 'approved') {
          return supabase.rpc('supplier_invoice_approve_step', { p_invoice_id: id });
        }
        return supabase.rpc('supplier_invoice_reset_approval_workflow', { p_invoice_id: id });
      });

      const results = await Promise.allSettled(tasks);
      const failed =
        results.filter((result) => result.status === 'fulfilled' && result.value?.error).length +
        results.filter((result) => result.status === 'rejected').length;

      if (approvalStatus === 'pending') {
        await Promise.allSettled(selectedInvoiceIds.map((id) => notifyPendingApproval(id, 'pending_bulk')));
      }

      await fetchAllInvoices();

      toast({
        title: t('supplierInvoices.bulk.updated', 'Mise à jour groupée effectuée'),
        description: t('supplierInvoices.bulk.updatedDesc', '{{count}} facture(s) mises à jour.', {
          count: selectedInvoiceIds.length - failed,
        }),
        className: 'bg-green-600 border-none text-white',
      });
      setSelectedInvoiceIds([]);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleApprovalSelect = (invoice, nextStatus) => {
    if (nextStatus === 'approved') {
      handleAdvanceApproval(invoice.id);
      return;
    }

    if (nextStatus === 'rejected') {
      setRejectTargetInvoice(invoice);
      setRejectReason(invoice?.rejected_reason || '');
      return;
    }

    handleResetApproval(invoice.id, 'pending_updated')
      .then(() => fetchAllInvoices())
      .then(() => {
        toast({
          title: t('supplierInvoices.approvalUpdated', 'Approbation mise a jour'),
          className: 'bg-green-600 border-none text-white',
        });
      })
      .catch(() => {});
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetInvoice) return;
    await handleRejectApproval(rejectTargetInvoice.id, rejectReason);
    setRejectTargetInvoice(null);
    setRejectReason('');
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await supabase.from('supplier_invoices').delete().eq('id', deleteTargetId);

      if (error) throw error;

      setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTargetId));
      toast({
        title: t('supplierInvoices.deleted', 'Facture supprimee'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleViewDocument = async (fileUrl) => {
    if (!fileUrl) return;
    try {
      if (fileUrl.startsWith('http')) {
        window.open(fileUrl, '_blank');
        return;
      }
      const { data, error } = await supabase.storage.from('supplier-invoices').createSignedUrl(fileUrl, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // ---------- UPLOAD FLOW ----------

  const handleNewInvoice = () => {
    setSelectedSupplierId('');
    setIsSupplierSelectOpen(true);
  };

  const handleSupplierSelected = () => {
    if (!selectedSupplierId) return;
    setIsSupplierSelectOpen(false);
    setIsUploadModalOpen(true);
  };

  const handleUploadSuccess = async (formData, file) => {
    try {
      let fileUrl = formData.file_url || null;

      // If a file is provided (AI extraction did not already upload it), upload now
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('supplier-invoices')
          .upload(filePath, file, { contentType: file.type });

        if (uploadError) throw uploadError;
        fileUrl = filePath;
      }

      const invoiceData = {
        supplier_id: selectedSupplierId,
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || null,
        status: formData.status || 'received',
        total_amount: parseFloat(formData.total_amount) || 0,
        vat_amount: formData.total_tva ? parseFloat(formData.total_tva) : null,
        vat_rate: parseFloat(formData.vat_rate) || 0,
        payment_status: formData.payment_status || 'pending',
        approval_status: formData.approval_status || 'pending',
        total_ht: formData.total_ht ? parseFloat(formData.total_ht) : null,
        total_ttc: formData.total_ttc ? parseFloat(formData.total_ttc) : null,
        currency: formData.currency || currency,
        supplier_name_extracted: formData.supplier_name_extracted || null,
        supplier_address_extracted: formData.supplier_address_extracted || null,
        supplier_vat_number: formData.supplier_vat_number || null,
        payment_terms: formData.payment_terms || null,
        iban: formData.iban || null,
        bic: formData.bic || null,
        ai_extracted: formData.ai_extracted || false,
        ai_confidence: formData.ai_confidence || null,
        ai_raw_response: formData.ai_raw_response || null,
        ai_extracted_at: formData.ai_extracted_at || null,
        file_url: fileUrl,
      };

      const { data: newInvoice, error } = await supabase
        .from('supplier_invoices')
        .insert([withCompanyScope(invoiceData)])
        .select(
          `
          *,
          supplier:suppliers!supplier_invoices_supplier_id_fkey(id, company_name),
          approval_steps:supplier_invoice_approval_steps(id, level, required_role, status, approver_id, decided_at, comment)
        `
        )
        .single();

      if (error) throw error;

      // Create line items if AI extraction returned them
      if (newInvoice && formData.ai_raw_response?.line_items?.length) {
        let mappedLineItems = formData.ai_raw_response.line_items;

        let productsQuery = supabase
          .from('products')
          .select('id, product_name, sku, supplier_id, is_active')
          .eq('supplier_id', selectedSupplierId)
          .eq('is_active', true);

        productsQuery = applyCompanyScope(productsQuery);

        const { data: supplierProducts, error: supplierProductsError } = await productsQuery;
        if (supplierProductsError) throw supplierProductsError;

        mappedLineItems = linkLineItemsToProducts(mappedLineItems, supplierProducts || []);

        const lineItems = mappedLineItems.map((item, index) => ({
          invoice_id: newInvoice.id,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total || 0,
          vat_rate: item.vat_rate ?? null,
          user_product_id: item.user_product_id || null,
          sort_order: index,
        }));

        await supabase.from('supplier_invoice_line_items').insert(lineItems);
      }

      setInvoices((prev) => [newInvoice, ...prev]);
      await fetchThreeWayMatches();
      if ((newInvoice.approval_status || 'pending') === 'pending') {
        notifyPendingApproval(newInvoice.id, 'pending_created');
      }

      toast({
        title: t('supplierInvoices.created', 'Facture enregistree'),
        description: t('supplierInvoices.createdDesc', 'La facture fournisseur a ete enregistree avec succes.'),
        className: 'bg-green-600 border-none text-white',
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // ---------- STATUS HELPERS ----------

  const getApprovalBadge = (approvalStatus) => {
    const config = {
      pending: {
        className: 'bg-amber-500/20 text-amber-300 border-0',
        label: t('supplierInvoices.approvalPending', "En attente d'approbation"),
      },
      approved: {
        className: 'bg-emerald-500/20 text-emerald-300 border-0',
        label: t('supplierInvoices.approvalApproved', 'Approuvee'),
      },
      rejected: {
        className: 'bg-rose-500/20 text-rose-300 border-0',
        label: t('supplierInvoices.approvalRejected', 'Rejetee'),
      },
    };

    const normalized = approvalStatus || 'pending';
    const item = config[normalized] || config.pending;
    return <Badge className={item.className}>{item.label}</Badge>;
  };

  const getThreeWayMatchBadge = (status) => {
    const { tone } = getThreeWayMatchPresentation(status);

    const toneConfig = {
      success: {
        className: 'bg-emerald-500/20 text-emerald-300 border-0',
        label: t('supplierInvoices.threeWayMatched', '3-way OK'),
      },
      danger: {
        className: 'bg-rose-500/20 text-rose-300 border-0',
        label: t('supplierInvoices.threeWayMismatch', 'Ecart'),
      },
      warning: {
        className: 'bg-amber-500/20 text-amber-300 border-0',
        label: t('supplierInvoices.threeWayPartial', 'Partiel'),
      },
      info: {
        className: 'bg-blue-500/20 text-blue-300 border-0',
        label: t('supplierInvoices.threeWayPending', 'En attente'),
      },
      muted: {
        className: 'bg-gray-500/20 text-gray-300 border-0',
        label: t('supplierInvoices.threeWayUnmatched', 'Non lie'),
      },
    };

    const config = toneConfig[tone] || toneConfig.muted;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // ---------- KPI CARDS ----------

  const kpiCards = [
    {
      label: t('supplierInvoices.totalInvoices', 'Total factures'),
      value: totalCount,
      sub: formatCurrency(totalAmount, currency),
      icon: <FileText className="w-5 h-5 text-blue-400" />,
      bg: 'bg-blue-500/10',
    },
    {
      label: t('supplierInvoices.paid', 'Payees'),
      value: paidCount,
      sub: `${approvedCount} ${t('supplierInvoices.approvalApproved', 'approuvees')}`,
      icon: <CheckCircle className="w-5 h-5 text-green-400" />,
      bg: 'bg-green-500/10',
    },
    {
      label: t('supplierInvoices.pending', 'En attente'),
      value: pendingCount,
      sub: formatCurrency(pendingAmount, currency),
      icon: <Clock className="w-5 h-5 text-yellow-400" />,
      bg: 'bg-yellow-500/10',
    },
    {
      label: t('supplierInvoices.overdue', 'En retard'),
      value: overdueCount,
      sub: formatCurrency(overdueAmount, currency),
      icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
      bg: 'bg-red-500/10',
    },
    {
      label: t('supplierInvoices.approvalPendingShort', 'Approvals en attente'),
      value: approvalPendingCount,
      sub: null,
      icon: <ShieldCheck className="w-5 h-5 text-amber-300" />,
      bg: 'bg-amber-500/10',
    },
    {
      label: t('supplierInvoices.threeWayMatchedShort', '3-way OK'),
      value: threeWayMatchedCount,
      sub: t('supplierInvoices.threeWayMatchedSub', '{{count}} rapprochement(s) complets', {
        count: threeWayMatchedCount,
      }),
      icon: <RefreshCw className="w-5 h-5 text-emerald-300" />,
      bg: 'bg-emerald-500/10',
    },
  ];

  // ---------- RENDER ----------

  return (
    <>
      <Helmet>
        <title>{t('supplierInvoices.title', 'Factures Fournisseurs')} - CashPilot</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />

      <div className="container mx-auto p-4 md:p-8 min-h-screen text-white space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Receipt className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                {t('supplierInvoices.title', 'Factures Fournisseurs')}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {t('supplierInvoices.subtitle', '{{count}} facture(s) au total', { count: invoices.length })}
              </p>
            </div>
          </div>
          <Button variant="upload3d" onClick={handleNewInvoice} className="w-full md:w-auto font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            {t('supplierInvoices.uploadInvoice', 'Televerser une facture')}
          </Button>
        </div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-6 gap-4"
        >
          {kpiCards.map((kpi, idx) => (
            <div key={idx} className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>{kpi.icon}</div>
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
              {kpi.sub && <p className="text-sm text-gray-300 mt-1 font-medium">{kpi.sub}</p>}
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder={t('supplierInvoices.searchPlaceholder', 'Rechercher par numero ou fournisseur...')}
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('supplierInvoices.filterStatus', 'Statut')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.allStatuses', 'Tous les statuts')}
                </SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.statusPending', 'En attente')}
                </SelectItem>
                <SelectItem value="paid" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.statusPaid', 'Payee')}
                </SelectItem>
                <SelectItem value="overdue" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.statusOverdue', 'En retard')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full md:w-[220px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('supplierInvoices.filterSupplier', 'Fournisseur')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.allSuppliers', 'Tous les fournisseurs')}
                </SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-white hover:bg-gray-800">
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger className="w-full md:w-[220px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('supplierInvoices.filterApproval', 'Approbation')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.allApprovals', 'Toutes les approbations')}
                </SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.approvalPending', "En attente d'approbation")}
                </SelectItem>
                <SelectItem value="approved" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.approvalApproved', 'Approuvee')}
                </SelectItem>
                <SelectItem value="rejected" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.approvalRejected', 'Rejetee')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger className="w-full md:w-[220px] bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder={t('supplierInvoices.filterThreeWay', '3-way match')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayAll', 'Tous les statuts 3-way')}
                </SelectItem>
                <SelectItem value="matched" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayMatched', '3-way OK')}
                </SelectItem>
                <SelectItem value="mismatch" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayMismatch', 'Ecart')}
                </SelectItem>
                <SelectItem value="partial" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayPartial', 'Partiel')}
                </SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayPending', 'En attente')}
                </SelectItem>
                <SelectItem value="unmatched" className="text-white hover:bg-gray-800">
                  {t('supplierInvoices.threeWayUnmatched', 'Non lie')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {selectedInvoiceIds.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f1528]/80 border border-amber-500/30 backdrop-blur rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          >
            <p className="text-sm text-amber-200">
              {t('supplierInvoices.bulk.selectedCount', '{{count}} facture(s) sélectionnée(s)', {
                count: selectedInvoiceIds.length,
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => handleBulkApproval('approved')}
              >
                {t('supplierInvoices.bulk.approve', 'Approuver la sélection')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500 text-blue-300 hover:bg-blue-500/10"
                onClick={() => handleBulkApproval('pending')}
              >
                {t('supplierInvoices.bulk.markPending', 'Marquer en attente')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-300 hover:bg-white/5"
                onClick={() => setSelectedInvoiceIds([])}
              >
                {t('supplierInvoices.bulk.clearSelection', 'Vider la sélection')}
              </Button>
            </div>
          </motion.div>
        ) : null}

        {/* Table / Empty / Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-8 md:p-12 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-800 rounded-full">
                <FileText className="w-12 h-12 text-orange-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gradient mb-2">
              {t('supplierInvoices.noInvoices', 'Aucune facture fournisseur')}
            </h3>
            <p className="text-gray-400 mb-6">
              {t(
                'supplierInvoices.noInvoicesDesc',
                'Ajoutez votre premiere facture fournisseur pour commencer le suivi.'
              )}
            </p>
            <Button onClick={handleNewInvoice} variant="upload3d" className="font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              {t('supplierInvoices.uploadInvoice', 'Televerser une facture')}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={(value) => toggleSelectAllPage(!!value)}
                        aria-label={t('supplierInvoices.bulk.selectPage', 'Sélectionner la page')}
                      />
                    </TableHead>
                    <TableHead className="text-gray-400">{t('supplierInvoices.colSupplier', 'Fournisseur')}</TableHead>
                    <TableHead className="text-gray-400">
                      {t('supplierInvoices.colInvoiceNumber', 'N deg Facture')}
                    </TableHead>
                    <TableHead className="text-gray-400">{t('supplierInvoices.colDate', 'Date')}</TableHead>
                    <TableHead className="text-gray-400">{t('supplierInvoices.colDueDate', 'Echeance')}</TableHead>
                    <TableHead className="text-gray-400 text-right">
                      {t('supplierInvoices.colAmount', 'Montant TTC')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colStatus', 'Statut')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colApproval', 'Approbation')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colThreeWayMatch', '3-way')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colSource', 'Source')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">{t('supplierInvoices.colDoc', 'Doc')}</TableHead>
                    <TableHead className="text-gray-400 text-right">{t('common.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((inv) => {
                    const amount = parseFloat(inv.total_amount) || parseFloat(inv.total_ttc) || 0;
                    const workflowSummary = getApprovalWorkflowSummary(inv.approval_steps, inv.approval_stage);
                    const threeWayMatch = threeWayMatches[inv.id] || null;
                    const threeWayStatus = normalizeThreeWayMatchStatus(
                      threeWayMatch?.match_status || inv.three_way_match_status
                    );
                    const threeWayScore = Number(threeWayMatch?.match_score ?? inv.three_way_match_score ?? 0);
                    const threeWayAmountVariance = Number(threeWayMatch?.amount_variance ?? 0);
                    const threeWayQuantityVariance = Number(threeWayMatch?.quantity_variance ?? 0);
                    const linkedSupplierOrderId = threeWayMatch?.supplier_order_id || inv.supplier_order_id || null;
                    const supplierOrderOptions = supplierOrders.filter(
                      (order) => order.supplier_id === inv.supplier_id
                    );
                    const selectedSupplierOrderValue = linkedSupplierOrderId || 'auto';

                    return (
                      <TableRow key={inv.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedIdSet.has(inv.id)}
                            onCheckedChange={(value) => toggleInvoiceSelection(inv.id, !!value)}
                            aria-label={t('supplierInvoices.bulk.selectInvoice', 'Sélectionner la facture')}
                          />
                        </TableCell>

                        {/* Supplier */}
                        <TableCell className="text-gray-300">
                          {inv.supplier?.id ? (
                            <Link
                              to={`/app/suppliers/${inv.supplier.id}`}
                              className="hover:text-orange-400 transition-colors"
                            >
                              {inv.supplier.company_name}
                            </Link>
                          ) : (
                            <span className="text-gray-500">{inv.supplier_name_extracted || '—'}</span>
                          )}
                        </TableCell>

                        {/* Invoice Number */}
                        <TableCell className="font-medium text-gradient">{inv.invoice_number || '—'}</TableCell>

                        {/* Date */}
                        <TableCell className="text-gray-400">
                          {inv.invoice_date ? formatDate(inv.invoice_date) : '—'}
                        </TableCell>

                        {/* Due Date */}
                        <TableCell className="text-gray-400">{inv.due_date ? formatDate(inv.due_date) : '—'}</TableCell>

                        {/* Amount */}
                        <TableCell className="text-right font-semibold text-white">
                          {formatCurrency(amount, inv.currency || currency)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <Select
                            value={inv.payment_status || 'pending'}
                            onValueChange={(val) => handleUpdateStatus(inv.id, val)}
                          >
                            <SelectTrigger className="h-7 w-28 bg-transparent border-gray-700 text-xs mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                              <SelectItem value="pending">
                                {t('supplierInvoices.statusPending', 'En attente')}
                              </SelectItem>
                              <SelectItem value="paid">{t('supplierInvoices.statusPaid', 'Payee')}</SelectItem>
                              <SelectItem value="overdue">
                                {t('supplierInvoices.statusOverdue', 'En retard')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Approval */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Select
                              value={inv.approval_status || 'pending'}
                              onValueChange={(value) => handleApprovalSelect(inv, value)}
                            >
                              <SelectTrigger className="h-7 w-36 bg-transparent border-gray-700 text-xs mx-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                <SelectItem value="pending">
                                  {t('supplierInvoices.approvalPending', "En attente d'approbation")}
                                </SelectItem>
                                <SelectItem value="approved">
                                  {t('supplierInvoices.approvalApproved', 'Approuvee')}
                                </SelectItem>
                                <SelectItem value="rejected">
                                  {t('supplierInvoices.approvalRejected', 'Rejetee')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-gray-400">
                              {t('supplierInvoices.approvalLevelLabel', {
                                defaultValue: 'Niveau {{current}} / {{required}}',
                                current: workflowSummary.currentLevel,
                                required: workflowSummary.requiredLevels,
                              })}
                            </p>
                            {workflowSummary.status === 'pending' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAdvanceApproval(inv.id)}
                                className="h-6 px-2 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
                                title={t('supplierInvoices.approveCurrentLevel', {
                                  defaultValue: 'Valider niveau {{level}}',
                                  level: workflowSummary.currentLevel,
                                })}
                                aria-label={t('supplierInvoices.approveCurrentLevel', {
                                  defaultValue: 'Valider niveau {{level}}',
                                  level: workflowSummary.currentLevel,
                                })}
                              >
                                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                                <span className="text-[10px] leading-none">
                                  {t('supplierInvoices.approveLevelShort', {
                                    defaultValue: 'N{{level}}',
                                    level: workflowSummary.currentLevel,
                                  })}
                                </span>
                              </Button>
                            ) : null}
                            <div className="flex items-center gap-1">
                              {getApprovalBadge(inv.approval_status || 'pending')}
                              <button
                                onClick={() => setHistoryInvoice(inv)}
                                className="p-0.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-orange-400 transition-colors"
                                title={t('supplierInvoices.approvalHistory', 'Approval history')}
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {inv.approval_status === 'rejected' && inv.rejected_reason ? (
                              <p className="text-[10px] text-rose-300 max-w-[180px] leading-tight">
                                {inv.rejected_reason}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* 3-way match */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {getThreeWayMatchBadge(threeWayStatus)}
                            <p className="text-[10px] text-gray-400">
                              {t('supplierInvoices.threeWayScore', {
                                defaultValue: 'Score {{score}}%',
                                score: Math.round(threeWayScore),
                              })}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {t('supplierInvoices.threeWayVarianceCompact', {
                                defaultValue: 'Δ {{amount}} / Qté {{quantity}}',
                                amount: formatCurrency(threeWayAmountVariance, inv.currency || currency),
                                quantity: threeWayQuantityVariance.toFixed(2),
                              })}
                            </p>
                            <Select
                              value={selectedSupplierOrderValue}
                              onValueChange={(value) => handleSupplierOrderLinkChange(inv.id, value)}
                            >
                              <SelectTrigger className="h-7 w-44 bg-transparent border-gray-700 text-xs mx-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                <SelectItem value="auto">
                                  {t('supplierInvoices.threeWayAutoOrder', 'Auto (commande la plus proche)')}
                                </SelectItem>
                                {supplierOrderOptions.map((order) => (
                                  <SelectItem key={order.id} value={order.id}>
                                    {`${order.order_number || order.id.slice(0, 8)} • ${order.order_status || 'draft'}`}
                                  </SelectItem>
                                ))}
                                {linkedSupplierOrderId &&
                                !supplierOrderOptions.some((order) => order.id === linkedSupplierOrderId) ? (
                                  <SelectItem value={linkedSupplierOrderId}>
                                    {t('supplierInvoices.threeWayLinkedOrder', {
                                      defaultValue: 'Commande liée ({{id}})',
                                      id: linkedSupplierOrderId.slice(0, 8),
                                    })}
                                  </SelectItem>
                                ) : null}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => runThreeWayMatch(inv.id, linkedSupplierOrderId)}
                              className="h-6 px-2 text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
                              title={t('supplierInvoices.runThreeWayMatch', 'Recalculer le 3-way match')}
                              disabled={runningMatchInvoiceId === inv.id}
                            >
                              {runningMatchInvoiceId === inv.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                  <span className="text-[10px] leading-none">
                                    {t('supplierInvoices.runThreeWayShort', 'Recalc.')}
                                  </span>
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>

                        {/* Source (AI badge) */}
                        <TableCell className="text-center">
                          {inv.ai_extracted ? (
                            <Badge className="bg-purple-600/20 text-purple-400 border-0 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          ) : (
                            <span className="text-gray-600 text-xs">{t('supplierInvoices.manual', 'Manuel')}</span>
                          )}
                        </TableCell>

                        {/* Document link */}
                        <TableCell className="text-center">
                          {inv.file_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-blue-400 h-7 w-7 p-0"
                              title={t('supplierInvoices.viewDocument', 'Voir le document')}
                              onClick={() => handleViewDocument(inv.file_url)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetId(inv.id)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 h-7 w-7 p-0"
                            title={t('common.delete', 'Supprimer')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-white/10">
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                onNextPage={pagination.nextPage}
                onPrevPage={pagination.prevPage}
                onGoToPage={pagination.goToPage}
                onChangePageSize={pagination.changePageSize}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Supplier Selection Dialog (Step 1 of upload flow) */}
      <Dialog open={isSupplierSelectOpen} onOpenChange={setIsSupplierSelectOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {t('supplierInvoices.selectSupplier', 'Selectionner un fournisseur')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-400">
              {t('supplierInvoices.selectSupplierDesc', 'Choisissez le fournisseur a qui appartient cette facture.')}
            </p>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder={t('supplierInvoices.chooseSupplier', 'Choisir un fournisseur...')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-white hover:bg-gray-700">
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suppliers.length === 0 && (
              <p className="text-xs text-gray-500">
                {t(
                  'supplierInvoices.noSuppliersYet',
                  "Aucun fournisseur. Ajoutez-en un d'abord dans la section Fournisseurs."
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSupplierSelectOpen(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              onClick={handleSupplierSelected}
              disabled={!selectedSupplierId}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('supplierInvoices.continue', 'Continuer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Invoice Modal (Step 2 of upload flow) */}
      <UploadInvoiceModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedSupplierId('');
        }}
        supplierId={selectedSupplierId}
        onUploadSuccess={handleUploadSuccess}
      />

      <RejectApprovalDialog
        open={!!rejectTargetInvoice}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleConfirmReject}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTargetInvoice(null);
            setRejectReason('');
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700/40 text-white shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              {t('supplierInvoices.deleteTitle', 'Supprimer la facture')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 leading-relaxed">
              {t(
                'supplierInvoices.deleteConfirm',
                'Cette action est irreversible. La facture fournisseur sera definitivement supprimee.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent">
              {t('common.cancel', 'Annuler')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApprovalHistoryDialog
        open={!!historyInvoice}
        onOpenChange={(open) => {
          if (!open) setHistoryInvoice(null);
        }}
        invoice={historyInvoice}
      />
    </>
  );
};

export default SupplierInvoicesPage;
