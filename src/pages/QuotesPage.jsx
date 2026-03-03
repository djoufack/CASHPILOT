
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useQuotes } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportQuotePDF, exportQuoteHTML } from '@/services/exportDocuments';
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, FileSignature, Trash2, Loader2, Search, List, CalendarDays, CalendarClock, Download, FileText, Kanban, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import { formatDateInput } from '@/utils/dateFormatting';
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
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

const emptyItem = { description: '', quantity: 1, unit_price: 0, tax_rate: 21 };

const createInitialFormData = () => ({
  client_id: '',
  date: formatDateInput(),
  due_date: '',
  notes: '',
  status: 'draft',
  items: [{ ...emptyItem }],
});

const QuoteCard = ({ quote, onDelete, onExportPDF, onExportHTML, onRequestSignature, onCopySignatureLink }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-700',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-800',
    accepted: 'bg-green-500/20 text-green-400 border-green-800',
    rejected: 'bg-red-500/20 text-red-400 border-red-800',
    expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-800',
  };

  const statusLabels = {
    draft: t('quotesPage.statusDraft'),
    sent: t('quotesPage.statusSent'),
    accepted: t('quotesPage.statusAccepted'),
    rejected: t('quotesPage.statusRejected'),
    expired: t('quotesPage.statusExpired'),
  };

  const sigStatus = quote.signature_status;

  const renderSignatureBadge = () => {
    if (sigStatus === 'signed') {
      return (
        <span className="text-xs px-2 py-1 rounded-full border bg-green-500/20 text-green-400 border-green-800">
          {t('quotesPage.signatureSigned')}
        </span>
      );
    }
    if (sigStatus === 'pending') {
      return (
        <span className="text-xs px-2 py-1 rounded-full border bg-orange-500/20 text-orange-400 border-orange-800">
          {t('quotesPage.signaturePending')}
        </span>
      );
    }
    if (sigStatus === 'rejected') {
      return (
        <span className="text-xs px-2 py-1 rounded-full border bg-red-500/20 text-red-400 border-red-800">
          {t('quotesPage.signatureRejected')}
        </span>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gradient">{quote.quote_number}</h3>
          <p className="text-sm text-gray-400">{quote.client?.company_name || t('timesheets.noClient')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-1 rounded-full border capitalize ${statusColors[quote.status] || statusColors.draft}`}>
            {statusLabels[quote.status] || quote.status}
          </span>
          {renderSignatureBadge()}
        </div>
      </div>
      <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <span>{quote.date ? new Date(quote.date).toLocaleDateString(locale) : '—'}</span>
        <span className="text-gradient font-bold text-lg">{formatCurrency(quote.total || quote.total_ttc || 0)}</span>
      </div>
      {quote.notes && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{quote.notes}</p>}
      <div className="flex justify-between items-center gap-2 border-t border-gray-800 pt-3">
        <div className="flex gap-2">
          {(!sigStatus || sigStatus === 'unsigned') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRequestSignature(quote)}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 text-xs"
              title={t('quotesPage.requestSignature')}
            >
              <FileSignature className="w-4 h-4 mr-1" />
              {t('quotesPage.requestSignature')}
            </Button>
          )}
          {sigStatus === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopySignatureLink(quote)}
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 text-xs"
              title={t('quotesPage.copySignatureLink')}
            >
              <Copy className="w-4 h-4 mr-1" />
              {t('quotesPage.copySignatureLink')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExportPDF(quote)}
            className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
            title={t('quotesPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_QUOTE })}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExportHTML(quote)}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
            title={t('quotesPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(quote.id)}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const QuotesPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { quotes, loading, createQuote, updateQuote, deleteQuote } = useQuotes();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(() => createInitialFormData());
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  // Signature dialog state
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureQuote, setSignatureQuote] = useState(null);
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureLink, setSignatureLink] = useState('');
  const [signatureSubmitting, setSignatureSubmitting] = useState(false);

  const quoteCalendarStatusColors = {
    draft: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    sent: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    accepted: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    rejected: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
    expired: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  };

  const quoteCalendarLegend = [
    { label: t('quotesPage.statusDraft'), color: '#6b7280' },
    { label: t('quotesPage.statusSent'), color: '#3b82f6' },
    { label: t('quotesPage.statusAccepted'), color: '#22c55e' },
    { label: t('quotesPage.statusRejected'), color: '#ef4444' },
    { label: t('quotesPage.statusExpired'), color: '#eab308' },
  ];

  const quoteCalendarEvents = quotes.map(q => ({
    id: q.id,
    title: `${q.quote_number || ''} - ${q.client?.company_name || t('timesheets.noClient')}`,
    date: q.date,
    status: q.status || 'draft',
    resource: q,
  }));

  const quoteAgendaItems = quotes.map(q => {
    const statusColorMap = {
      draft: 'bg-gray-500/20 text-gray-400',
      sent: 'bg-blue-500/20 text-blue-400',
      accepted: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      expired: 'bg-yellow-500/20 text-yellow-400',
    };
    return {
      id: q.id,
      title: q.quote_number || '',
      subtitle: q.client?.company_name || t('timesheets.noClient'),
      date: q.date,
      status: q.status || 'draft',
      statusLabel: t(`quotesPage.status${(q.status || 'draft').charAt(0).toUpperCase()}${(q.status || 'draft').slice(1)}`),
      statusColor: statusColorMap[q.status] || 'bg-gray-500/20 text-gray-400',
      amount: formatCurrency(q.total || q.total_ttc || 0),
    };
  });

  const quoteKanbanColumns = [
    { id: 'draft', title: t('quotesPage.statusDraft'), color: 'bg-gray-500/20 text-gray-400' },
    { id: 'sent', title: t('quotesPage.statusSent'), color: 'bg-blue-500/20 text-blue-400' },
    { id: 'accepted', title: t('quotesPage.statusAccepted'), color: 'bg-green-500/20 text-green-400' },
    { id: 'rejected', title: t('quotesPage.statusRejected'), color: 'bg-red-500/20 text-red-400' },
    { id: 'expired', title: t('quotesPage.statusExpired'), color: 'bg-yellow-500/20 text-yellow-400' },
  ];

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch =
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.client?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || q.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const pagination = usePagination({ pageSize: 20 });
  const { setTotalCount } = pagination;

  // Update pagination total count when filtered quotes change
  useEffect(() => {
    setTotalCount(filteredQuotes.length);
  }, [filteredQuotes.length, setTotalCount]);

  // Client-side paginated data for the list view
  const paginatedQuotes = filteredQuotes.slice(pagination.from, pagination.to + 1);

  const handleOpenDialog = () => {
    setFormData(createInitialFormData());
    setIsDialogOpen(true);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const calculateTotals = () => {
    let totalHT = 0;
    let totalTax = 0;
    formData.items.forEach(item => {
      const lineHT = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      totalHT += lineHT;
      totalTax += lineHT * ((parseFloat(item.tax_rate) || 0) / 100);
    });
    return { totalHT, totalTax, totalTTC: totalHT + totalTax };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) return;

    setSubmitting(true);
    const { totalHT, totalTax, totalTTC } = calculateTotals();
    try {
      await createQuote({
        client_id: formData.client_id,
        date: formData.date || formatDateInput(),
        due_date: formData.due_date || null,
        notes: formData.notes.trim() || null,
        status: formData.status,
        items: formData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          tax_rate: parseFloat(item.tax_rate) || 0,
        })),
        total_ht: totalHT,
        tax_rate: formData.items[0] ? parseFloat(formData.items[0].tax_rate) || 0 : 0,
        total_ttc: totalTTC,
        total: totalTTC,
      });
      setIsDialogOpen(false);
      setFormData(createInitialFormData());
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteQuote(id);
    } catch {
      // Error handled by hook toast
    }
  };

  const handleExportQuotePDF = (quote) => {
    guardedAction(
      CREDIT_COSTS.PDF_QUOTE,
      t('credits.costs.pdfQuote'),
      async () => {
        const enrichedQuote = {
          ...quote,
          client: clients.find(c => c.id === quote.client_id)
        };
        await exportQuotePDF(enrichedQuote, company);
      }
    );
  };

  const handleExportQuoteHTML = (quote) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const enrichedQuote = {
          ...quote,
          client: clients.find(c => c.id === quote.client_id)
        };
        exportQuoteHTML(enrichedQuote, company);
      }
    );
  };

  const handleRequestSignature = (quote) => {
    setSignatureQuote(quote);
    setSignerEmail(quote.signer_email || '');
    setSignatureLink('');
    setSignatureDialogOpen(true);
  };

  const handleSendSignatureRequest = async () => {
    if (!signatureQuote) return;
    setSignatureSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('quote-sign-request', {
        body: { quoteId: signatureQuote.id, signerEmail: signerEmail || null },
      });
      if (error) throw error;
      setSignatureLink(data.signatureUrl);
      toast({ title: t('quotesPage.signatureLinkCopied'), description: data.signatureUrl });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setSignatureSubmitting(false);
    }
  };

  const handleCopySignatureLink = (quote) => {
    const appUrl = window.location.origin;
    const link = `${appUrl}/quote-sign/${quote.signature_token}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: t('quotesPage.signatureLinkCopied') });
    });
  };

  const handleCopyGeneratedLink = () => {
    navigator.clipboard.writeText(signatureLink).then(() => {
      toast({ title: t('quotesPage.signatureLinkCopied') });
    });
  };

  const handleExportList = (format) => {
    if (!quotes || quotes.length === 0) return;
    const statusLabels = {
      draft: t('quotesPage.statusDraft'),
      sent: t('quotesPage.statusSent'),
      accepted: t('quotesPage.statusAccepted'),
      rejected: t('quotesPage.statusRejected'),
      expired: t('quotesPage.statusExpired'),
    };
    const exportData = quotes.map(q => ({
      [t('quotesPage.quoteNumber')]: q.quote_number || '',
      [t('quotesPage.client')]: q.client?.company_name || '',
      [t('invoices.totalTTC')]: q.total || q.total_ttc || '',
      [t('quotesPage.status')]: statusLabels[q.status] || q.status || '',
      [t('quotesPage.date')]: q.date || '',
    }));
    if (format === 'csv') {
      exportToCSV(exportData, 'quotes');
    } else {
      exportToExcel(exportData, 'quotes');
    }
  };

  const { totalHT, totalTax, totalTTC} = calculateTotals();

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>{t('quotesPage.title')} - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {t('quotesPage.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">{t('quotesPage.subtitle')}</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {quotes.length > 0 && (
              <>
                <Button
                  onClick={() => handleExportList('csv')}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  title={t('quotesPage.exportCsv')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button
                  onClick={() => handleExportList('xlsx')}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  title={t('quotesPage.exportExcel')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Excel
                </Button>
              </>
            )}
            <Button onClick={handleOpenDialog} className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="mr-2 h-4 w-4" /> {t('quotesPage.create')}
            </Button>
          </div>
        </div>

        {quotes.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder={t('quotesPage.searchPlaceholder')}
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {[
                { value: 'all', label: t('quotesPage.allStatuses') },
                { value: 'draft', label: t('quotesPage.statusDraft') },
                { value: 'sent', label: t('quotesPage.statusSent') },
                { value: 'accepted', label: t('quotesPage.statusAccepted') },
                { value: 'rejected', label: t('quotesPage.statusRejected') },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  variant={filterStatus === value ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(value)}
                  className={`flex-shrink-0 ${filterStatus === value ? 'bg-orange-500' : 'border-gray-800 text-gray-400'}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

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
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            ) : filteredQuotes.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full bg-gray-900 border border-gray-800 rounded-xl p-8 md:p-12 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gray-800 rounded-full">
                    <FileSignature className="w-12 h-12 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gradient mb-2">{t('quotesPage.emptyTitle')}</h3>
                <p className="text-gray-400 mb-6">{t('quotesPage.emptyDescription')}</p>
                <Button onClick={handleOpenDialog} variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
                  {t('quotesPage.create')}
                </Button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedQuotes.map(quote => (
                    <QuoteCard key={quote.id} quote={quote} onDelete={handleDelete} onExportPDF={handleExportQuotePDF} onExportHTML={handleExportQuoteHTML} onRequestSignature={handleRequestSignature} onCopySignatureLink={handleCopySignatureLink} />
                  ))}
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
          </TabsContent>

          <TabsContent value="calendar">
            <GenericCalendarView
              events={quoteCalendarEvents}
              statusColors={quoteCalendarStatusColors}
              legend={quoteCalendarLegend}
            />
          </TabsContent>

          <TabsContent value="agenda">
            <GenericAgendaView
              items={quoteAgendaItems}
              dateField="date"
              onDelete={(item) => handleDelete(item.id)}
              paidStatuses={['accepted', 'rejected', 'expired', 'cancelled']}
            />
          </TabsContent>

          <TabsContent value="kanban">
            <GenericKanbanView
              columns={quoteKanbanColumns}
              items={quoteAgendaItems}
              onStatusChange={async (id, status) => await updateQuote(id, { status })}
              onDelete={(item) => handleDelete(item.id)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Quote Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('quotesPage.create')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client & Dates */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.client')} *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder={t('invoices.selectClient')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">{t('quotesPage.date')}</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('invoices.dueDate')}</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.lineItems')}</Label>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <Input
                      placeholder={t('invoices.description')}
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.quantity')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.unitPrice')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-500 text-xs">{t('invoices.taxRate')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(index, 'tax_rate', e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length <= 1}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full">
                <Plus className="w-4 h-4 mr-2" /> {t('quotesPage.addLine')}
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{t('quotesPage.subtotal')}</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('quotesPage.vat')}</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-gradient font-bold text-base border-t border-gray-700 pt-2">
                <span>{t('quotesPage.totalInclVat')}</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('timesheets.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('quotesPage.notesPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting || !formData.client_id} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('quotesPage.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Signature Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={(open) => { setSignatureDialogOpen(open); if (!open) { setSignatureLink(''); setSignerEmail(''); } }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('quotesPage.requestSignature')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">{t('quotesPage.signerEmail')}</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="client@example.com"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            {signatureLink && (
              <div className="space-y-2">
                <Label className="text-gray-300">{t('quotesPage.signatureLink')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={signatureLink}
                    readOnly
                    className="bg-gray-800 border-gray-700 text-gray-300 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyGeneratedLink}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setSignatureDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={signatureSubmitting}
              onClick={handleSendSignatureRequest}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {signatureSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
              {t('quotesPage.sendSignatureRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuotesPage;
