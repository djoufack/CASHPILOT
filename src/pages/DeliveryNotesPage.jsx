import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportDeliveryNotePDF, exportDeliveryNoteHTML } from '@/services/exportDocuments';
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
import { Plus, Trash2, Truck, Search, List, CalendarDays, CalendarClock, Download, FileText, Kanban } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';

const DeliveryNotesPage = () => {
  const { t } = useTranslation();
  const { deliveryNotes, loading, createDeliveryNote, deleteDeliveryNote, updateDeliveryNote } = useDeliveryNotes();
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
    delivery_address: '',
    carrier: '',
    tracking_number: '',
    notes: '',
    status: 'pending'
  });
  const [items, setItems] = useState([
    { id: '1', description: '', quantity: 1, unit: 'pcs' }
  ]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unit: 'pcs' }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleCreate = async () => {
    try {
      await createDeliveryNote(formData, items);
      setShowCreate(false);
      resetForm();
    } catch (err) {
      // handled
    }
  };

  const resetForm = () => {
    setFormData({ invoice_id: '', client_id: '', date: new Date().toISOString().split('T')[0], delivery_address: '', carrier: '', tracking_number: '', notes: '', status: 'pending' });
    setItems([{ id: '1', description: '', quantity: 1, unit: 'pcs' }]);
  };

  const handleExportDeliveryNotePDF = (dn) => {
    guardedAction(
      CREDIT_COSTS.PDF_DELIVERY_NOTE,
      t('credits.costs.pdfDeliveryNote'),
      async () => {
        const enrichedDN = {
          ...dn,
          items,
          client: clients.find(c => c.id === dn.client_id)
        };
        await exportDeliveryNotePDF(enrichedDN, company);
      }
    );
  };

  const handleExportDeliveryNoteHTML = (dn) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const enrichedDN = {
          ...dn,
          items,
          client: clients.find(c => c.id === dn.client_id)
        };
        exportDeliveryNoteHTML(enrichedDN, company);
      }
    );
  };

  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setFormData(prev => ({
      ...prev,
      invoice_id: invoiceId,
      client_id: inv?.client_id || prev.client_id
    }));
    if (inv?.items && inv.items.length > 0) {
      setItems(inv.items.map(item => ({
        id: item.id || Date.now().toString(),
        description: item.description,
        quantity: Number(item.quantity),
        unit: 'pcs'
      })));
    }
  };

  const filteredNotes = deliveryNotes.filter(dn => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      dn.delivery_note_number?.toLowerCase().includes(s) ||
      dn.client?.company_name?.toLowerCase().includes(s) ||
      dn.carrier?.toLowerCase().includes(s) ||
      dn.tracking_number?.toLowerCase().includes(s)
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
    pending: 'bg-yellow-500',
    shipped: 'bg-blue-500',
    delivered: 'bg-green-500',
    cancelled: 'bg-red-500'
  };

  const dnCalendarStatusColors = {
    pending: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    draft: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    shipped: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    delivered: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    cancelled: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  };

  const dnCalendarLegend = [
    { label: 'Pending', color: '#eab308' },
    { label: 'Shipped', color: '#3b82f6' },
    { label: 'Delivered', color: '#22c55e' },
    { label: 'Cancelled', color: '#ef4444' },
  ];

  const dnCalendarEvents = deliveryNotes.map(dn => ({
    id: dn.id,
    title: `${dn.delivery_note_number || ''} - ${dn.client?.company_name || '-'}`,
    date: dn.date,
    status: dn.status || 'pending',
    resource: dn,
  }));

  const dnKanbanColumns = [
    { id: 'pending', title: t('status.pending') || 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
    { id: 'shipped', title: t('status.shipped') || 'Shipped', color: 'bg-blue-500/20 text-blue-400' },
    { id: 'delivered', title: t('status.delivered') || 'Delivered', color: 'bg-green-500/20 text-green-400' },
  ];

  const dnAgendaItems = deliveryNotes.map(dn => {
    const statusColorMap = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      draft: 'bg-gray-500/20 text-gray-400',
      shipped: 'bg-blue-500/20 text-blue-400',
      delivered: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return {
      id: dn.id,
      title: dn.delivery_note_number || '',
      subtitle: dn.client?.company_name || '-',
      date: dn.date,
      status: dn.status || 'pending',
      statusLabel: t(`deliveryNotes.status.${dn.status}`) || dn.status,
      statusColor: statusColorMap[dn.status] || 'bg-gray-500/20 text-gray-400',
    };
  });

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{t('deliveryNotes.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('deliveryNotes.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />{t('deliveryNotes.create')}
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
                    <th className="text-left p-4">{t('deliveryNotes.number')}</th>
                    <th className="text-left p-4">{t('timesheets.client')}</th>
                    <th className="text-left p-4">{t('deliveryNotes.linkedInvoice')}</th>
                    <th className="text-left p-4">{t('timesheets.date')}</th>
                    <th className="text-left p-4">{t('deliveryNotes.carrier')}</th>
                    <th className="text-left p-4">{t('deliveryNotes.tracking')}</th>
                    <th className="text-center p-4">{t('common.status')}</th>
                    <th className="text-center p-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center p-8 text-gray-400">Loading...</td></tr>
                  ) : filteredNotes.length === 0 ? (
                    <tr><td colSpan={8} className="text-center p-8 text-gray-400">{t('deliveryNotes.noNotes')}</td></tr>
                  ) : paginatedNotes.map((dn) => (
                    <motion.tr key={dn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="p-4 font-mono text-sm">{dn.delivery_note_number}</td>
                      <td className="p-4">{dn.client?.company_name || '-'}</td>
                      <td className="p-4 text-sm text-gray-400">{dn.invoice?.invoice_number || '-'}</td>
                      <td className="p-4 text-sm">{dn.date ? format(new Date(dn.date), 'dd/MM/yyyy') : '-'}</td>
                      <td className="p-4 text-sm">{dn.carrier || '-'}</td>
                      <td className="p-4 text-sm font-mono">{dn.tracking_number || '-'}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[dn.status] || 'bg-gray-500'}`}>
                          {t(`deliveryNotes.status.${dn.status}`)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {dn.status === 'pending' && (
                            <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 h-8 text-xs"
                              onClick={() => updateDeliveryNote(dn.id, { status: 'shipped' })}>
                              {t('deliveryNotes.markShipped')}
                            </Button>
                          )}
                          {dn.status === 'shipped' && (
                            <Button size="sm" variant="outline" className="border-green-600 text-green-400 hover:bg-green-900/20 h-8 text-xs"
                              onClick={() => updateDeliveryNote(dn.id, { status: 'delivered' })}>
                              {t('deliveryNotes.markDelivered')}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300 h-8" title="Export PDF (2 crédits)"
                            onClick={() => handleExportDeliveryNotePDF(dn)}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-cyan-300 h-8" title="Export HTML (2 crédits)"
                            onClick={() => handleExportDeliveryNoteHTML(dn)}>
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-8"
                            onClick={() => deleteDeliveryNote(dn.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
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
            events={dnCalendarEvents}
            statusColors={dnCalendarStatusColors}
            legend={dnCalendarLegend}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <GenericAgendaView
            items={dnAgendaItems}
            dateField="date"
            onDelete={(item) => deleteDeliveryNote(item.id)}
            paidStatuses={['delivered', 'cancelled']}
          />
        </TabsContent>

        <TabsContent value="kanban">
          <GenericKanbanView
            columns={dnKanbanColumns}
            items={dnAgendaItems}
            onStatusChange={async (itemId, newStatus) => {
              await updateDeliveryNote(itemId, { status: newStatus });
            }}
            onDelete={(item) => deleteDeliveryNote(item.id)}
          />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient">{t('deliveryNotes.create')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deliveryNotes.linkedInvoice')}</Label>
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
                <Label>{t('deliveryNotes.carrier')}</Label>
                <Input value={formData.carrier} onChange={(e) => setFormData(p => ({ ...p, carrier: e.target.value }))} className="bg-gray-700 border-gray-600 text-white" placeholder="DHL, UPS, FedEx..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deliveryNotes.tracking')}</Label>
                <Input value={formData.tracking_number} onChange={(e) => setFormData(p => ({ ...p, tracking_number: e.target.value }))} className="bg-gray-700 border-gray-600 text-white" placeholder="1Z999AA..." />
              </div>
              <div className="space-y-2">
                <Label>{t('deliveryNotes.deliveryAddress')}</Label>
                <Input value={formData.delivery_address} onChange={(e) => setFormData(p => ({ ...p, delivery_address: e.target.value }))} className="bg-gray-700 border-gray-600 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('timesheets.notes')}</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} className="bg-gray-700 border-gray-600 text-white resize-none" />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t('deliveryNotes.items')}</Label>
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
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="bg-gray-700 border-gray-600 text-white text-right" min="0" step="1" />
                  </div>
                  <div className="col-span-3">
                    <Input value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="pcs, kg, m..." />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" disabled={items.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleCreate} className="w-full bg-orange-500 hover:bg-orange-600" disabled={!formData.client_id || items.length === 0}>
              <Truck className="w-4 h-4 mr-2" />{t('deliveryNotes.generate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default DeliveryNotesPage;
