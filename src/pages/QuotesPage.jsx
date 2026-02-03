
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useQuotes } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportQuotePDF, exportQuoteHTML } from '@/services/exportDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileSignature, Trash2, Loader2, Search, List, CalendarDays, CalendarClock, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
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

const emptyItem = { description: '', quantity: 1, unit_price: 0, tax_rate: 21 };

const initialFormData = {
  client_id: '',
  date: new Date().toISOString().split('T')[0],
  due_date: '',
  notes: '',
  status: 'draft',
  items: [{ ...emptyItem }],
};

const QuoteCard = ({ quote, onDelete, onExportPDF, onExportHTML }) => {
  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-700',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-800',
    accepted: 'bg-green-500/20 text-green-400 border-green-800',
    rejected: 'bg-red-500/20 text-red-400 border-red-800',
    expired: 'bg-yellow-500/20 text-yellow-400 border-yellow-800',
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
          <p className="text-sm text-gray-400">{quote.client?.company_name || 'No client'}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border capitalize ${statusColors[quote.status] || statusColors.draft}`}>
          {quote.status}
        </span>
      </div>
      <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <span>{quote.date ? new Date(quote.date).toLocaleDateString() : '—'}</span>
        <span className="text-gradient font-bold text-lg">{formatCurrency(quote.total || quote.total_ttc || 0)}</span>
      </div>
      {quote.notes && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{quote.notes}</p>}
      <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportPDF(quote)}
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
          title="Export PDF (2 crédits)"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportHTML(quote)}
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
          title="Export HTML (2 crédits)"
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
    </motion.div>
  );
};

const QuotesPage = () => {
  const { t } = useTranslation();
  const { quotes, loading, createQuote, deleteQuote } = useQuotes();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const quoteCalendarStatusColors = {
    draft: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    sent: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    accepted: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    rejected: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
    expired: { bg: '#eab308', border: '#ca8a04', text: '#000' },
  };

  const quoteCalendarLegend = [
    { label: 'Draft', color: '#6b7280' },
    { label: 'Sent', color: '#3b82f6' },
    { label: 'Accepted', color: '#22c55e' },
    { label: 'Rejected', color: '#ef4444' },
    { label: 'Expired', color: '#eab308' },
  ];

  const quoteCalendarEvents = quotes.map(q => ({
    id: q.id,
    title: `${q.quote_number || ''} - ${q.client?.company_name || 'No client'}`,
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
      subtitle: q.client?.company_name || 'No client',
      date: q.date,
      status: q.status || 'draft',
      statusLabel: (q.status || 'draft').charAt(0).toUpperCase() + (q.status || 'draft').slice(1),
      statusColor: statusColorMap[q.status] || 'bg-gray-500/20 text-gray-400',
      amount: formatCurrency(q.total || q.total_ttc || 0),
    };
  });

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch =
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.client?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || q.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleOpenDialog = () => {
    setFormData({ ...initialFormData, items: [{ ...emptyItem }] });
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
        date: formData.date || new Date().toISOString().split('T')[0],
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
      setFormData({ ...initialFormData, items: [{ ...emptyItem }] });
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

  const { totalHT, totalTax, totalTTC} = calculateTotals();

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>Quotes - {t('app.name')}</title>
      </Helmet>

      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              Quotes
            </h1>
            <p className="text-gray-400 text-sm md:text-base">Manage proposals and estimates</p>
          </div>
          <Button onClick={handleOpenDialog} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Quote
          </Button>
        </div>

        {quotes.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search quotes..."
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {['all', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                <Button
                  key={s}
                  variant={filterStatus === s ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(s)}
                  className={`capitalize flex-shrink-0 ${filterStatus === s ? 'bg-orange-500' : 'border-gray-800 text-gray-400'}`}
                >
                  {s}
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
                <h3 className="text-xl font-bold text-gradient mb-2">No quotes yet</h3>
                <p className="text-gray-400 mb-6">Create your first quote to send to a client.</p>
                <Button onClick={handleOpenDialog} variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
                  Create Quote
                </Button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredQuotes.map(quote => (
                  <QuoteCard key={quote.id} quote={quote} onDelete={handleDelete} onExportPDF={handleExportQuotePDF} onExportHTML={handleExportQuoteHTML} />
                ))}
              </div>
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
        </Tabs>
      </div>

      {/* Create Quote Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">Create Quote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client & Dates */}
            <div className="space-y-2">
              <Label className="text-gray-300">Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a client" />
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
                <Label className="text-gray-300">Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Due Date</Label>
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
              <Label className="text-gray-300">Line Items</Label>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-gray-500 text-xs">Qty</Label>
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
                        <Label className="text-gray-500 text-xs">Unit Price</Label>
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
                        <Label className="text-gray-500 text-xs">Tax %</Label>
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
                <Plus className="w-4 h-4 mr-2" /> Add Line
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal (excl. VAT)</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>VAT</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-gradient font-bold text-base border-t border-gray-700 pt-2">
                <span>Total (incl. VAT)</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="bg-gray-800 border-gray-700 text-white min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !formData.client_id} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Quote
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuotesPage;
