
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import UploadInvoiceModal from '@/components/UploadInvoiceModal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/calculations';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from 'lucide-react';

const SupplierInvoicesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { toast } = useToast();

  // Data state
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Upload flow state
  const [isSupplierSelectOpen, setIsSupplierSelectOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Delete confirmation state
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Pagination
  const pagination = usePagination({ pageSize: 25 });

  const currency = resolveAccountingCurrency(company);

  // ---------- DATA FETCHING ----------

  const fetchAllInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select(`
          *,
          supplier:suppliers(id, company_name)
        `)
        .order('created_at', { ascending: false });

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
  }, [user, toast, t]);

  const fetchSuppliers = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAllInvoices();
      fetchSuppliers();
    }
  }, [user, fetchAllInvoices, fetchSuppliers]);

  // ---------- FILTERING ----------

  const filteredInvoices = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      (inv.invoice_number || '').toLowerCase().includes(term) ||
      (inv.supplier?.company_name || '').toLowerCase().includes(term) ||
      (inv.supplier_name_extracted || '').toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'all' || inv.payment_status === statusFilter;

    const matchesSupplier =
      supplierFilter === 'all' || inv.supplier_id === supplierFilter;

    return matchesSearch && matchesStatus && matchesSupplier;
  });

  // Pagination sync
  useEffect(() => {
    pagination.setTotalCount(filteredInvoices.length);
  }, [filteredInvoices.length, pagination]);

  const paginatedInvoices = filteredInvoices.slice(
    pagination.from,
    pagination.to + 1
  );

  // ---------- KPI CALCULATIONS ----------

  const totalCount = filteredInvoices.length;
  const totalAmount = filteredInvoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total_ttc) || 0),
    0
  );

  const pendingInvoices = filteredInvoices.filter(
    (inv) => inv.payment_status === 'pending'
  );
  const pendingCount = pendingInvoices.length;
  const pendingAmount = pendingInvoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total_ttc) || 0),
    0
  );

  const overdueInvoices = filteredInvoices.filter(
    (inv) => inv.payment_status === 'overdue'
  );
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total_ttc) || 0),
    0
  );

  const paidInvoices = filteredInvoices.filter(
    (inv) => inv.payment_status === 'paid'
  );
  const paidCount = paidInvoices.length;

  // ---------- ACTIONS ----------

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({ payment_status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, payment_status: newStatus } : inv
        )
      );
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

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', deleteTargetId);

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
      const { data, error } = await supabase.storage
        .from('supplier-invoices')
        .createSignedUrl(fileUrl, 3600);

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
        total_amount: parseFloat(formData.total_amount) || 0,
        vat_amount: formData.total_tva ? parseFloat(formData.total_tva) : null,
        vat_rate: parseFloat(formData.vat_rate) || 0,
        payment_status: formData.payment_status || 'pending',
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
        .insert([invoiceData])
        .select(`
          *,
          supplier:suppliers(id, company_name)
        `)
        .single();

      if (error) throw error;

      // Create line items if AI extraction returned them
      if (newInvoice && formData.ai_raw_response?.line_items?.length) {
        const lineItems = formData.ai_raw_response.line_items.map((item, index) => ({
          invoice_id: newInvoice.id,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total || 0,
          sort_order: index,
        }));

        await supabase.from('supplier_invoice_line_items').insert(lineItems);
      }

      setInvoices((prev) => [newInvoice, ...prev]);

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

  const getStatusBadge = (status) => {
    const config = {
      pending: {
        className: 'bg-yellow-500/20 text-yellow-400 border-0',
        label: t('supplierInvoices.statusPending', 'En attente'),
      },
      paid: {
        className: 'bg-green-500/20 text-green-400 border-0',
        label: t('supplierInvoices.statusPaid', 'Payee'),
      },
      overdue: {
        className: 'bg-red-500/20 text-red-400 border-0',
        label: t('supplierInvoices.statusOverdue', 'En retard'),
      },
    };
    const c = config[status] || config.pending;
    return <Badge className={c.className}>{c.label}</Badge>;
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
      sub: null,
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
          <Button
            onClick={handleNewInvoice}
            className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('supplierInvoices.newInvoice', 'Nouvelle facture')}
          </Button>
        </div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {kpiCards.map((kpi, idx) => (
            <div
              key={idx}
              className="bg-[#0f1528]/80 border border-white/10 backdrop-blur rounded-xl p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>{kpi.icon}</div>
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
              {kpi.sub && (
                <p className="text-sm text-gray-300 mt-1 font-medium">{kpi.sub}</p>
              )}
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
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="text-white hover:bg-gray-800"
                  >
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

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
            <Button
              onClick={handleNewInvoice}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('supplierInvoices.newInvoice', 'Nouvelle facture')}
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
                    <TableHead className="text-gray-400">
                      {t('supplierInvoices.colSupplier', 'Fournisseur')}
                    </TableHead>
                    <TableHead className="text-gray-400">
                      {t('supplierInvoices.colInvoiceNumber', 'N deg Facture')}
                    </TableHead>
                    <TableHead className="text-gray-400">
                      {t('supplierInvoices.colDate', 'Date')}
                    </TableHead>
                    <TableHead className="text-gray-400">
                      {t('supplierInvoices.colDueDate', 'Echeance')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-right">
                      {t('supplierInvoices.colAmount', 'Montant TTC')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colStatus', 'Statut')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colSource', 'Source')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-center">
                      {t('supplierInvoices.colDoc', 'Doc')}
                    </TableHead>
                    <TableHead className="text-gray-400 text-right">
                      {t('common.actions', 'Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((inv) => {
                    const amount =
                      parseFloat(inv.total_amount) ||
                      parseFloat(inv.total_ttc) ||
                      0;

                    return (
                      <TableRow
                        key={inv.id}
                        className="border-white/5 hover:bg-white/5"
                      >
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
                            <span className="text-gray-500">
                              {inv.supplier_name_extracted || '—'}
                            </span>
                          )}
                        </TableCell>

                        {/* Invoice Number */}
                        <TableCell className="font-medium text-gradient">
                          {inv.invoice_number || '—'}
                        </TableCell>

                        {/* Date */}
                        <TableCell className="text-gray-400">
                          {inv.invoice_date
                            ? new Date(inv.invoice_date).toLocaleDateString('fr-FR')
                            : '—'}
                        </TableCell>

                        {/* Due Date */}
                        <TableCell className="text-gray-400">
                          {inv.due_date
                            ? new Date(inv.due_date).toLocaleDateString('fr-FR')
                            : '—'}
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right font-semibold text-white">
                          {formatCurrency(amount, inv.currency || currency)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <Select
                            value={inv.payment_status || 'pending'}
                            onValueChange={(val) =>
                              handleUpdateStatus(inv.id, val)
                            }
                          >
                            <SelectTrigger className="h-7 w-28 bg-transparent border-gray-700 text-xs mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                              <SelectItem value="pending">
                                {t('supplierInvoices.statusPending', 'En attente')}
                              </SelectItem>
                              <SelectItem value="paid">
                                {t('supplierInvoices.statusPaid', 'Payee')}
                              </SelectItem>
                              <SelectItem value="overdue">
                                {t('supplierInvoices.statusOverdue', 'En retard')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Source (AI badge) */}
                        <TableCell className="text-center">
                          {inv.ai_extracted ? (
                            <Badge className="bg-purple-600/20 text-purple-400 border-0 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          ) : (
                            <span className="text-gray-600 text-xs">
                              {t('supplierInvoices.manual', 'Manuel')}
                            </span>
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
              {t(
                'supplierInvoices.selectSupplierDesc',
                'Choisissez le fournisseur a qui appartient cette facture.'
              )}
            </p>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue
                  placeholder={t('supplierInvoices.chooseSupplier', 'Choisir un fournisseur...')}
                />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {suppliers.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="text-white hover:bg-gray-700"
                  >
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suppliers.length === 0 && (
              <p className="text-xs text-gray-500">
                {t(
                  'supplierInvoices.noSuppliersYet',
                  'Aucun fournisseur. Ajoutez-en un d\'abord dans la section Fournisseurs.'
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

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SupplierInvoicesPage;
