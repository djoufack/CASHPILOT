import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Trash2,
  FileText,
  FileUp,
  DollarSign,
  History,
  Download,
  FileArchive,
  Mail,
  Loader2,
  Link,
  Copy,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';
import PaginationControls from '@/components/PaginationControls';

const InvoiceListTable = ({ data, actions, ui }) => {
  const { invoices, paginatedInvoices, clients, pagination } = data;
  const {
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
    onUploadDocument,
  } = actions;
  const { emailSending, paymentLinkLoading, uploadingDocument, getStatusColor, getPaymentStatusBadge } = ui;
  const { t } = useTranslation();

  if (invoices.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden"
      >
        <div className="text-center py-12 text-gray-400">{t('invoices.noInvoices')}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('common.documents', 'Documents')}
              </th>
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
                {t('common.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedInvoices.map((invoice) => {
              const client = clients.find((c) => c.id === (invoice.client_id || invoice.clientId));
              const currency = client?.preferred_currency || client?.preferredCurrency || 'EUR';
              return (
                <tr key={invoice.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewInvoice(invoice)}
                        className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                        title={t('common.view') || 'Visualiser'}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">{t('common.view') || 'Visualiser'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportPDF(invoice)}
                        className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
                        title="Export PDF (2 credits)"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">PDF</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportHTML(invoice)}
                        className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
                        title="Export HTML (2 credits)"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">HTML</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportFacturX(invoice)}
                        className="border-teal-500/40 text-teal-300 hover:bg-teal-900/20 h-8 px-2"
                        title={`${t('invoices.exportFacturXXml', 'Export XML (Factur-X)')} (2 ${t('credits.creditsLabel')})`}
                      >
                        <FileArchive className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">
                          {t('invoices.exportFacturXXml', 'Export XML (Factur-X)')}
                        </span>
                      </Button>
                      <Button
                        variant="upload3d"
                        size="sm"
                        onClick={() => onUploadDocument(invoice)}
                        className="h-8 px-2 font-semibold"
                        title="Televerser + scanner le document"
                        disabled={uploadingDocument}
                      >
                        <FileUp className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">Upload</span>
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-400">
                    {invoice.invoice_number || invoice.invoiceNumber}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                    {client?.company_name || client?.companyName || 'Unknown'}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                    {invoice.date || invoice.issueDate
                      ? format(new Date(invoice.date || invoice.issueDate), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {formatCurrency(Number(invoice.total_ttc || invoice.total || 0), currency)}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
                    <span
                      className={
                        Number(invoice.balance_due || 0) > 0 ? 'text-orange-400 font-medium' : 'text-green-400'
                      }
                    >
                      {formatCurrency(Number(invoice.balance_due || invoice.total_ttc || 0), currency)}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-1">
                      <Select value={invoice.status} onValueChange={(value) => onStatusChange(invoice.id, value)}>
                        <SelectTrigger
                          className={`w-28 md:w-32 ${getStatusColor(invoice.status)} text-white border-none h-8`}
                        >
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
                      {invoice.status !== 'paid' &&
                        (invoice.stripe_payment_link_url ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onCopyPaymentLink(invoice.stripe_payment_link_url)}
                              className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                              aria-label={t('invoices.copyPaymentLink')}
                              title={t('invoices.copyPaymentLink')}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.stripe_payment_link_url, '_blank')}
                              className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 w-8 p-0"
                              aria-label={t('invoices.openPaymentLink')}
                              title={t('invoices.openPaymentLink')}
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
                            className="text-violet-400 hover:text-violet-300 hover:bg-violet-900/20 h-8 px-2"
                            aria-label={t('invoices.generatePaymentLink')}
                            title={t('invoices.generatePaymentLink')}
                          >
                            {paymentLinkLoading[invoice.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Link className="w-4 h-4" />
                            )}
                          </Button>
                        ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteClick(invoice)}
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

export default memo(InvoiceListTable);
