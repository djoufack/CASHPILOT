
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useQuotes } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportQuotePDF, exportQuoteHTML, generateQuoteHTML } from '@/services/exportDocuments';
import { exportToCSV, exportToExcel } from '@/utils/exportService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileSignature, Loader2, Search, List, CalendarDays, CalendarClock, Download, Kanban, LayoutGrid } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { usePagination } from '@/hooks/usePagination';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import { formatDateInput } from '@/utils/dateFormatting';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate';

import QuoteListTable from '@/components/quotes/QuoteListTable';
import QuoteGalleryView from '@/components/quotes/QuoteGalleryView';
import QuoteDialogs from '@/components/quotes/QuoteDialogs';

const DEFAULT_TAX_RATE_FALLBACK = 20;
const createEmptyItem = (taxRate = DEFAULT_TAX_RATE_FALLBACK) => ({ description: '', quantity: 1, unit_price: 0, tax_rate: taxRate });

const createInitialFormData = (taxRate = DEFAULT_TAX_RATE_FALLBACK) => ({
  client_id: '',
  date: formatDateInput(),
  due_date: '',
  notes: '',
  status: 'draft',
  items: [createEmptyItem(taxRate)],
});

const QuotesPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { quotes, loading, createQuote, updateQuote, deleteQuote } = useQuotes();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { defaultRate } = useDefaultTaxRate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(() => createInitialFormData());
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [viewingQuote, setViewingQuote] = useState(null);

  // Signature dialog state
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureQuote, setSignatureQuote] = useState(null);
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureLink, setSignatureLink] = useState('');
  const [signatureSubmitting, setSignatureSubmitting] = useState(false);

  // Calendar/Agenda/Kanban data
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
      amount: formatCurrency(q.total_ttc || 0),
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

  useEffect(() => {
    setTotalCount(filteredQuotes.length);
  }, [filteredQuotes.length, setTotalCount]);

  const paginatedQuotes = filteredQuotes.slice(pagination.from, pagination.to + 1);

  // Handlers
  const handleOpenDialog = () => {
    setFormData(createInitialFormData(defaultRate));
    setIsDialogOpen(true);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, createEmptyItem(defaultRate)] });
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
      });
      setIsDialogOpen(false);
      setFormData(createInitialFormData(defaultRate));
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

  const getQuoteClient = (quote) => clients.find(c => c.id === quote.client_id) || quote.client || null;
  const getEnrichedQuote = (quote) => ({ ...quote, client: getQuoteClient(quote) });

  const handleExportQuotePDF = (quote) => {
    guardedAction(CREDIT_COSTS.PDF_QUOTE, t('credits.costs.pdfQuote'), async () => {
      await exportQuotePDF(getEnrichedQuote(quote), company);
    });
  };

  const handleExportQuoteHTML = (quote) => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, t('credits.costs.exportHtml'), () => {
      exportQuoteHTML(getEnrichedQuote(quote), company);
    });
  };

  const handleViewQuote = (quote) => setViewingQuote(getEnrichedQuote(quote));

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

  const quotePreviewDocument = (quote) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${quote?.quote_number || 'Devis'}</title>
  <style>
    body { margin: 0; padding: 0; background: #ffffff; }
  </style>
</head>
<body>
  ${generateQuoteHTML(getEnrichedQuote(quote), company)}
</body>
</html>`;

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
      [t('invoices.totalTTC')]: q.total_ttc || '',
      [t('quotesPage.status')]: statusLabels[q.status] || q.status || '',
      [t('quotesPage.date')]: q.date || '',
    }));
    if (format === 'csv') {
      exportToCSV(exportData, 'quotes');
    } else {
      exportToExcel(exportData, 'quotes');
    }
  };

  const { totalHT, totalTax, totalTTC } = calculateTotals();

  // Shared props for list/gallery sub-components
  const viewProps = {
    filteredQuotes,
    paginatedQuotes,
    loading,
    pagination,
    getQuoteClient,
    onViewQuote: handleViewQuote,
    onExportPDF: handleExportQuotePDF,
    onExportHTML: handleExportQuoteHTML,
    onDelete: handleDelete,
    onRequestSignature: handleRequestSignature,
    onCopySignatureLink: handleCopySignatureLink,
    onOpenDialog: handleOpenDialog,
  };

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
            <QuoteListTable {...viewProps} />
          </TabsContent>

          <TabsContent value="gallery">
            <QuoteGalleryView {...viewProps} />
          </TabsContent>

          <TabsContent value="calendar">
            <GenericCalendarView
              events={quoteCalendarEvents}
              statusColors={quoteCalendarStatusColors}
              legend={quoteCalendarLegend}
              onSelectEvent={(quote) => handleViewQuote(quote)}
            />
          </TabsContent>

          <TabsContent value="agenda">
            <GenericAgendaView
              items={quoteAgendaItems}
              dateField="date"
              onView={(item) => handleViewQuote(quotes.find(q => q.id === item.id))}
              onDelete={(item) => handleDelete(item.id)}
              paidStatuses={['accepted', 'rejected', 'expired', 'cancelled']}
            />
          </TabsContent>

          <TabsContent value="kanban">
            <GenericKanbanView
              columns={quoteKanbanColumns}
              items={quoteAgendaItems}
              onStatusChange={async (id, status) => await updateQuote(id, { status })}
              onView={(item) => handleViewQuote(quotes.find(q => q.id === item.id))}
              onDelete={(item) => handleDelete(item.id)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <QuoteDialogs
        viewingQuote={viewingQuote}
        setViewingQuote={setViewingQuote}
        quotePreviewDocument={quotePreviewDocument}
        onExportPDF={handleExportQuotePDF}
        onExportHTML={handleExportQuoteHTML}
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        handleSubmit={handleSubmit}
        handleItemChange={handleItemChange}
        addItem={addItem}
        removeItem={removeItem}
        clients={clients}
        totalHT={totalHT}
        totalTax={totalTax}
        totalTTC={totalTTC}
        signatureDialogOpen={signatureDialogOpen}
        setSignatureDialogOpen={setSignatureDialogOpen}
        signerEmail={signerEmail}
        setSignerEmail={setSignerEmail}
        signatureLink={signatureLink}
        setSignatureLink={setSignatureLink}
        signatureSubmitting={signatureSubmitting}
        handleSendSignatureRequest={handleSendSignatureRequest}
        handleCopyGeneratedLink={handleCopyGeneratedLink}
      />
    </>
  );
};

export default QuotesPage;
