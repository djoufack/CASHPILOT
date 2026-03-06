import React, { useState } from 'react';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import UploadInvoiceModal from '@/components/UploadInvoiceModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import GenericKanbanView from '@/components/GenericKanbanView';
import RejectApprovalDialog from '@/components/suppliers/RejectApprovalDialog';
import { Plus, Trash2, Sparkles, FileText, List, CalendarDays, CalendarClock, Kanban, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const statusColors = {
  pending: 'bg-yellow-600',
  paid: 'bg-green-600',
  overdue: 'bg-red-600',
};

const SupplierInvoices = ({ supplierId }) => {
  const { invoices, loading, createInvoice, createLineItems, deleteInvoice, updateStatus, updateApprovalStatus, getSignedUrl } = useSupplierInvoices(supplierId);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [rejectTargetInvoice, setRejectTargetInvoice] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const { t } = useTranslation();

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

  const siCalendarEvents = invoices.map(inv => ({
    id: inv.id,
    title: inv.invoice_number || '',
    date: inv.invoice_date,
    status: inv.payment_status || 'pending',
    resource: inv,
  }));

  // Agenda + Kanban items (same shape)
  const siAgendaItems = invoices.map(inv => {
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
      amount: `${parseFloat(inv.total_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${inv.currency || 'EUR'}`,
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
                        {parseFloat(inv.total_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.currency || 'EUR'}
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
                            <SelectItem value="approved">{t('supplierInvoices.approvalApproved', 'Approved')}</SelectItem>
                            <SelectItem value="rejected">{t('supplierInvoices.approvalRejected', 'Rejected')}</SelectItem>
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
                          <Button variant="ghost" size="sm"
                            className="text-gray-400 hover:text-blue-400 h-7 w-7 p-0"
                            title={t('supplierInvoices.viewDocument')}
                            onClick={async () => {
                              const url = await getSignedUrl(inv.file_url);
                              if (url) window.open(url, '_blank');
                            }}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteInvoice(inv.id)}
                          className="text-gray-400 hover:text-red-400 h-7 w-7 p-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            onSelectEvent={(inv) => {/* optional */}}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <GenericAgendaView
            items={siAgendaItems}
            dateField="date"
            onDelete={(item) => deleteInvoice(item.id)}
            paidStatuses={['paid']}
          />
        </TabsContent>

        <TabsContent value="kanban">
          <GenericKanbanView
            columns={siKanbanColumns}
            items={siAgendaItems}
            onStatusChange={(id, status) => updateStatus(id, status)}
            onDelete={(item) => deleteInvoice(item.id)}
          />
        </TabsContent>
      </Tabs>

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
