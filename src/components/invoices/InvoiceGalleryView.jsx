import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, DollarSign, History, Download, FileArchive, Mail, Loader2, Link, Copy } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';
import PaginationControls from '@/components/PaginationControls';

const InvoiceGalleryView = ({
  invoices,
  paginatedInvoices,
  clients,
  pagination,
  onViewInvoice,
  onDeleteClick,
  onExportPDF,
  onExportHTML,
  onExportFacturX,
  onStatusChange,
  onRecordPayment,
  onOpenHistory,
  onOpenEmailModal,
  onGeneratePaymentLink,
  onCopyPaymentLink,
  emailSending,
  paymentLinkLoading,
  getStatusColor,
  getPaymentStatusBadge,
  INVOICE_STATUS_COLORS,
}) => {
  const { t } = useTranslation();

  if (invoices.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl text-center py-12 text-gray-400">
        {t('invoices.noInvoices')}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginatedInvoices.map((invoice) => {
          const client = clients.find(c => c.id === (invoice.client_id || invoice.clientId));
          const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
          const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
          const issueDate = invoice.date || invoice.issueDate;
          const dueDate = invoice.due_date || invoice.dueDate;
          const hasPaymentLink = !!invoice.stripe_payment_link_url;

          return (
            <div
              key={invoice.id}
              className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gradient">{invoiceNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">{client?.company_name || client?.companyName || 'Unknown'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status] || INVOICE_STATUS_COLORS.draft}`}>
                    {t(`status.${invoice.status || 'draft'}`)}
                  </span>
                  {getPaymentStatusBadge(invoice.payment_status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400">{t('invoices.issueDate')}</p>
                  <p className="text-gray-200 mt-1">{issueDate ? format(new Date(issueDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400">{t('invoices.dueDate')}</p>
                  <p className="text-gray-200 mt-1">{dueDate ? format(new Date(dueDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400 text-xs">{t('invoices.total')}</p>
                  <p className="text-gray-100 font-semibold mt-1">{formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}</p>
                </div>
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400 text-xs">{t('payments.balanceDue')}</p>
                  <p className={`font-semibold mt-1 ${Number(invoice.balance_due || 0) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0), currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewInvoice(invoice)}
                  className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                  title={t('common.view') || 'Visualiser'}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportPDF(invoice)}
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
                  title="Export PDF"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportHTML(invoice)}
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
                  title="Export HTML"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportFacturX(invoice)}
                  className="border-teal-500/40 text-teal-300 hover:bg-teal-900/20 h-8 px-2"
                  title={t('invoices.exportFacturXXml', 'Export XML (Factur-X)')}
                >
                  <FileArchive className="w-4 h-4" />
                </Button>
                <div className="ml-auto">
                  <Select
                    value={invoice.status}
                    onValueChange={(value) => onStatusChange(invoice.id, value)}
                  >
                    <SelectTrigger className={`w-28 ${getStatusColor(invoice.status)} text-white border-none h-8 text-xs`}>
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
              </div>

              <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRecordPayment(invoice)}
                  className="text-green-400 hover:text-green-300 hover:bg-green-900/20 h-8 w-8 p-0"
                  title={t('payments.recordPayment')}
                >
                  <DollarSign className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenHistory(invoice)}
                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
                  title={t('payments.history')}
                >
                  <History className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenEmailModal(invoice)}
                  disabled={emailSending}
                  className="text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 h-8 w-8 p-0"
                  title={t('invoices.sendByEmail')}
                >
                  <Mail className="w-4 h-4" />
                </Button>
                {invoice.status !== 'paid' && (
                  hasPaymentLink ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopyPaymentLink(invoice.stripe_payment_link_url)}
                        className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                        title={t('invoices.copyPaymentLink')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.stripe_payment_link_url, '_blank')}
                        className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                        title={t('invoices.copyPaymentLink')}
                      >
                        <Link className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onGeneratePaymentLink(invoice)}
                      disabled={!!paymentLinkLoading[invoice.id]}
                      className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                      title={t('invoices.generatePaymentLink')}
                    >
                      {paymentLinkLoading[invoice.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link className="w-4 h-4" />
                      )}
                    </Button>
                  )
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteClick(invoice)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                  title={t('common.delete') || 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
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
    </motion.div>
  );
};

export default InvoiceGalleryView;
