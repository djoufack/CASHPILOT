
import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useClients } from '@/hooks/useClients';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportPurchaseOrderPDF, exportPurchaseOrderHTML } from '@/services/exportDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ClipboardList, Trash2, Loader2, Search, List, CalendarDays, CalendarClock, Kanban, Download, FileText, Eye, Pencil } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDefaultTaxRate } from '@/hooks/useDefaultTaxRate';

const DEFAULT_TAX_RATE_FALLBACK = 0;
const createEmptyItem = (taxRate = DEFAULT_TAX_RATE_FALLBACK) => ({ description: '', quantity: 1, unit_price: 0, tax_rate: taxRate });

const createInitialFormData = (taxRate = DEFAULT_TAX_RATE_FALLBACK) => ({
  client_id: '',
  date: formatDateInput(),
  due_date: '',
  notes: '',
  status: 'draft',
  items: [createEmptyItem(taxRate)],
});

const POCard = ({ po, onView, onEdit, onDelete, onExportPDF, onExportHTML }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-700',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-800',
    confirmed: 'bg-green-500/20 text-green-400 border-green-800',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-800',
    cancelled: 'bg-red-500/20 text-red-400 border-red-800',
  };

  const statusLabels = {
    draft: t('purchaseOrdersPage.statusDraft'),
    sent: t('purchaseOrdersPage.statusSent'),
    confirmed: t('purchaseOrdersPage.statusConfirmed'),
    completed: t('purchaseOrdersPage.statusCompleted'),
    cancelled: t('purchaseOrdersPage.statusCancelled'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gradient">{po.po_number}</h3>
          <p className="text-sm text-gray-400">{po.client?.company_name || t('timesheets.noClient')}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border capitalize ${statusColors[po.status] || statusColors.draft}`}>
          {statusLabels[po.status] || po.status}
        </span>
      </div>
      <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <span>{po.date ? new Date(po.date).toLocaleDateString(locale) : '—'}</span>
        <span className="text-gradient font-bold text-lg">{formatCurrency(po.total || 0)}</span>
      </div>
      {po.notes && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{po.notes}</p>}
      <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
        <Button variant="ghost" size="sm" onClick={() => onView(po)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20" title="Visualiser">
          <Eye className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(po)} className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20" title="Modifier">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportPDF(po)}
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
          title={t('purchaseOrdersPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_PURCHASE_ORDER })}
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExportHTML(po)}
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
          title={t('purchaseOrdersPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
        >
          <FileText className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(po.id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

const PurchaseOrdersPage = () => {
  const { t } = useTranslation();
  const { purchaseOrders, loading, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } = usePurchaseOrders();
  const { clients } = useClients();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const { defaultRate } = useDefaultTaxRate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(() => createInitialFormData());
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [viewPO, setViewPO] = useState(null);
  const [editPO, setEditPO] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const poCalendarStatusColors = {
    draft: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    sent: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    partial: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    confirmed: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    received: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    completed: { bg: '#10b981', border: '#059669', text: '#fff' },
    cancelled: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  };

  const poCalendarLegend = [
    { label: t('purchaseOrdersPage.statusDraft'), color: '#6b7280' },
    { label: t('purchaseOrdersPage.statusSent'), color: '#3b82f6' },
    { label: t('purchaseOrdersPage.statusPartial'), color: '#eab308' },
    { label: t('purchaseOrdersPage.statusConfirmed'), color: '#22c55e' },
    { label: t('purchaseOrdersPage.statusCancelled'), color: '#ef4444' },
  ];

  const poCalendarEvents = purchaseOrders.map(po => ({
    id: po.id,
    title: `${po.po_number || ''} - ${po.client?.company_name || t('timesheets.noClient')}`,
    date: po.date,
    status: po.status || 'draft',
    resource: po,
  }));

  const poAgendaItems = purchaseOrders.map(po => {
    const statusColorMap = {
      draft: 'bg-gray-500/20 text-gray-400',
      sent: 'bg-blue-500/20 text-blue-400',
      partial: 'bg-yellow-500/20 text-yellow-400',
      confirmed: 'bg-green-500/20 text-green-400',
      received: 'bg-green-500/20 text-green-400',
      completed: 'bg-emerald-500/20 text-emerald-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    const statusLabels = {
      draft: t('purchaseOrdersPage.statusDraft'),
      sent: t('purchaseOrdersPage.statusSent'),
      partial: t('purchaseOrdersPage.statusPartial'),
      confirmed: t('purchaseOrdersPage.statusConfirmed'),
      received: t('purchaseOrdersPage.statusReceived'),
      completed: t('purchaseOrdersPage.statusCompleted'),
      cancelled: t('purchaseOrdersPage.statusCancelled'),
    };
    return {
      id: po.id,
      title: po.po_number || '',
      subtitle: po.client?.company_name || t('timesheets.noClient'),
      date: po.date,
      status: po.status || 'draft',
      statusLabel: statusLabels[po.status] || po.status,
      statusColor: statusColorMap[po.status] || 'bg-gray-500/20 text-gray-400',
      amount: formatCurrency(po.total || 0),
    };
  });

  const poKanbanColumns = [
    { id: 'draft', title: t('purchaseOrdersPage.statusDraft'), color: 'bg-gray-500/20 text-gray-400' },
    { id: 'sent', title: t('purchaseOrdersPage.statusSent'), color: 'bg-blue-500/20 text-blue-400' },
    { id: 'confirmed', title: t('purchaseOrdersPage.statusConfirmed'), color: 'bg-green-500/20 text-green-400' },
    { id: 'completed', title: t('purchaseOrdersPage.statusCompleted'), color: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'cancelled', title: t('purchaseOrdersPage.statusCancelled'), color: 'bg-red-500/20 text-red-400' },
  ];

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch =
      po.po_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      po.client?.company_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesFilter = filterStatus === 'all' || po.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const pagination = usePagination({ pageSize: 20 });
  const { setTotalCount } = pagination;

  // Update pagination total count when filtered POs change
  useEffect(() => {
    setTotalCount(filteredPOs.length);
  }, [filteredPOs.length, setTotalCount]);

  // Client-side paginated data for the list view
  const paginatedPOs = filteredPOs.slice(pagination.from, pagination.to + 1);

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
      await createPurchaseOrder({
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
        total: totalTTC,
      });
      setIsDialogOpen(false);
      setFormData(createInitialFormData(defaultRate));
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePurchaseOrder(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error handled by hook toast
    }
  };

  const handleView = (po) => setViewPO(po);

  const handleEdit = (po) => {
    setEditPO(po);
    setEditFormData({
      client_id: po.client_id || '',
      date: po.date || formatDateInput(),
      due_date: po.due_date || '',
      notes: po.notes || '',
      status: po.status || 'draft',
      items: po.items && po.items.length > 0
        ? po.items.map(item => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            tax_rate: item.tax_rate ?? defaultRate ?? 0,
          }))
        : [createEmptyItem(defaultRate)],
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editPO || !editFormData.client_id) return;
    setEditSubmitting(true);
    let totalHT = 0;
    let totalTax = 0;
    editFormData.items.forEach(item => {
      const lineHT = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      totalHT += lineHT;
      totalTax += lineHT * ((parseFloat(item.tax_rate) || 0) / 100);
    });
    try {
      await updatePurchaseOrder(editPO.id, {
        client_id: editFormData.client_id,
        date: editFormData.date || formatDateInput(),
        due_date: editFormData.due_date || null,
        notes: editFormData.notes.trim() || null,
        status: editFormData.status,
        items: editFormData.items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          tax_rate: parseFloat(item.tax_rate) || 0,
        })),
        total: totalHT + totalTax,
      });
      setEditPO(null);
      setEditFormData(null);
    } catch {
      // Error handled by hook toast
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditItemChange = (index, field, value) => {
    const newItems = [...editFormData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditFormData({ ...editFormData, items: newItems });
  };

  const addEditItem = () => {
    setEditFormData({ ...editFormData, items: [...editFormData.items, createEmptyItem(defaultRate)] });
  };

  const removeEditItem = (index) => {
    if (editFormData.items.length <= 1) return;
    setEditFormData({ ...editFormData, items: editFormData.items.filter((_, i) => i !== index) });
  };

  const handleExportPurchaseOrderPDF = (po) => {
    guardedAction(
      CREDIT_COSTS.PDF_PURCHASE_ORDER,
      t('credits.costs.pdfPurchaseOrder'),
      async () => {
        const enrichedPO = {
          ...po,
          supplier: clients.find(c => c.id === po.client_id)
        };
        await exportPurchaseOrderPDF(enrichedPO, company);
      }
    );
  };

  const handleExportPurchaseOrderHTML = (po) => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      t('credits.costs.exportHtml'),
      () => {
        const enrichedPO = {
          ...po,
          supplier: clients.find(c => c.id === po.client_id)
        };
        exportPurchaseOrderHTML(enrichedPO, company);
      }
    );
  };

  const { totalHT, totalTax, totalTTC } = calculateTotals();

  return (
    <>
      <Helmet>
        <title>{t('purchaseOrdersPage.title')} - {t('app.name')}</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />

      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {t('purchaseOrdersPage.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-base">{t('purchaseOrdersPage.subtitle')}</p>
          </div>
          <Button onClick={handleOpenDialog} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="mr-2 h-4 w-4" /> {t('purchaseOrdersPage.create')}
          </Button>
        </div>

        {purchaseOrders.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder={t('purchaseOrdersPage.searchPlaceholder')}
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {[
                { value: 'all', label: t('purchaseOrdersPage.allStatuses') },
                { value: 'draft', label: t('purchaseOrdersPage.statusDraft') },
                { value: 'sent', label: t('purchaseOrdersPage.statusSent') },
                { value: 'confirmed', label: t('purchaseOrdersPage.statusConfirmed') },
                { value: 'completed', label: t('purchaseOrdersPage.statusCompleted') },
              ].map(s => (
                <Button
                  key={s.value}
                  variant={filterStatus === s.value ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(s.value)}
                  className={`flex-shrink-0 ${filterStatus === s.value ? 'bg-orange-500' : 'border-gray-800 text-gray-400'}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
          <TabsList className="bg-gray-800 border border-gray-700 mb-4">
            <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <List className="w-4 h-4 mr-2" /> {t('common.list') || 'Liste'}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
              <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar') || 'Calendrier'}
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
            ) : filteredPOs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-full bg-gray-900 border border-gray-800 rounded-xl p-8 md:p-12 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gray-800 rounded-full">
                    <ClipboardList className="w-12 h-12 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gradient mb-2">{t('purchaseOrdersPage.emptyTitle')}</h3>
                <p className="text-gray-400 mb-6">{t('purchaseOrdersPage.emptyDescription')}</p>
                <Button onClick={handleOpenDialog} variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
                  {t('purchaseOrdersPage.create')}
                </Button>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedPOs.map(po => (
                    <POCard key={po.id} po={po} onView={handleView} onEdit={handleEdit} onDelete={(id) => setDeleteTarget(purchaseOrders.find(p => p.id === id))} onExportPDF={handleExportPurchaseOrderPDF} onExportHTML={handleExportPurchaseOrderHTML} />
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
              events={poCalendarEvents}
              statusColors={poCalendarStatusColors}
              legend={poCalendarLegend}
              onSelectEvent={(po) => handleView(po)}
            />
          </TabsContent>

          <TabsContent value="agenda">
            <GenericAgendaView
              items={poAgendaItems}
              dateField="date"
              paidStatuses={['completed', 'received', 'cancelled']}
              renderActions={(item) => {
                const po = purchaseOrders.find(p => p.id === item.id);
                if (!po) return null;
                return (
                  <div className="flex gap-1">
                    <button onClick={() => handleView(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Visualiser"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleExportPurchaseOrderPDF(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="PDF"><Download className="w-4 h-4" /></button>
                    <button onClick={() => handleExportPurchaseOrderHTML(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="HTML"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTarget(po)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="kanban">
            <GenericKanbanView
              columns={poKanbanColumns}
              items={poAgendaItems}
              onStatusChange={async (id, status) => await updatePurchaseOrder(id, { status })}
              renderActions={(item) => {
                const po = purchaseOrders.find(p => p.id === item.id);
                if (!po) return null;
                return (
                  <div className="flex gap-1">
                    <button onClick={() => handleView(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Visualiser"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleExportPurchaseOrderPDF(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="PDF"><Download className="w-4 h-4" /></button>
                    <button onClick={() => handleExportPurchaseOrderHTML(po)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="HTML"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTarget(po)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create PO Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{t('purchaseOrdersPage.create')}</DialogTitle>
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
                <Label className="text-gray-300">{t('purchaseOrdersPage.deliveryDate')}</Label>
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
              <Label className="text-gray-300">{t('purchaseOrdersPage.items')}</Label>
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
                <Plus className="w-4 h-4 mr-2" /> {t('purchaseOrdersPage.addLine')}
              </Button>
            </div>

            {/* Totals */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{t('purchaseOrdersPage.subtotal')}</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('purchaseOrdersPage.vat')}</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between text-gradient font-bold text-base border-t border-gray-700 pt-2">
                <span>{t('purchaseOrdersPage.totalInclVat')}</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">{t('timesheets.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('purchaseOrdersPage.notesPlaceholder')}
                className="bg-gray-800 border-gray-700 text-white min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting || !formData.client_id} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View PO Dialog */}
      <Dialog open={!!viewPO} onOpenChange={() => setViewPO(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">{viewPO?.po_number}</DialogTitle>
          </DialogHeader>
          {viewPO && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Client</p>
                  <p className="text-white font-medium">{viewPO.client?.company_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Statut</p>
                  <p className="text-white capitalize">{viewPO.status || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Date</p>
                  <p className="text-white">{viewPO.date ? new Date(viewPO.date).toLocaleDateString('fr-FR') : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Date de livraison</p>
                  <p className="text-white">{viewPO.due_date ? new Date(viewPO.due_date).toLocaleDateString('fr-FR') : '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase">Total</p>
                  <p className="text-gradient font-bold text-lg">{formatCurrency(viewPO.total || 0)}</p>
                </div>
              </div>
              {viewPO.items && viewPO.items.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Lignes</p>
                  <div className="bg-gray-800/50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left p-2 text-gray-400">Description</th>
                          <th className="text-right p-2 text-gray-400">Qté</th>
                          <th className="text-right p-2 text-gray-400">P.U.</th>
                          <th className="text-right p-2 text-gray-400">TVA</th>
                          <th className="text-right p-2 text-gray-400">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewPO.items.map((item, i) => {
                          const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
                          return (
                            <tr key={i} className="border-b border-gray-700/50">
                              <td className="p-2 text-white">{item.description || '—'}</td>
                              <td className="p-2 text-right text-gray-300">{item.quantity}</td>
                              <td className="p-2 text-right text-gray-300">{formatCurrency(item.unit_price || 0)}</td>
                              <td className="p-2 text-right text-gray-300">{item.tax_rate || 0}%</td>
                              <td className="p-2 text-right text-gradient font-medium">{formatCurrency(lineTotal * (1 + (item.tax_rate || 0) / 100))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {viewPO.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                  <p className="text-gray-300 text-sm mt-1">{viewPO.notes}</p>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button size="sm" variant="outline" className="border-gray-600" onClick={() => handleExportPurchaseOrderPDF(viewPO)}>
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button size="sm" variant="outline" className="border-gray-600" onClick={() => handleExportPurchaseOrderHTML(viewPO)}>
                  <FileText className="w-4 h-4 mr-2" /> HTML
                </Button>
                <Button size="sm" onClick={() => { handleEdit(viewPO); setViewPO(null); }} className="bg-orange-500 hover:bg-orange-600">
                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit PO Dialog */}
      <Dialog open={!!editPO} onOpenChange={() => { setEditPO(null); setEditFormData(null); }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">Modifier {editPO?.po_number}</DialogTitle>
          </DialogHeader>
          {editFormData && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">{t('quotesPage.client')} *</Label>
                <Select value={editFormData.client_id} onValueChange={(value) => setEditFormData({ ...editFormData, client_id: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder={t('invoices.selectClient')} /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">{client.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">{t('quotesPage.date')}</Label>
                  <Input type="date" value={editFormData.date} onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">{t('purchaseOrdersPage.deliveryDate')}</Label>
                  <Input type="date" value={editFormData.due_date} onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Statut</Label>
                <Select value={editFormData.status} onValueChange={(val) => setEditFormData({ ...editFormData, status: val })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="draft" className="text-white hover:bg-gray-700">{t('purchaseOrdersPage.statusDraft')}</SelectItem>
                    <SelectItem value="sent" className="text-white hover:bg-gray-700">{t('purchaseOrdersPage.statusSent')}</SelectItem>
                    <SelectItem value="confirmed" className="text-white hover:bg-gray-700">{t('purchaseOrdersPage.statusConfirmed')}</SelectItem>
                    <SelectItem value="completed" className="text-white hover:bg-gray-700">{t('purchaseOrdersPage.statusCompleted')}</SelectItem>
                    <SelectItem value="cancelled" className="text-white hover:bg-gray-700">{t('purchaseOrdersPage.statusCancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('purchaseOrdersPage.items')}</Label>
                <div className="space-y-3">
                  {editFormData.items.map((item, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                      <Input placeholder={t('invoices.description')} value={item.description} onChange={(e) => handleEditItemChange(index, 'description', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-gray-500 text-xs">{t('invoices.quantity')}</Label>
                          <Input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        </div>
                        <div>
                          <Label className="text-gray-500 text-xs">{t('invoices.unitPrice')}</Label>
                          <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => handleEditItemChange(index, 'unit_price', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        </div>
                        <div>
                          <Label className="text-gray-500 text-xs">{t('invoices.taxRate')}</Label>
                          <Input type="number" min="0" step="0.01" value={item.tax_rate} onChange={(e) => handleEditItemChange(index, 'tax_rate', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeEditItem(index)} disabled={editFormData.items.length <= 1} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addEditItem} className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full">
                  <Plus className="w-4 h-4 mr-2" /> {t('purchaseOrdersPage.addLine')}
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('timesheets.notes')}</Label>
                <Textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder={t('purchaseOrdersPage.notesPlaceholder')} className="bg-gray-800 border-gray-700 text-white min-h-[60px]" />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => { setEditPO(null); setEditFormData(null); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">{t('common.cancel')}</Button>
                <Button type="submit" disabled={editSubmitting || !editFormData.client_id} className="bg-orange-500 hover:bg-orange-600 text-white">
                  {editSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bon de commande ?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {deleteTarget && (<>Vous allez supprimer <strong className="text-white">"{deleteTarget.po_number}"</strong> ({formatCurrency(deleteTarget.total || 0)}). Cette action est irréversible.</>)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PurchaseOrdersPage;

