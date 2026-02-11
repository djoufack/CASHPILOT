
import React from "react";
import { useState, useEffect } from 'react';
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
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, DollarSign, Banknote, History, Zap, CalendarDays, CalendarClock, List, Download, Kanban, Mail } from 'lucide-react';
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
  const pagination = usePagination({ pageSize: 20 });

  // Update pagination total count when invoices change
  useEffect(() => {
    if (invoices) {
      pagination.setTotalCount(invoices.length);
    }
  }, [invoices]);

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
      await deleteInvoice(invoiceToDelete.id);
      setIsDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    await updateInvoiceStatus(invoiceId, newStatus);
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
        const enrichedInvoice = {
          ...invoice,
          items: getInvoiceItems(invoice.id),
          client: clients.find(c => c.id === (invoice.client_id || invoice.clientId))
        };
        await exportInvoicePDF(enrichedInvoice, company);
      }
    );
  };

  const handleExportInvoiceHTML = (invoice) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const enrichedInvoice = {
          ...invoice,
          items: getInvoiceItems(invoice.id),
          client: clients.find(c => c.id === (invoice.client_id || invoice.clientId))
        };
        exportInvoiceHTML(enrichedInvoice, company);
      }
    );
  };

  const handleSendEmail = async (invoice) => {
    try {
      // Client may come from the nested relation or from the clients array
      const client = invoice.client || clients.find(c => c.id === (invoice.client_id || invoice.clientId)) || {};
      if (!client.email) {
        toast({
          title: t('common.error'),
          description: t('invoices.noClientEmail'),
          variant: "destructive",
        });
        return;
      }
      await sendInvoiceEmail(invoice, client);
      toast({
        title: t('common.success'),
        description: t('invoices.emailSentTo', { email: client.email }),
      });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleExportList = (format) => {
    if (!invoices || invoices.length === 0) return;
    const exportData = invoices.map(inv => {
      const client = clients.find(c => c.id === (inv.client_id || inv.clientId));
      return {
        'Invoice Number': inv.invoice_number || inv.invoiceNumber || '',
        'Client': client?.company_name || client?.companyName || '',
        'Total HT': inv.total_ht || '',
        'Total TVA': inv.total_tva || '',
        'Total TTC': inv.total_ttc || inv.total || '',
        'Status': inv.status || '',
        'Payment Status': inv.payment_status || '',
        'Invoice Date': inv.date || inv.issueDate || '',
        'Due Date': inv.due_date || inv.dueDate || '',
      };
    });
    if (format === 'csv') {
      exportToCSV(exportData, 'invoices');
    } else {
      exportToExcel(exportData, 'invoices');
    }
  };

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
                <p className="text-gray-400 text-sm md:text-base">Create and manage professional invoices</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                {!showGenerator && invoices.length > 0 && (
                  <>
                    <Button
                      onClick={() => handleExportList('csv')}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      title="Export CSV"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      onClick={() => handleExportList('xlsx')}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      title="Export Excel"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Excel
                    </Button>
                  </>
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
                                      onClick={() => handleExportInvoicePDF(invoice)}
                                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 h-8 w-8 p-0"
                                      title="Export PDF (2 crédits)"
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleExportInvoiceHTML(invoice)}
                                      className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20 h-8 w-8 p-0"
                                      title="Export HTML (2 crédits)"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSendEmail(invoice)}
                                      disabled={emailSending}
                                      className="text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 h-8 w-8 p-0"
                                      title={t('invoices.sendByEmail')}
                                    >
                                      <Mail className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewInvoice(invoice)}
                                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
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
                  onStatusChange={(id, status) => updateInvoiceStatus(id, status)}
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
    </>
  );
};

export default InvoicesPage;
