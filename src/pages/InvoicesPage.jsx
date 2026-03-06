
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import InvoiceGenerator from '@/components/InvoiceGenerator';
import QuickInvoice from '@/components/QuickInvoice';
import InvoicePreview from '@/components/InvoicePreview';
import PaymentRecorder from '@/components/PaymentRecorder';
import PaymentHistory from '@/components/PaymentHistory';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { useEmailService } from '@/hooks/useEmailService';
import { useToast } from '@/components/ui/use-toast';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportInvoicePDF, exportInvoiceHTML } from '@/services/exportDocuments';
import { exportFacturX, validateForFacturX } from '@/services/exportFacturX';
import ExportButton from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, DollarSign, Banknote, History, Zap, CalendarDays, CalendarClock, List, Download, FileArchive, Kanban, Mail, Send, Loader2, Link, Copy, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { captureError } from '@/services/errorTracking';

const InvoicesPage = () => {
  const { t } = useTranslation();
  const { invoices, deleteInvoice, updateInvoiceStatus, getInvoiceItems, fetchInvoices } = useInvoices();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { sendInvoiceEmail, sending: emailSending } = useEmailService();
  const { toast } = useToast();
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem('invoiceQuickMode') === 'true');
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLumpSumOpen, setIsLumpSumOpen] = useState(false);
  const [lumpSumClientId, setLumpSumClientId] = useState(null);
  const [historyInvoice, setHistoryInvoice] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [emailModalInvoice, setEmailModalInvoice] = useState(null);
  const [emailModalAddress, setEmailModalAddress] = useState('');
  const [paymentLinkLoading, setPaymentLinkLoading] = useState({});
  const pagination = usePagination({ pageSize: 20 });
  const { setTotalCount } = pagination;

  // Update pagination total count when invoices change
  useEffect(() => {
    if (invoices) {
      setTotalCount(invoices.length);
    }
  }, [invoices, setTotalCount]);

  // Client-side paginated data for the list/table view
  const paginatedInvoices = invoices.slice(pagination.from, pagination.to + 1);

  const invoiceCalendarStatusColors = {
    draft: { bg: 'rgba(107, 114, 128, 0.7)', border: '#4b5563', text: '#fff' },
    sent: { bg: 'rgba(59, 130, 246, 0.7)', border: '#2563eb', text: '#fff' },
    paid: { bg: 'rgba(34, 197, 94, 0.7)', border: '#16a34a', text: '#fff' },
    overdue: { bg: 'rgba(239, 68, 68, 0.7)', border: '#dc2626', text: '#fff' },
    cancelled: { bg: 'rgba(107, 114, 128, 0.4)', border: '#374151', text: '#9ca3af' },
  };

  const invoiceCalendarLegend = [
    { label: t('status.draft'), color: 'rgba(107, 114, 128, 0.7)' },
    { label: t('status.sent'), color: 'rgba(59, 130, 246, 0.7)' },
    { label: t('status.paid'), color: 'rgba(34, 197, 94, 0.7)' },
    { label: t('status.overdue'), color: 'rgba(239, 68, 68, 0.7)' },
  ];

  const invoiceCalendarEvents = invoices.map(inv => {
    const client = clients.find(c => c.id === (inv.client_id || inv.clientId));
    return {
      id: inv.id,
      title: `${inv.invoice_number || inv.invoiceNumber || ''} - ${client?.company_name || client?.companyName || 'Unknown'}`,
      date: inv.date || inv.issueDate,
      status: inv.status || 'draft',
      resource: { ...inv, status: inv.status || 'draft' },
    };
  });

  const INVOICE_AGENDA_COLORS = {
    draft: 'bg-gray-500/20 text-gray-400',
    sent: 'bg-blue-500/20 text-blue-400',
    paid: 'bg-green-500/20 text-green-400',
    overdue: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-500',
  };

  const PAYMENT_BADGE_COLORS = {
    unpaid: 'bg-red-900/30 text-red-300 border border-red-800',
    partial: 'bg-yellow-900/30 text-yellow-300 border border-yellow-800',
    paid: 'bg-green-900/30 text-green-300 border border-green-800',
    overpaid: 'bg-blue-900/30 text-blue-300 border border-blue-800',
  };

  const renderInvoiceBadge = (item) => {
    const inv = item._original;
    const invoiceStatus = inv?.status || 'draft';
    const paymentStatus = inv?.payment_status || 'unpaid';
    return (
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs px-2 py-0.5 rounded-full ${INVOICE_AGENDA_COLORS[invoiceStatus] || 'bg-gray-500/20 text-gray-400'}`}>
          {t(`status.${invoiceStatus}`)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_BADGE_COLORS[paymentStatus] || 'bg-gray-900/30 text-gray-300 border border-gray-800'}`}>
          {t(`payments.${paymentStatus}`)}
        </span>
        {inv?.due_date && new Date(inv.due_date) < new Date() && paymentStatus !== 'paid' && paymentStatus !== 'overpaid' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800">
            {t('status.overdue')}
          </span>
        )}
      </div>
    );
  };

  const invoiceAgendaItems = invoices.map(inv => {
    const client = clients.find(c => c.id === (inv.client_id || inv.clientId));
    const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
    const invoiceStatus = inv.status || 'draft';
    return {
      id: inv.id,
      title: `${inv.invoice_number || inv.invoiceNumber || ''}`,
      subtitle: client?.company_name || client?.companyName || 'Unknown',
      date: inv.due_date || inv.date || inv.issueDate,
      status: invoiceStatus,
      payment_status: inv.payment_status || 'unpaid',
      statusLabel: t(`status.${invoiceStatus}`),
      statusColor: INVOICE_AGENDA_COLORS[invoiceStatus] || 'bg-gray-500/20 text-gray-400',
      amount: formatCurrency(Number(inv.total_ttc || inv.total || 0), currency),
      _original: inv,
    };
  });

  const invoiceKanbanColumns = [
    { id: 'draft', title: t('status.draft'), color: 'bg-gray-500/20 text-gray-400' },
    { id: 'sent', title: t('status.sent'), color: 'bg-blue-500/20 text-blue-400' },
    { id: 'paid', title: t('status.paid'), color: 'bg-green-500/20 text-green-400' },
    { id: 'overdue', title: t('status.overdue'), color: 'bg-red-500/20 text-red-400' },
    { id: 'cancelled', title: t('status.cancelled'), color: 'bg-gray-500/20 text-gray-500' },
  ];

  const handleViewInvoice = (invoice) => {
    setViewingInvoice(invoice);
  };

  const handleDeleteClick = (invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      try {
        await deleteInvoice(invoiceToDelete.id);
        setIsDeleteDialogOpen(false);
        setInvoiceToDelete(null);
      } catch (error) {
        captureError(error, {
          tags: { scope: 'invoices', action: 'delete_invoice' },
          extra: { invoiceId: invoiceToDelete.id },
        });
        toast({
          title: t('common.error'),
          description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
          variant: 'destructive',
        });
      }
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus);
    } catch (error) {
      captureError(error, {
        tags: { scope: 'invoices', action: 'update_status' },
        extra: { invoiceId, newStatus },
      });
      toast({
        title: t('common.error'),
        description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    }
  };

  const handleRecordPayment = (invoice) => {
    setPaymentInvoice(invoice);
    setIsPaymentOpen(true);
  };

  const handleLumpSumPayment = () => {
    // Use the first client with pending invoices or let user pick
    setLumpSumClientId(null);
    setIsLumpSumOpen(true);
  };

  const handleExportInvoicePDF = (invoice) => {
    guardedAction(
      CREDIT_COSTS.PDF_INVOICE,
      t('credits.costs.pdfInvoice'),
      async () => {
        try {
          const enrichedInvoice = {
            ...invoice,
            items: getInvoiceItems(invoice.id),
            client: clients.find(c => c.id === (invoice.client_id || invoice.clientId))
          };
          await exportInvoicePDF(enrichedInvoice, company);
        } catch (error) {
          captureError(error, {
            tags: { scope: 'invoices', action: 'export_pdf' },
            extra: { invoiceId: invoice.id },
          });
          toast({
            title: t('common.error'),
            description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
            variant: 'destructive',
          });
          throw error;
        }
      }
    );
  };

  const handleExportInvoiceHTML = (invoice) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        try {
          const enrichedInvoice = {
            ...invoice,
            items: getInvoiceItems(invoice.id),
            client: clients.find(c => c.id === (invoice.client_id || invoice.clientId))
          };
          exportInvoiceHTML(enrichedInvoice, company);
        } catch (error) {
          captureError(error, {
            tags: { scope: 'invoices', action: 'export_html' },
            extra: { invoiceId: invoice.id },
          });
          toast({
            title: t('common.error'),
            description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
            variant: 'destructive',
          });
          throw error;
        }
      }
    );
  };

  const handleExportInvoiceFacturX = (invoice) => {
    guardedAction(
      CREDIT_COSTS.PDF_INVOICE,
      t('credits.costs.pdfInvoice'),
      async () => {
        try {
          const client = clients.find(c => c.id === (invoice.client_id || invoice.clientId));
          const validation = validateForFacturX(invoice, company, client || {});
          if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
          }

          const { blob, filename } = await exportFacturX(invoice, company, client || {}, 'EN16931');
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          anchor.click();
          URL.revokeObjectURL(url);

          const enrichedInvoice = {
            ...invoice,
            items: getInvoiceItems(invoice.id),
            client,
          };
          await exportInvoicePDF(enrichedInvoice, company);
        } catch (error) {
          captureError(error, {
            tags: { scope: 'invoices', action: 'export_facturx' },
            extra: { invoiceId: invoice.id },
          });
          toast({
            title: t('common.error'),
            description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
            variant: 'destructive',
          });
          throw error;
        }
      }
    );
  };

  const handleOpenEmailModal = (invoice) => {
    const client = invoice.client || clients.find(c => c.id === (invoice.client_id || invoice.clientId)) || {};
    setEmailModalInvoice(invoice);
    setEmailModalAddress(client.email || '');
  };

  const handleConfirmSendEmail = async () => {
    if (!emailModalInvoice) return;
    const invoice = emailModalInvoice;
    const client = invoice.client || clients.find(c => c.id === (invoice.client_id || invoice.clientId)) || {};
    const recipientEmail = emailModalAddress.trim();

    if (!recipientEmail) {
      toast({
        title: t('common.error'),
        description: t('invoices.noClientEmail'),
        variant: "destructive",
      });
      return;
    }

    try {
      await sendInvoiceEmail(invoice, { ...client, email: recipientEmail });
      toast({
        title: t('common.success'),
        description: t('invoices.emailSentTo', { email: recipientEmail }),
      });
      setEmailModalInvoice(null);
      setEmailModalAddress('');
    } catch (err) {
      captureError(err, {
        tags: { scope: 'invoices', action: 'send_email' },
        extra: { invoiceId: invoice.id, recipientEmail },
      });
      toast({
        title: t('common.error'),
        description: err?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: "destructive",
      });
    }
  };

  const handleGeneratePaymentLink = async (invoice) => {
    setPaymentLinkLoading((prev) => ({ ...prev, [invoice.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('stripe-invoice-link', {
        body: { invoiceId: invoice.id },
      });
      if (error) throw error;
      if (data?.paymentLinkUrl) {
        await fetchInvoices();
        toast({
          title: t('invoices.paymentLinkGenerated'),
          description: data.paymentLinkUrl,
        });
      }
    } catch (err) {
      captureError(err, {
        tags: { scope: 'invoices', action: 'generate_payment_link' },
        extra: { invoiceId: invoice.id },
      });
      toast({
        title: t('common.error'),
        description: err?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    } finally {
      setPaymentLinkLoading((prev) => ({ ...prev, [invoice.id]: false }));
    }
  };

  const handleCopyPaymentLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('invoices.paymentLinkCopied'),
      });
    } catch (error) {
      captureError(error, {
        tags: { scope: 'invoices', action: 'copy_payment_link' },
      });
      toast({
        title: t('common.error'),
        description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    }
  };

  const invoiceExportColumns = [
    { key: 'invoice_number', header: t('invoices.invoiceNumber'), width: 18, accessor: (inv) => inv.invoice_number || inv.invoiceNumber || '' },
    { key: 'client', header: t('clients.companyName'), width: 25, accessor: (inv) => {
      const client = clients.find(c => c.id === (inv.client_id || inv.clientId));
      return client?.company_name || client?.companyName || '';
    }},
    { key: 'date', header: t('invoices.issueDate'), type: 'date', width: 12, accessor: (inv) => inv.date || inv.issueDate || '' },
    { key: 'due_date', header: t('invoices.dueDate'), type: 'date', width: 12, accessor: (inv) => inv.due_date || inv.dueDate || '' },
    { key: 'total_ht', header: t('invoices.totalHT'), type: 'currency', width: 14 },
    { key: 'total_tva', header: t('invoices.taxAmount'), type: 'currency', width: 14 },
    { key: 'total_ttc', header: t('invoices.totalTTC'), type: 'currency', width: 14, accessor: (inv) => inv.total_ttc || inv.total || 0 },
    { key: 'status', header: t('invoices.status'), width: 12 },
  ];

  const INVOICE_STATUS_COLORS = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-600',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-600',
    paid: 'bg-green-500/20 text-green-400 border-green-600',
    overdue: 'bg-red-500/20 text-red-400 border-red-600',
    cancelled: 'bg-gray-500/20 text-gray-500 border-gray-700',
  };

  const getStatusColor = (status) => {
    const colors = {
      paid: 'bg-green-500',
      sent: 'bg-blue-500',
      overdue: 'bg-red-500',
      cancelled: 'bg-gray-600',
      default: 'bg-gray-500',
    };
    return colors[status] || colors.default;
  };

  const getPaymentStatusBadge = (paymentStatus) => {
    switch (paymentStatus) {
      case 'paid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">{t('payments.paid')}</span>;
      case 'partial':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">{t('payments.partial')}</span>;
      case 'overpaid':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">{t('payments.overpaid')}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">{t('payments.unpaid')}</span>;
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('invoices.title')} - {t('app.name')}</title>
        <meta name="description" content="Generate and manage invoices" />
      </Helmet>
      <CreditsGuardModal {...modalProps} />

        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                  {t('invoices.title')}
                </h1>
                <p className="text-gray-400 text-sm md:text-base">{t('invoices.subtitle')}</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                {!showGenerator && invoices.length > 0 && (
                  <ExportButton
                    data={invoices}
                    columns={invoiceExportColumns}
                    filename={t('export.filename.invoices', 'invoices')}
                  />
                )}
                <Button
                  onClick={() => setShowGenerator(!showGenerator)}
                  className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {showGenerator ? 'View Invoices' : t('invoices.generateInvoice')}
                </Button>
                {showGenerator && (
                  <Button
                    variant="outline"
                    onClick={() => { const next = !quickMode; setQuickMode(next); localStorage.setItem('invoiceQuickMode', String(next)); }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {quickMode ? t('quickInvoice.switchToStandard') : t('quickInvoice.switchToQuick')}
                  </Button>
                )}
                {!showGenerator && (
                  <Button
                    onClick={handleLumpSumPayment}
                    variant="outline"
                    className="flex-1 md:flex-none border-green-600 text-green-400 hover:bg-green-900/20"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    {t('payments.lumpSum')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>

          {showGenerator ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {quickMode ? (
                <QuickInvoice onSuccess={() => { setShowGenerator(false); fetchInvoices(); }} />
              ) : (
                <InvoiceGenerator onSuccess={() => { setShowGenerator(false); fetchInvoices(); }} />
              )}
            </motion.div>
          ) : (
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
              <TabsList className="bg-gray-800 border border-gray-700 mb-4">
                <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                  <List className="w-4 h-4 mr-2" /> {t('common.list') || 'List'}
                </TabsTrigger>
                <TabsTrigger value="gallery" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                  <LayoutGrid className="w-4 h-4 mr-2" /> {t('common.gallery') || 'Galerie'}
                </TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                  <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar') || 'Calendar'}
                </TabsTrigger>
                <TabsTrigger value="agenda" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                  <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda') || 'Agenda'}
                </TabsTrigger>
                <TabsTrigger value="kanban" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                  <Kanban className="w-4 h-4 mr-2" /> {t('common.kanban') || 'Kanban'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden"
                >
                  {invoices.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      {t('invoices.noInvoices')}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
	                        <thead className="bg-gray-800/50">
	                          <tr>
	                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
	                              Documents
	                            </th>
	                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
	                              {t('invoices.invoiceNumber')}
	                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                              {t('clients.companyName')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                              {t('invoices.issueDate')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              {t('invoices.total')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                              {t('payments.balanceDue')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                              {t('invoices.status')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                              {t('payments.title')}
                            </th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
	                          {paginatedInvoices.map((invoice) => {
	                            const client = clients.find(c => c.id === (invoice.client_id || invoice.clientId));
	                            const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
	                            return (
	                              <tr key={invoice.id} className="hover:bg-gray-700/50 transition-colors">
	                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
	                                  <div className="flex items-center gap-2">
	                                    <Button
	                                      variant="outline"
	                                      size="sm"
	                                      onClick={() => handleViewInvoice(invoice)}
	                                      className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
	                                      title={t('common.view') || 'Visualiser'}
	                                    >
	                                      <Eye className="w-4 h-4" />
	                                      <span className="hidden xl:inline ml-1">{t('common.view') || 'Visualiser'}</span>
	                                    </Button>
	                                    <Button
	                                      variant="outline"
	                                      size="sm"
	                                      onClick={() => handleExportInvoicePDF(invoice)}
	                                      className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
	                                      title="Export PDF (2 crédits)"
	                                    >
	                                      <Download className="w-4 h-4" />
	                                      <span className="hidden xl:inline ml-1">PDF</span>
	                                    </Button>
	                                    <Button
	                                      variant="outline"
	                                      size="sm"
	                                      onClick={() => handleExportInvoiceHTML(invoice)}
	                                      className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
	                                      title="Export HTML (2 crédits)"
	                                    >
	                                      <FileText className="w-4 h-4" />
	                                      <span className="hidden xl:inline ml-1">HTML</span>
	                                    </Button>
	                                    <Button
	                                      variant="outline"
	                                      size="sm"
	                                      onClick={() => handleExportInvoiceFacturX(invoice)}
	                                      className="border-teal-500/40 text-teal-300 hover:bg-teal-900/20 h-8 px-2"
	                                      title="Factur-X PDF+XML (2 crédits)"
	                                    >
	                                      <FileArchive className="w-4 h-4" />
	                                      <span className="hidden xl:inline ml-1">Factur-X</span>
	                                    </Button>
	                                  </div>
	                                </td>
	                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
	                                  {invoice.invoice_number || invoice.invoiceNumber}
	                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                                  {client?.company_name || client?.companyName || 'Unknown'}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                                  {(invoice.date || invoice.issueDate) ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy') : '-'}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
                                  <span className={Number(invoice.balance_due || 0) > 0 ? 'text-orange-400 font-medium' : 'text-green-400'}>
                                    {formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0), currency)}
                                  </span>
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="flex flex-col gap-1">
                                    <Select
                                      value={invoice.status}
                                      onValueChange={(value) => handleStatusChange(invoice.id, value)}
                                    >
                                      <SelectTrigger className={`w-28 md:w-32 ${getStatusColor(invoice.status)} text-white border-none h-8`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-gray-700 border-gray-600 text-white">
                                        <SelectItem value="draft">{t('status.draft')}</SelectItem>
                                        <SelectItem value="sent">{t('status.sent')}</SelectItem>
                                        <SelectItem value="paid">{t('status.paid')}</SelectItem>
                                        <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
                                        <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
                                  {getPaymentStatusBadge(invoice.payment_status)}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end space-x-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRecordPayment(invoice)}
                                      className="text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 w-8 p-0"
                                      title={t('payments.recordPayment')}
                                    >
                                      <DollarSign className="w-4 h-4" />
                                    </Button>
	                                    <Button
	                                      variant="ghost"
	                                      size="sm"
	                                      onClick={() => { setHistoryInvoice(invoice); setIsHistoryOpen(true); }}
	                                      className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
	                                      title={t('payments.history')}
	                                    >
	                                      <History className="w-4 h-4" />
	                                    </Button>
	                                    <Button
	                                      variant="ghost"
	                                      size="sm"
                                      onClick={() => handleOpenEmailModal(invoice)}
                                      disabled={emailSending}
                                      className="text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 h-8 w-8 p-0"
                                      title={t('invoices.sendByEmail')}
                                    >
                                      <Mail className="w-4 h-4" />
                                    </Button>
                                    {invoice.status !== 'paid' && (
                                      invoice.stripe_payment_link_url ? (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCopyPaymentLink(invoice.stripe_payment_link_url)}
                                            className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                                            title={t('invoices.copyPaymentLink')}
                                          >
                                            <Copy className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(invoice.stripe_payment_link_url, '_blank')}
                                            className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                                            title={t('invoices.copyPaymentLink')}
                                          >
                                            <Link className="w-4 h-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleGeneratePaymentLink(invoice)}
                                          disabled={!!paymentLinkLoading[invoice.id]}
                                          className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 px-2"
                                          title={t('invoices.generatePaymentLink')}
                                        >
                                          {paymentLinkLoading[invoice.id] ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Link className="w-4 h-4" />
                                          )}
                                        </Button>
                                      )
                                    )}
	                                    <Button
	                                      variant="ghost"
	                                      size="sm"
                                      onClick={() => handleDeleteClick(invoice)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                </motion.div>
              </TabsContent>

              <TabsContent value="gallery">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {invoices.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl text-center py-12 text-gray-400">
                      {t('invoices.noInvoices')}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {paginatedInvoices.map((invoice) => {
                          const client = clients.find(c => c.id === (invoice.client_id || invoice.clientId));
                          const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
                          const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
                          const issueDate = invoice.date || invoice.issueDate;
                          const dueDate = invoice.due_date || invoice.dueDate;
                          const hasPaymentLink = !!invoice.stripe_payment_link_url;

                          return (
                            <div
                              key={invoice.id}
                              className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 flex flex-col gap-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gradient">{invoiceNumber}</p>
                                  <p className="text-xs text-gray-400 mt-1">{client?.company_name || client?.companyName || 'Unknown'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status] || INVOICE_STATUS_COLORS.draft}`}>
                                    {t(`status.${invoice.status || 'draft'}`)}
                                  </span>
                                  {getPaymentStatusBadge(invoice.payment_status)}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                                  <p className="text-gray-400">{t('invoices.issueDate')}</p>
                                  <p className="text-gray-200 mt-1">{issueDate ? format(new Date(issueDate), 'MMM dd, yyyy') : '-'}</p>
                                </div>
                                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                                  <p className="text-gray-400">{t('invoices.dueDate')}</p>
                                  <p className="text-gray-200 mt-1">{dueDate ? format(new Date(dueDate), 'MMM dd, yyyy') : '-'}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                                  <p className="text-gray-400 text-xs">{t('invoices.total')}</p>
                                  <p className="text-gray-100 font-semibold mt-1">{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</p>
                                </div>
                                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                                  <p className="text-gray-400 text-xs">{t('payments.balanceDue')}</p>
                                  <p className={`font-semibold mt-1 ${Number(invoice.balance_due || 0) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                    {formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0), currency)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                                  title={t('common.view') || 'Visualiser'}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExportInvoicePDF(invoice)}
                                  className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
                                  title="Export PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExportInvoiceHTML(invoice)}
                                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
                                  title="Export HTML"
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExportInvoiceFacturX(invoice)}
                                  className="border-teal-500/40 text-teal-300 hover:bg-teal-900/20 h-8 px-2"
                                  title="Factur-X PDF+XML"
                                >
                                  <FileArchive className="w-4 h-4" />
                                </Button>
                                <div className="ml-auto">
                                  <Select
                                    value={invoice.status}
                                    onValueChange={(value) => handleStatusChange(invoice.id, value)}
                                  >
                                    <SelectTrigger className={`w-28 ${getStatusColor(invoice.status)} text-white border-none h-8 text-xs`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-700 border-gray-600 text-white">
                                      <SelectItem value="draft">{t('status.draft')}</SelectItem>
                                      <SelectItem value="sent">{t('status.sent')}</SelectItem>
                                      <SelectItem value="paid">{t('status.paid')}</SelectItem>
                                      <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
                                      <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-700">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRecordPayment(invoice)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 w-8 p-0"
                                  title={t('payments.recordPayment')}
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setHistoryInvoice(invoice); setIsHistoryOpen(true); }}
                                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
                                  title={t('payments.history')}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEmailModal(invoice)}
                                  disabled={emailSending}
                                  className="text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 h-8 w-8 p-0"
                                  title={t('invoices.sendByEmail')}
                                >
                                  <Mail className="w-4 h-4" />
                                </Button>
                                {invoice.status !== 'paid' && (
                                  hasPaymentLink ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyPaymentLink(invoice.stripe_payment_link_url)}
                                        className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                                        title={t('invoices.copyPaymentLink')}
                                      >
                                        <Copy className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open(invoice.stripe_payment_link_url, '_blank')}
                                        className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                                        title={t('invoices.copyPaymentLink')}
                                      >
                                        <Link className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleGeneratePaymentLink(invoice)}
                                      disabled={!!paymentLinkLoading[invoice.id]}
                                      className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                                      title={t('invoices.generatePaymentLink')}
                                    >
                                      {paymentLinkLoading[invoice.id] ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Link className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(invoice)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                  title={t('common.delete') || 'Delete'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                    </>
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value="calendar">
                <GenericCalendarView
                  events={invoiceCalendarEvents}
                  statusColors={invoiceCalendarStatusColors}
                  legend={invoiceCalendarLegend}
                  onSelectEvent={(inv) => handleViewInvoice(inv)}
                />
              </TabsContent>

              <TabsContent value="agenda">
                <GenericAgendaView
                  items={invoiceAgendaItems}
                  dateField="date"
                  onView={(item) => handleViewInvoice(invoices.find(i => i.id === item.id))}
                  onDelete={(item) => handleDeleteClick(invoices.find(i => i.id === item.id))}
                  paidStatuses={['paid', 'overpaid', 'cancelled']}
                  renderBadge={renderInvoiceBadge}
                />
              </TabsContent>

              <TabsContent value="kanban">
                <GenericKanbanView
                  columns={invoiceKanbanColumns}
                  items={invoiceAgendaItems}
                  onStatusChange={handleStatusChange}
                  onView={(item) => handleViewInvoice(invoices.find(i => i.id === item.id))}
                  onDelete={(item) => handleDeleteClick(invoices.find(i => i.id === item.id))}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>

      {/* Invoice Preview Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={() => setViewingInvoice(null)}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-4xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">
              {t('invoices.invoiceDetails')}
            </DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <InvoicePreview
              invoice={viewingInvoice}
              client={clients.find(c => c.id === (viewingInvoice.client_id || viewingInvoice.clientId))}
              items={viewingInvoice.items || getInvoiceItems(viewingInvoice.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Recorder Dialog (single invoice) */}
      <PaymentRecorder
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        invoice={paymentInvoice}
        isLumpSum={false}
        onSuccess={() => fetchInvoices()}
      />

      {/* Lump Sum Payment Dialog */}
      <PaymentRecorder
        open={isLumpSumOpen}
        onOpenChange={setIsLumpSumOpen}
        clientId={lumpSumClientId}
        isLumpSum={true}
        onSuccess={() => fetchInvoices()}
      />

      {/* Payment History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="w-full sm:max-w-[95%] md:max-w-2xl bg-gray-800 border-gray-700 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">
              {t('payments.history')} — {historyInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {historyInvoice && (
            <PaymentHistory invoiceId={historyInvoice.id} invoice={historyInvoice} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full sm:w-auto mt-0">
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Email Modal */}
      <Dialog open={!!emailModalInvoice} onOpenChange={(open) => { if (!open) { setEmailModalInvoice(null); setEmailModalAddress(''); } }}>
        <DialogContent className="w-full sm:max-w-[90%] md:max-w-md bg-gray-800 border-gray-700 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('email.sendInvoice')}
            </DialogTitle>
          </DialogHeader>
          {emailModalInvoice && (() => {
            const emailClient = emailModalInvoice.client || clients.find(c => c.id === (emailModalInvoice.client_id || emailModalInvoice.clientId)) || {};
            const emailCurrency = emailClient.preferred_currency || emailClient.preferredCurrency || 'EUR';
            return (
              <div className="space-y-4">
                {/* Invoice summary */}
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                  <p className="text-sm text-gray-400">{t('invoices.invoiceNumber')}</p>
                  <p className="text-white font-medium">{emailModalInvoice.invoice_number || emailModalInvoice.invoiceNumber}</p>
                  <p className="text-sm text-gray-400 mt-2">{t('clients.companyName')}</p>
                  <p className="text-white">{emailClient.company_name || emailClient.companyName || 'N/A'}</p>
                  <p className="text-sm text-gray-400 mt-2">{t('invoices.total')}</p>
                  <p className="text-white font-medium">{formatCurrency(Number(emailModalInvoice.total_ttc || emailModalInvoice.total || 0), emailCurrency)}</p>
                </div>

                {/* Subject preview */}
                <div>
                  <Label className="text-sm text-gray-400">{t('email.subject.invoice')}</Label>
                  <p className="text-white text-sm mt-1 bg-gray-900/30 rounded px-3 py-2 border border-gray-700">
                    {t('email.subjectPreview', {
                      invoiceNumber: emailModalInvoice.invoice_number || emailModalInvoice.invoiceNumber || '',
                      companyName: company?.company_name || 'CashPilot'
                    })}
                  </p>
                </div>

                {/* Email input */}
                <div>
                  <Label htmlFor="email-recipient" className="text-sm text-gray-400">
                    {t('email.recipientEmail')}
                  </Label>
                  <Input
                    id="email-recipient"
                    type="email"
                    value={emailModalAddress}
                    onChange={(e) => setEmailModalAddress(e.target.value)}
                    placeholder="client@example.com"
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setEmailModalInvoice(null); setEmailModalAddress(''); }}
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {t('buttons.cancel')}
                  </Button>
                  <Button
                    onClick={handleConfirmSendEmail}
                    disabled={emailSending || !emailModalAddress.trim()}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    {emailSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('email.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('email.send')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InvoicesPage;
