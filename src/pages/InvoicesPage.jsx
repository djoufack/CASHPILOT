import { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import InvoiceGenerator from '@/components/InvoiceGenerator';
import QuickInvoice from '@/components/QuickInvoice';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { useEmailService } from '@/hooks/useEmailService';
import { useToast } from '@/components/ui/use-toast';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportInvoicePDF, exportInvoiceHTML } from '@/services/exportDocuments';
import { exportFacturX, validateForFacturX } from '@/services/exportFacturX';
import ExportButton from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { FileText, Banknote, Zap, CalendarDays, CalendarClock, List, Kanban, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import { resolveInvoiceTaxAmount } from '@/utils/invoiceTax';
import { usePagination } from '@/hooks/usePagination';
import { supabase } from '@/lib/supabase';
import { captureError } from '@/services/errorTracking';
import { useGedHub } from '@/hooks/useGedHub';

import InvoiceListTable from '@/components/invoices/InvoiceListTable';
import InvoiceGalleryView from '@/components/invoices/InvoiceGalleryView';
import InvoiceDialogs from '@/components/invoices/InvoiceDialogs';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

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

const InvoicesPage = () => {
  const { t } = useTranslation();
  const { invoices, deleteInvoice, updateInvoiceStatus, getInvoiceItems, fetchInvoices } = useInvoices();
  const { clients } = useClients();
  const { company } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { sendInvoiceEmail, sending: emailSending } = useEmailService();
  const { uploadDocumentFile, mutating: uploadingDocument } = useGedHub({ disableAutoFetch: true });
  const { toast } = useToast();
  const [showGenerator, setShowGenerator] = useState(false);
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem('invoiceQuickMode') === 'true');
  const [viewMode, setViewMode] = useState('list');
  const [paymentLinkLoading, setPaymentLinkLoading] = useState({});

  // Consolidated dialog state — replaces 11 separate useState calls
  const [dialog, setDialog] = useState({
    type: null, // 'preview' | 'delete' | 'payment' | 'lumpSum' | 'history' | 'email' | null
    invoice: null, // the invoice relevant to the current dialog
    emailAddress: '', // email recipient for the email dialog
    lumpSumClientId: null,
  });

  const openDialog = (type, invoice = null, extra = {}) => setDialog((prev) => ({ ...prev, type, invoice, ...extra }));
  const closeDialog = () => setDialog({ type: null, invoice: null, emailAddress: '', lumpSumClientId: null });
  const pagination = usePagination({ pageSize: 20 });
  const { setTotalCount } = pagination;

  useEffect(() => {
    if (invoices) {
      setTotalCount(invoices.length);
    }
  }, [invoices, setTotalCount]);

  const paginatedInvoices = useMemo(
    () => invoices.slice(pagination.from, pagination.to + 1),
    [invoices, pagination.from, pagination.to]
  );

  // Calendar/Agenda/Kanban data
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

  const invoiceCalendarEvents = useMemo(
    () =>
      invoices.map((inv) => {
        const client = clients.find((c) => c.id === (inv.client_id || inv.clientId));
        return {
          id: inv.id,
          title: `${inv.invoice_number || inv.invoiceNumber || ''} - ${client?.company_name || client?.companyName || 'Unknown'}`,
          date: inv.date || inv.issueDate,
          status: inv.status || 'draft',
          resource: { ...inv, status: inv.status || 'draft' },
        };
      }),
    [invoices, clients]
  );

  const renderInvoiceBadge = (item) => {
    const inv = item._original;
    const invoiceStatus = inv?.status || 'draft';
    const paymentStatus = inv?.payment_status || 'unpaid';
    return (
      <div className="flex flex-col items-end gap-1">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${INVOICE_AGENDA_COLORS[invoiceStatus] || 'bg-gray-500/20 text-gray-400'}`}
        >
          {t(`status.${invoiceStatus}`)}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_BADGE_COLORS[paymentStatus] || 'bg-gray-900/30 text-gray-300 border border-gray-800'}`}
        >
          {t(`payments.${paymentStatus}`)}
        </span>
        {inv?.due_date &&
          new Date(inv.due_date) < new Date() &&
          paymentStatus !== 'paid' &&
          paymentStatus !== 'overpaid' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800">
              {t('status.overdue')}
            </span>
          )}
      </div>
    );
  };

  const invoiceAgendaItems = useMemo(
    () =>
      invoices.map((inv) => {
        const client = clients.find((c) => c.id === (inv.client_id || inv.clientId));
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
      }),
    [invoices, clients, t]
  );

  const invoiceKanbanColumns = [
    { id: 'draft', title: t('status.draft'), color: 'bg-gray-500/20 text-gray-400' },
    { id: 'sent', title: t('status.sent'), color: 'bg-blue-500/20 text-blue-400' },
    { id: 'paid', title: t('status.paid'), color: 'bg-green-500/20 text-green-400' },
    { id: 'overdue', title: t('status.overdue'), color: 'bg-red-500/20 text-red-400' },
    { id: 'cancelled', title: t('status.cancelled'), color: 'bg-gray-500/20 text-gray-500' },
  ];

  // Event handlers
  const handleViewInvoice = (invoice) => openDialog('preview', invoice);

  const handleDeleteClick = (invoice) => openDialog('delete', invoice);

  const handleConfirmDelete = async () => {
    if (dialog.invoice) {
      try {
        await deleteInvoice(dialog.invoice.id);
        closeDialog();
      } catch (error) {
        captureError(error, {
          tags: { scope: 'invoices', action: 'delete_invoice' },
          extra: { invoiceId: dialog.invoice.id },
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

  const handleRecordPayment = (invoice) => openDialog('payment', invoice);

  const handleLumpSumPayment = () => openDialog('lumpSum', null, { lumpSumClientId: null });

  const handleUploadInvoiceDocument = (invoice) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp';
    input.onchange = async () => {
      const [file] = input.files || [];
      if (!file) return;
      try {
        await uploadDocumentFile(
          {
            sourceTable: 'invoices',
            sourceId: invoice.id,
            raw: { company_id: invoice.company_id },
          },
          file,
          { skipRefresh: true }
        );
        await fetchInvoices();
        toast({
          title: t('common.success', 'Succes'),
          description: 'Scan IA termine. La facture est integree et journalisee automatiquement.',
        });
      } catch (error) {
        captureError(error, {
          tags: { scope: 'invoices', action: 'upload_document' },
          extra: { invoiceId: invoice.id },
        });
        toast({
          title: t('common.error'),
          description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
          variant: 'destructive',
        });
      }
    };
    input.click();
  };

  const handleExportInvoicePDF = (invoice) => {
    guardedAction(CREDIT_COSTS.PDF_INVOICE, t('credits.costs.pdfInvoice'), async () => {
      try {
        const enrichedInvoice = {
          ...invoice,
          items: getInvoiceItems(invoice.id),
          client: clients.find((c) => c.id === (invoice.client_id || invoice.clientId)),
        };
        await exportInvoicePDF(enrichedInvoice, company, invoiceSettings);
      } catch (error) {
        captureError(error, { tags: { scope: 'invoices', action: 'export_pdf' }, extra: { invoiceId: invoice.id } });
        toast({
          title: t('common.error'),
          description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
          variant: 'destructive',
        });
        throw error;
      }
    });
  };

  const handleExportInvoiceHTML = (invoice) => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, t('credits.costs.exportHtml'), async () => {
      try {
        const enrichedInvoice = {
          ...invoice,
          items: getInvoiceItems(invoice.id),
          client: clients.find((c) => c.id === (invoice.client_id || invoice.clientId)),
        };
        await exportInvoiceHTML(enrichedInvoice, company, invoiceSettings);
      } catch (error) {
        captureError(error, { tags: { scope: 'invoices', action: 'export_html' }, extra: { invoiceId: invoice.id } });
        toast({
          title: t('common.error'),
          description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
          variant: 'destructive',
        });
        throw error;
      }
    });
  };

  const handleExportInvoiceFacturX = (invoice) => {
    guardedAction(CREDIT_COSTS.PDF_INVOICE, t('credits.costs.pdfInvoice'), async () => {
      try {
        const client = clients.find((c) => c.id === (invoice.client_id || invoice.clientId));
        const validation = validateForFacturX(invoice, company, client || {});
        if (!validation.isValid) throw new Error(validation.errors.join(', '));
        const { blob, filename } = await exportFacturX(invoice, company, client || {}, 'EN16931');
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
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
    });
  };

  const handleOpenEmailModal = (invoice) => {
    const client = invoice.client || clients.find((c) => c.id === (invoice.client_id || invoice.clientId)) || {};
    openDialog('email', invoice, { emailAddress: client.email || '' });
  };

  const handleConfirmSendEmail = async () => {
    if (!dialog.invoice || dialog.type !== 'email') return;
    const invoice = dialog.invoice;
    const client = invoice.client || clients.find((c) => c.id === (invoice.client_id || invoice.clientId)) || {};
    const recipientEmail = dialog.emailAddress.trim();
    if (!recipientEmail) {
      toast({ title: t('common.error'), description: t('invoices.noClientEmail'), variant: 'destructive' });
      return;
    }
    try {
      await sendInvoiceEmail(invoice, { ...client, email: recipientEmail });
      toast({ title: t('common.success'), description: t('invoices.emailSentTo', { email: recipientEmail }) });
      closeDialog();
    } catch (err) {
      captureError(err, {
        tags: { scope: 'invoices', action: 'send_email' },
        extra: { invoiceId: invoice.id, recipientEmail },
      });
      toast({
        title: t('common.error'),
        description: err?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: 'destructive',
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
        toast({ title: t('invoices.paymentLinkGenerated'), description: data.paymentLinkUrl });
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
      toast({ title: t('invoices.paymentLinkCopied') });
    } catch (error) {
      captureError(error, { tags: { scope: 'invoices', action: 'copy_payment_link' } });
      toast({
        title: t('common.error'),
        description: error?.message || t('common.unexpectedError', 'An unexpected error occurred.'),
        variant: 'destructive',
      });
    }
  };

  const invoiceExportColumns = [
    {
      key: 'invoice_number',
      header: t('invoices.invoiceNumber'),
      width: 18,
      accessor: (inv) => inv.invoice_number || inv.invoiceNumber || '',
    },
    {
      key: 'client',
      header: t('clients.companyName'),
      width: 25,
      accessor: (inv) => {
        const client = clients.find((c) => c.id === (inv.client_id || inv.clientId));
        return client?.company_name || client?.companyName || '';
      },
    },
    {
      key: 'date',
      header: t('invoices.issueDate'),
      type: 'date',
      width: 12,
      accessor: (inv) => inv.date || inv.issueDate || '',
    },
    {
      key: 'due_date',
      header: t('invoices.dueDate'),
      type: 'date',
      width: 12,
      accessor: (inv) => inv.due_date || inv.dueDate || '',
    },
    { key: 'total_ht', header: t('invoices.totalHT'), type: 'currency', width: 14 },
    {
      key: 'total_tva',
      header: t('invoices.taxAmount'),
      type: 'currency',
      width: 14,
      accessor: (inv) => resolveInvoiceTaxAmount(inv),
    },
    {
      key: 'total_ttc',
      header: t('invoices.totalTTC'),
      type: 'currency',
      width: 14,
      accessor: (inv) => inv.total_ttc || inv.total || 0,
    },
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
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
            {t('payments.paid')}
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
            {t('payments.partial')}
          </span>
        );
      case 'overpaid':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
            {t('payments.overpaid')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
            {t('payments.unpaid')}
          </span>
        );
    }
  };

  // Shared props for list/gallery sub-components — grouped to reduce prop drilling
  const viewProps = {
    data: {
      invoices,
      paginatedInvoices,
      clients,
      pagination,
    },
    actions: {
      onViewInvoice: handleViewInvoice,
      onDeleteClick: handleDeleteClick,
      onExportPDF: handleExportInvoicePDF,
      onExportHTML: handleExportInvoiceHTML,
      onExportFacturX: handleExportInvoiceFacturX,
      onStatusChange: handleStatusChange,
      onRecordPayment: handleRecordPayment,
      onOpenHistory: (invoice) => openDialog('history', invoice),
      onOpenEmailModal: handleOpenEmailModal,
      onGeneratePaymentLink: handleGeneratePaymentLink,
      onCopyPaymentLink: handleCopyPaymentLink,
      onUploadDocument: handleUploadInvoiceDocument,
    },
    ui: {
      emailSending,
      paymentLinkLoading,
      uploadingDocument,
      getStatusColor,
      getPaymentStatusBadge,
      INVOICE_STATUS_COLORS,
    },
  };

  return (
    <>
      <Helmet>
        <title>
          {t('invoices.title')} - {t('app.name')}
        </title>
        <meta name="description" content="Generate and manage invoices" />
      </Helmet>
      <CreditsGuardModal {...modalProps} />

      <div className="container mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">{t('invoices.title')}</h1>
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
                  onClick={() => {
                    const next = !quickMode;
                    setQuickMode(next);
                    localStorage.setItem('invoiceQuickMode', String(next));
                  }}
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {quickMode ? (
              <QuickInvoice
                onSuccess={() => {
                  setShowGenerator(false);
                  fetchInvoices();
                }}
              />
            ) : (
              <InvoiceGenerator
                onSuccess={() => {
                  setShowGenerator(false);
                  fetchInvoices();
                }}
              />
            )}
          </motion.div>
        ) : (
          <SectionErrorBoundary section="invoice-views">
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
              <TabsList className="bg-gray-800 border border-gray-700 mb-4">
                <TabsTrigger
                  value="list"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                >
                  <List className="w-4 h-4 mr-2" /> {t('common.list') || 'List'}
                </TabsTrigger>
                <TabsTrigger
                  value="gallery"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                >
                  <LayoutGrid className="w-4 h-4 mr-2" /> {t('common.gallery') || 'Galerie'}
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                >
                  <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar') || 'Calendar'}
                </TabsTrigger>
                <TabsTrigger
                  value="agenda"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                >
                  <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda') || 'Agenda'}
                </TabsTrigger>
                <TabsTrigger
                  value="kanban"
                  className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
                >
                  <Kanban className="w-4 h-4 mr-2" /> {t('common.kanban') || 'Kanban'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list">
                <InvoiceListTable {...viewProps} />
              </TabsContent>

              <TabsContent value="gallery">
                <InvoiceGalleryView {...viewProps} />
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
                  onView={(item) => handleViewInvoice(invoices.find((i) => i.id === item.id))}
                  onDelete={(item) => handleDeleteClick(invoices.find((i) => i.id === item.id))}
                  paidStatuses={['paid', 'overpaid', 'cancelled']}
                  renderBadge={renderInvoiceBadge}
                />
              </TabsContent>

              <TabsContent value="kanban">
                <GenericKanbanView
                  columns={invoiceKanbanColumns}
                  items={invoiceAgendaItems}
                  onStatusChange={handleStatusChange}
                  onView={(item) => handleViewInvoice(invoices.find((i) => i.id === item.id))}
                  onDelete={(item) => handleDeleteClick(invoices.find((i) => i.id === item.id))}
                />
              </TabsContent>
            </Tabs>
          </SectionErrorBoundary>
        )}
      </div>

      <InvoiceDialogs
        dialog={dialog}
        setDialog={setDialog}
        closeDialog={closeDialog}
        clients={clients}
        getInvoiceItems={getInvoiceItems}
        fetchInvoices={fetchInvoices}
        handleConfirmDelete={handleConfirmDelete}
        emailSending={emailSending}
        handleConfirmSendEmail={handleConfirmSendEmail}
        company={company}
      />
    </>
  );
};

export default InvoicesPage;
