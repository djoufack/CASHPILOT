import { useState } from 'react';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import { useCompany } from '@/hooks/useCompany';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { exportSupplierInvoicePDF, exportSupplierInvoiceHTML } from '@/services/exportSupplierRecords';
import UploadInvoiceModal from '@/components/UploadInvoiceModal';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/utils/dateLocale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import RejectApprovalDialog from '@/components/suppliers/RejectApprovalDialog';
import {
  Plus,
  Trash2,
  Sparkles,
  FileText,
  List,
  CalendarDays,
  CalendarClock,
  Kanban,
  ExternalLink,
  Eye,
  Pencil,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_EDIT_FORM = {
  invoice_number: '',
  invoice_date: '',
  due_date: '',
  total_amount: '',
  currency: 'EUR',
  payment_status: 'pending',
  approval_status: 'pending',
};

const SupplierInvoices = ({ supplierId, supplier }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { company } = useCompany();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const {
    invoices,
    loading,
    createInvoice,
    updateInvoice,
    createLineItems,
    deleteInvoice,
    updateStatus,
    updateApprovalStatus,
    getSignedUrl,
  } = useSupplierInvoices(supplierId);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [rejectTargetInvoice, setRejectTargetInvoice] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const handleUploadSuccess = async (formData, file) => {
    const invoiceData = {
      invoice_number: formData.invoice_number,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date || null,
      total_amount: parseFloat(formData.total_amount) || 0,
      vat_amount: formData.total_tva ? parseFloat(formData.total_tva) : null,
      vat_rate: parseFloat(formData.vat_rate) || 0,
      payment_status: formData.payment_status,
      approval_status: formData.approval_status || 'pending',
      total_ht: formData.total_ht ? parseFloat(formData.total_ht) : null,
      total_ttc: formData.total_ttc ? parseFloat(formData.total_ttc) : null,
      currency: formData.currency || 'EUR',
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
    };

    const result = await createInvoice(invoiceData, file);

    if (result && formData.ai_raw_response?.line_items?.length) {
      await createLineItems(result.id, formData.ai_raw_response.line_items);
    }
  };

  const openEditModal = (invoice) => {
    setEditingInvoice(invoice);
    setEditForm({
      invoice_number: invoice.invoice_number || '',
      invoice_date: invoice.invoice_date || '',
      due_date: invoice.due_date || '',
      total_amount: invoice.total_amount ?? '',
      currency: invoice.currency || 'EUR',
      payment_status: invoice.payment_status || 'pending',
      approval_status: invoice.approval_status || 'pending',
    });
  };

  const closeEditModal = () => {
    setEditingInvoice(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;

    await updateInvoice(editingInvoice.id, {
      invoice_number: editForm.invoice_number,
      invoice_date: editForm.invoice_date,
      due_date: editForm.due_date || null,
      total_amount: Number(editForm.total_amount || 0),
      currency: editForm.currency || 'EUR',
      payment_status: editForm.payment_status,
      approval_status: editForm.approval_status,
    });

    closeEditModal();
  };

  const handleExportPdf = async (invoice) => {
    try {
      await exportSupplierInvoicePDF(invoice, supplier, company, invoiceSettings);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error?.message || t('common.exportError', "Echec de l'export PDF"),
        variant: 'destructive',
      });
    }
  };

  const handleExportHtml = async (invoice) => {
    try {
      await exportSupplierInvoiceHTML(invoice, supplier, company, invoiceSettings);
    } catch (error) {
      toast({
        title: t('common.error', 'Erreur'),
        description: error?.message || t('common.exportError', "Echec de l'export HTML"),
        variant: 'destructive',
      });
    }
  };

  // Calendar configuration
  const siCalendarStatusColors = {
    pending: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    paid: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    overdue: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  };

  const siCalendarLegend = [
    { label: t('supplierInvoices.statusPending'), color: '#eab308' },
    { label: t('supplierInvoices.statusPaid'), color: '#22c55e' },
    { label: t('supplierInvoices.statusOverdue'), color: '#ef4444' },
  ];

  const siCalendarEvents = invoices.map((inv) => ({
    id: inv.id,
    title: inv.invoice_number || '',
    date: inv.invoice_date,
    status: inv.payment_status || 'pending',
    resource: inv,
  }));

  const siAgendaItems = invoices.map((inv) => {
    const ps = inv.payment_status || 'pending';
    const colorMap = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      paid: 'bg-green-500/20 text-green-400',
      overdue: 'bg-red-500/20 text-red-400',
    };
    return {
      id: inv.id,
      title: inv.invoice_number || '',
      subtitle: inv.supplier_name_extracted || '',
      date: inv.invoice_date,
      status: ps,
      payment_status: ps,
      statusLabel: t(`supplierInvoices.status${ps.charAt(0).toUpperCase()}${ps.slice(1)}`),
      statusColor: colorMap[ps] || 'bg-gray-500/20 text-gray-400',
      amount: `${formatNumber(parseFloat(inv.total_amount || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${inv.currency || 'EUR'}`,
    };
  });

  const siKanbanColumns = [
    { id: 'pending', title: t('supplierInvoices.statusPending'), color: 'bg-yellow-500/20 text-yellow-400' },
    { id: 'paid', title: t('supplierInvoices.statusPaid'), color: 'bg-green-500/20 text-green-400' },
    { id: 'overdue', title: t('supplierInvoices.statusOverdue'), color: 'bg-red-500/20 text-red-400' },
  ];

  const handleApprovalSelect = (invoice, nextStatus) => {
    if (nextStatus === 'rejected') {
      setRejectTargetInvoice(invoice);
      setRejectReason(invoice?.rejected_reason || '');
      return;
    }

    updateApprovalStatus(invoice.id, nextStatus);
  };

  const handleConfirmReject = async () => {
    if (!rejectTargetInvoice) return;
    await updateApprovalStatus(rejectTargetInvoice.id, 'rejected', rejectReason);
    setRejectTargetInvoice(null);
    setRejectReason('');
  };

  const renderInlineExports = (item) => {
    const invoice = invoices.find((entry) => entry.id === item.id);
    if (!invoice) return null;
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2 text-xs"
          onClick={() => handleExportPdf(invoice)}
        >
          <Download className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7 px-2 text-xs"
          onClick={() => handleExportHtml(invoice)}
        >
          <FileText className="w-3 h-3" />
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gradient text-lg font-bold">{t('supplierInvoices.title')}</h3>
        <Button onClick={() => setIsUploadOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" />
          {t('supplierInvoices.uploadInvoice')}
        </Button>
      </div>

      <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
        <TabsList className="bg-gray-800 border border-gray-700 mb-4">
          <TabsTrigger
            value="list"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
          >
            <List className="w-4 h-4 mr-2" /> {t('common.list') || 'List'}
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
          {loading ? (
            <div className="text-center py-8 text-gray-400">{t('loading.data')}</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 bg-gray-900/50 rounded border border-gray-800 text-center text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{t('supplierInvoices.noInvoices')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="py-2 px-3 text-left">{t('supplierInvoices.invoiceNumber')}</th>
                    <th className="py-2 px-3 text-left">{t('supplierInvoices.date')}</th>
                    <th className="py-2 px-3 text-right">{t('supplierInvoices.amount')}</th>
                    <th className="py-2 px-3 text-center">{t('supplierInvoices.status')}</th>
                    <th className="py-2 px-3 text-center">{t('supplierInvoices.colApproval', 'Approval')}</th>
                    <th className="py-2 px-3 text-center">{t('supplierInvoices.source')}</th>
                    <th className="py-2 px-3 text-center">{t('supplierInvoices.document')}</th>
                    <th className="py-2 px-3 text-right">{t('supplierInvoices.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-medium text-white">{inv.invoice_number}</td>
                      <td className="py-2 px-3 text-gray-300">{inv.invoice_date}</td>
                      <td className="py-2 px-3 text-right text-white">
                        {formatNumber(parseFloat(inv.total_amount || 0), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {inv.currency || 'EUR'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Select value={inv.payment_status} onValueChange={(val) => updateStatus(inv.id, val)}>
                          <SelectTrigger className="h-7 w-24 bg-transparent border-gray-700 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="pending">{t('supplierInvoices.statusPending')}</SelectItem>
                            <SelectItem value="paid">{t('supplierInvoices.statusPaid')}</SelectItem>
                            <SelectItem value="overdue">{t('supplierInvoices.statusOverdue')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Select
                          value={inv.approval_status || 'pending'}
                          onValueChange={(val) => handleApprovalSelect(inv, val)}
                        >
                          <SelectTrigger className="h-7 w-28 bg-transparent border-gray-700 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="pending">{t('supplierInvoices.approvalPending', 'Pending')}</SelectItem>
                            <SelectItem value="approved">
                              {t('supplierInvoices.approvalApproved', 'Approved')}
                            </SelectItem>
                            <SelectItem value="rejected">
                              {t('supplierInvoices.approvalRejected', 'Rejected')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {inv.ai_extracted && (
                          <Badge className="bg-purple-600 text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {inv.file_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-blue-400 h-7 w-7 p-0"
                            title={t('supplierInvoices.viewDocument')}
                            onClick={async () => {
                              const url = await getSignedUrl(inv.file_url);
                              if (url) window.open(url, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-400 hover:text-blue-300 h-7 w-7 p-0"
                            onClick={() => setViewingInvoice(inv)}
                            title="Visualiser"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-400 hover:text-orange-300 h-7 w-7 p-0"
                            onClick={() => openEditModal(inv)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-400 hover:text-purple-300 h-7 w-7 p-0"
                            onClick={() => handleExportPdf(inv)}
                            title="Export PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-cyan-400 hover:text-cyan-300 h-7 w-7 p-0"
                            onClick={() => handleExportHtml(inv)}
                            title="Export HTML"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvoice(inv.id)}
                            className="text-gray-400 hover:text-red-400 h-7 w-7 p-0"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <GenericCalendarView
            events={siCalendarEvents}
            statusColors={siCalendarStatusColors}
            legend={siCalendarLegend}
            onSelectEvent={(inv) => setViewingInvoice(inv.resource || inv)}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <GenericAgendaView
            items={siAgendaItems}
            dateField="date"
            onView={(item) => setViewingInvoice(invoices.find((inv) => inv.id === item.id))}
            onEdit={(item) => {
              const invoice = invoices.find((inv) => inv.id === item.id);
              if (invoice) openEditModal(invoice);
            }}
            onDelete={(item) => deleteInvoice(item.id)}
            renderActions={renderInlineExports}
            paidStatuses={['paid']}
          />
        </TabsContent>

        <TabsContent value="kanban">
          <GenericKanbanView
            columns={siKanbanColumns}
            items={siAgendaItems}
            onStatusChange={(id, status) => updateStatus(id, status)}
            onView={(item) => setViewingInvoice(invoices.find((inv) => inv.id === item.id))}
            onEdit={(item) => {
              const invoice = invoices.find((inv) => inv.id === item.id);
              if (invoice) openEditModal(invoice);
            }}
            onDelete={(item) => deleteInvoice(item.id)}
            renderActions={renderInlineExports}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t('common.view', 'Visualiser')} - {viewingInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400">{t('supplierInvoices.date')}</p>
                  <p className="font-semibold">{viewingInvoice.invoice_date || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierInvoices.amount')}</p>
                  <p className="font-semibold">
                    {formatNumber(parseFloat(viewingInvoice.total_amount || 0), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {viewingInvoice.currency || 'EUR'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierInvoices.status')}</p>
                  <p className="font-semibold capitalize">{viewingInvoice.payment_status || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('supplierInvoices.colApproval', 'Approval')}</p>
                  <p className="font-semibold capitalize">{viewingInvoice.approval_status || '-'}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportPdf(viewingInvoice)}>
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" className="border-gray-700" onClick={() => handleExportHtml(viewingInvoice)}>
                  <FileText className="w-4 h-4 mr-2" /> HTML
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t('common.edit', 'Modifier')} - {editingInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('supplierInvoices.invoiceNumber')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={editForm.invoice_number}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierInvoices.amount')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="number"
                  value={editForm.total_amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, total_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierInvoices.date')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="date"
                  value={editForm.invoice_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, invoice_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierInvoices.dueDate', 'Date echeance')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('common.currency', 'Devise')}</Label>
                <Input
                  className="bg-gray-800 border-gray-700"
                  value={editForm.currency}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierInvoices.status')}</Label>
                <Select
                  value={editForm.payment_status}
                  onValueChange={(val) => setEditForm((prev) => ({ ...prev, payment_status: val }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="pending">{t('supplierInvoices.statusPending')}</SelectItem>
                    <SelectItem value="paid">{t('supplierInvoices.statusPaid')}</SelectItem>
                    <SelectItem value="overdue">{t('supplierInvoices.statusOverdue')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="border-gray-700" onClick={closeEditModal}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                {t('common.save', 'Enregistrer')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <UploadInvoiceModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        supplierId={supplierId}
        onUploadSuccess={handleUploadSuccess}
      />

      <RejectApprovalDialog
        open={!!rejectTargetInvoice}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleConfirmReject}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTargetInvoice(null);
            setRejectReason('');
          }
        }}
      />
    </div>
  );
};

export default SupplierInvoices;
