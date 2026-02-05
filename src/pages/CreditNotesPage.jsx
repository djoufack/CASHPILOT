import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportCreditNotePDF, exportCreditNoteHTML } from '@/services/exportDocuments';
import { formatCurrency } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, FileText, Search, List, CalendarDays, CalendarClock, Download, Kanban } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';

const CreditNotesPage = () => {
  const { t } = useTranslation();
  const { creditNotes, loading, createCreditNote, deleteCreditNote, updateCreditNote } = useCreditNotes();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    invoice_id: '',
    client_id: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    tax_rate: 20,
    status: 'draft'
  });
  const [items, setItems] = useState([
    { id: '1', description: '', quantity: 1, unitPrice: 0 }
  ]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totalHT = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  const taxAmount = totalHT * (Number(formData.tax_rate) / 100);
  const totalTTC = totalHT + taxAmount;

  const handleCreate = async () => {
    try {
      await createCreditNote({
        ...formData,
        total_ht: totalHT,
        tax_amount: taxAmount,
        total_ttc: totalTTC
      }, items);
      setShowCreate(false);
      resetForm();
    } catch (err) {
      // handled by hook
    }
  };

  const resetForm = () => {
    setFormData({ invoice_id: '', client_id: '', date: new Date().toISOString().split('T')[0], reason: '', tax_rate: 20, status: 'draft' });
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleExportCreditNotePDF = (cn) => {
    guardedAction(
      CREDIT_COSTS.PDF_CREDIT_NOTE,
      t('credits.costs.pdfCreditNote'),
      async () => {
        const enrichedCN = {
          ...cn,
          items,
          client: clients.find(c => c.id === cn.client_id)
        };
        await exportCreditNotePDF(enrichedCN, company);
      }
    );
  };

  const handleExportCreditNoteHTML = (cn) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const enrichedCN = {
          ...cn,
          items,
          client: clients.find(c => c.id === cn.client_id)
        };
        exportCreditNoteHTML(enrichedCN, company);
      }
    );
  };

  // When invoice is selected, auto-fill client
  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setFormData(prev => ({
      ...prev,
      invoice_id: invoiceId,
      client_id: inv?.client_id || prev.client_id,
      tax_rate: inv?.tax_rate || prev.tax_rate
    }));
    // Auto-populate items from invoice
    if (inv?.items && inv.items.length > 0) {
      setItems(inv.items.map(item => ({
        id: item.id || Date.now().toString(),
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price || item.unitPrice || 0)
      })));
    }
  };

  const filteredNotes = creditNotes.filter(cn => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      cn.credit_note_number?.toLowerCase().includes(s) ||
      cn.client?.company_name?.toLowerCase().includes(s) ||
      cn.reason?.toLowerCase().includes(s)
    );
  });

  const pagination = usePagination({ pageSize: 20 });

  // Update pagination total count when filtered notes change
  useEffect(() => {
    pagination.setTotalCount(filteredNotes.length);
  }, [filteredNotes.length]);

  // Client-side paginated data for the list view
  const paginatedNotes = filteredNotes.slice(pagination.from, pagination.to + 1);

  const [viewMode, setViewMode] = useState('list');

  const statusColors = {
    draft: 'bg-gray-500',
    issued: 'bg-blue-500',
    applied: 'bg-green-500',
    cancelled: 'bg-red-500'
  };

  const cnCalendarStatusColors = {
    draft: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    issued: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    applied: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    cancelled: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  };

  const cnCalendarLegend = [
    { label: t('creditNotes.status.draft'), color: '#6b7280' },
    { label: t('creditNotes.status.issued'), color: '#3b82f6' },
    { label: t('creditNotes.status.applied'), color: '#22c55e' },
    { label: t('creditNotes.status.cancelled'), color: '#ef4444' },
  ];

  const cnCalendarEvents = creditNotes.map(cn => ({
    id: cn.id,
    title: `${cn.credit_note_number || ''} - ${cn.client?.company_name || '-'}`,
    date: cn.date,
    status: cn.status || 'draft',
    resource: cn,
  }));

  const cnKanbanColumns = [
    { id: 'draft', title: t('status.draft') || 'Draft', color: 'bg-gray-500/20 text-gray-400' },
    { id: 'issued', title: t('status.issued') || 'Issued', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'applied', title: t('status.applied') || 'Applied', color: 'bg-green-500/20 text-green-400' },
  ];

  const cnAgendaItems = creditNotes.map(cn => {
    const currency = cn.client?.preferred_currency || 'EUR';
    const statusColorMap = {
      draft: 'bg-gray-500/20 text-gray-400',
      issued: 'bg-blue-500/20 text-blue-400',
      applied: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return {
      id: cn.id,
      title: cn.credit_note_number || '',
      subtitle: cn.client?.company_name || '-',
      date: cn.date,
      status: cn.status || 'draft',
      statusLabel: t(`creditNotes.status.${cn.status}`) || cn.status,
      statusColor: statusColorMap[cn.status] || 'bg-gray-500/20 text-gray-400',
      amount: formatCurrency(Number(cn.total_ttc || 0), currency),
    };
  });

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{t('creditNotes.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('creditNotes.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />{t('creditNotes.create')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="bg-gray-800 border-gray-700 text-white pl-10" placeholder={t('common.search')} />
      </div>

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
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                    <th className="text-left p-4">{t('creditNotes.number')}</th>
                    <th className="text-left p-4">{t('timesheets.client')}</th>
                    <th className="text-left p-4">{t('creditNotes.linkedInvoice')}</th>
                    <th className="text-left p-4">{t('timesheets.date')}</th>
                    <th className="text-right p-4">{t('invoices.totalTTC')}</th>
                    <th className="text-center p-4">{t('common.status')}</th>
                    <th className="text-center p-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center p-8 text-gray-400">Loading...</td></tr>
                  ) : filteredNotes.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-gray-400">{t('creditNotes.noNotes')}</td></tr>
                  ) : paginatedNotes.map((cn) => {
                    const currency = cn.client?.preferred_currency || 'EUR';
                    return (
                      <motion.tr key={cn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="p-4 font-mono text-sm">{cn.credit_note_number}</td>
                        <td className="p-4">{cn.client?.company_name || '-'}</td>
                        <td className="p-4 text-sm text-gray-400">{cn.invoice?.invoice_number || '-'}</td>
                        <td className="p-4 text-sm">{cn.date ? format(new Date(cn.date), 'dd/MM/yyyy') : '-'}</td>
                        <td className="p-4 text-right font-semibold">{formatCurrency(Number(cn.total_ttc || 0), currency)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[cn.status] || 'bg-gray-500'}`}>
                            {t(`creditNotes.status.${cn.status}`)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            {cn.status === 'draft' && (
                              <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs"
                                onClick={() => updateCreditNote(cn.id, { status: 'issued' })}>
                                {t('creditNotes.issue')}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300 h-8" title="Export PDF (2 crédits)"
                              onClick={() => handleExportCreditNotePDF(cn)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 h-8" title="Export HTML (2 crédits)"
                              onClick={() => handleExportCreditNoteHTML(cn)}>
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-8"
                              onClick={() => deleteCreditNote(cn.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        </TabsContent>

        <TabsContent value="calendar">
          <GenericCalendarView
            events={cnCalendarEvents}
            statusColors={cnCalendarStatusColors}
            legend={cnCalendarLegend}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <GenericAgendaView
            items={cnAgendaItems}
            dateField="date"
            onDelete={(item) => deleteCreditNote(item.id)}
            paidStatuses={['applied', 'cancelled']}
          />
        </TabsContent>

        <TabsContent value="kanban">
          <GenericKanbanView
            columns={cnKanbanColumns}
            items={cnAgendaItems}
            onStatusChange={async (itemId, newStatus) => {
              await updateCreditNote(itemId, { status: newStatus });
            }}
            onDelete={(item) => deleteCreditNote(item.id)}
          />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient">{t('creditNotes.create')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Invoice selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('creditNotes.linkedInvoice')}</Label>
                <Select value={formData.invoice_id} onValueChange={handleInvoiceSelect}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder={t('creditNotes.selectInvoice')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    {invoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {inv.client?.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('timesheets.client')}</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder={t('invoices.selectClient')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name || c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('timesheets.date')}</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))} className="bg-gray-700 border-gray-600 text-white" />
              </div>
              <div className="space-y-2">
                <Label>{t('invoices.taxRate')} (%)</Label>
                <Input type="number" value={formData.tax_rate} onChange={(e) => setFormData(p => ({ ...p, tax_rate: Number(e.target.value) }))} className="bg-gray-700 border-gray-600 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('creditNotes.reason')}</Label>
              <Textarea value={formData.reason} onChange={(e) => setFormData(p => ({ ...p, reason: e.target.value }))} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" placeholder={t('creditNotes.reasonPlaceholder')} />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t('creditNotes.items')}</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8">
                  <Plus className="w-3 h-3 mr-1" /> {t('invoices.addManualLine')}
                </Button>
              </div>
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 bg-gray-700/30 p-2 rounded items-end">
                  <div className="col-span-6">
                    <Input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder={t('invoices.description')} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-right" min="0" step="0.01" />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-right" min="0" step="0.01" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={items.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-gray-700/30 p-4 rounded space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">{t('invoices.totalHT')}</span><span>{formatCurrency(totalHT, 'EUR')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">{t('invoices.taxAmount')} ({formData.tax_rate}%)</span><span>{formatCurrency(taxAmount, 'EUR')}</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-600 pt-2"><span className="text-gradient">{t('invoices.totalTTC')}</span><span className="text-gradient">{formatCurrency(totalTTC, 'EUR')}</span></div>
            </div>

            <Button onClick={handleCreate} className="w-full bg-orange-500 hover:bg-orange-600" disabled={!formData.client_id || items.length === 0}>
              <FileText className="w-4 h-4 mr-2" />{t('creditNotes.generate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default CreditNotesPage;
