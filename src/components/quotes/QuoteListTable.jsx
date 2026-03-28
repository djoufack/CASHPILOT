import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, Download, FileSignature, Copy, Loader2, CircleOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import { CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import PaginationControls from '@/components/PaginationControls';

const QuoteListTable = ({
  filteredQuotes,
  paginatedQuotes,
  loading,
  pagination,
  getQuoteClient,
  onViewQuote,
  onExportPDF,
  onExportHTML,
  onDelete,
  onRequestSignature,
  onCopySignatureLink,
  onConvertToContract,
  onMarkAsLost,
  onOpenDialog,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (filteredQuotes.length === 0) {
    return (
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
        <Button onClick={onOpenDialog} variant="outline" className="border-gray-700 text-gray-300 w-full md:w-auto">
          {t('quotesPage.create')}
        </Button>
      </motion.div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-300 border border-gray-700',
    sent: 'bg-blue-500/20 text-blue-300 border border-blue-700',
    accepted: 'bg-green-500/20 text-green-300 border border-green-700',
    rejected: 'bg-red-500/20 text-red-300 border border-red-700',
    expired: 'bg-yellow-500/20 text-yellow-300 border border-yellow-700',
  };
  const statusLabels = {
    draft: t('quotesPage.statusDraft'),
    sent: t('quotesPage.statusSent'),
    accepted: t('quotesPage.statusAccepted'),
    rejected: t('quotesPage.statusRejected'),
    expired: t('quotesPage.statusExpired'),
  };
  const documentTypeLabels = {
    quote: t('quotesPage.documentTypeQuote'),
    contract: t('quotesPage.documentTypeContract'),
  };
  const signatureColors = {
    signed: 'bg-green-900/30 text-green-300 border border-green-800',
    pending: 'bg-orange-900/30 text-orange-300 border border-orange-800',
    rejected: 'bg-red-900/30 text-red-300 border border-red-800',
    unsigned: 'bg-gray-900/40 text-gray-300 border border-gray-700',
  };
  const signatureLabels = {
    signed: t('quotesPage.signatureSigned'),
    pending: t('quotesPage.signaturePending'),
    rejected: t('quotesPage.signatureRejected'),
    unsigned: t('quotesPage.signatureUnsigned') || 'Non signe',
  };
  const lossReasonLabels = {
    budget: t('quotesPage.lossReasonCategories.budget'),
    timing: t('quotesPage.lossReasonCategories.timing'),
    competition: t('quotesPage.lossReasonCategories.competition'),
    scope: t('quotesPage.lossReasonCategories.scope'),
    no_response: t('quotesPage.lossReasonCategories.no_response'),
    other: t('quotesPage.lossReasonCategories.other'),
  };

  const getNextBestActionLabel = (actionCode) => {
    if (!actionCode) return t('quotesPage.nextBestActions.monitor_quote');
    const translated = t(`quotesPage.nextBestActions.${actionCode}`);
    return translated === `quotesPage.nextBestActions.${actionCode}` ? actionCode : translated;
  };

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
                {t('quotesPage.documents') || 'Documents'}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('quotesPage.documentType')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('quotesPage.quoteNumber')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                {t('quotesPage.client')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                {t('quotesPage.date')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('invoices.total')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('quotesPage.status')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                {t('quotesPage.signatureStatus') || 'Signature'}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                {t('quotesPage.lossReason')}
              </th>
              <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                {t('quotesPage.nextBestAction')}
              </th>
              <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedQuotes.map((quote) => {
              const client = getQuoteClient(quote);
              const signatureStatus = quote.signature_status || 'unsigned';

              return (
                <tr key={quote.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewQuote(quote)}
                        className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                        title={t('common.view') || 'Visualiser'}
                        aria-label={t('common.view') || 'Visualiser'}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">{t('common.view') || 'Visualiser'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportPDF(quote)}
                        className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
                        title={t('quotesPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_QUOTE })}
                        aria-label={t('quotesPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_QUOTE })}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">PDF</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportHTML(quote)}
                        className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
                        title={t('quotesPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
                        aria-label={t('quotesPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="hidden xl:inline ml-1">HTML</span>
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${quote.document_type === 'contract' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-700' : 'bg-slate-500/20 text-slate-300 border border-slate-700'}`}
                    >
                      {documentTypeLabels[quote.document_type] || documentTypeLabels.quote}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gradient">
                    {quote.quote_number}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                    {client?.company_name || t('timesheets.noClient')}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                    {quote.date ? new Date(quote.date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-100 font-medium">
                    {formatCurrency(quote.total_ttc || 0)}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[quote.status] || statusColors.draft}`}
                    >
                      {statusLabels[quote.status] || quote.status || '-'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden lg:table-cell">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${signatureColors[signatureStatus] || signatureColors.unsigned}`}
                    >
                      {signatureLabels[signatureStatus] || signatureLabels.unsigned}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-300 hidden xl:table-cell max-w-[180px]">
                    {quote.loss_reason_category ? (
                      <div className="space-y-1">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/20 text-red-300 border border-red-800">
                          {lossReasonLabels[quote.loss_reason_category] || quote.loss_reason_category}
                        </span>
                        {quote.loss_reason_details ? (
                          <p className="text-xs text-gray-400 line-clamp-2">{quote.loss_reason_details}</p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">{t('quotesPage.lossReasonNotProvided')}</span>
                    )}
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-200 hidden xl:table-cell max-w-[220px]">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/20 text-blue-300 border border-blue-800">
                      {getNextBestActionLabel(quote.next_best_action)}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      {(!quote.signature_status || quote.signature_status === 'unsigned') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestSignature(quote)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                          title={t('quotesPage.requestSignature')}
                          aria-label={t('quotesPage.requestSignature')}
                        >
                          <FileSignature className="w-4 h-4" />
                        </Button>
                      )}
                      {quote.signature_status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCopySignatureLink(quote)}
                          className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 px-2"
                          title={t('quotesPage.copySignatureLink')}
                          aria-label={t('quotesPage.copySignatureLink')}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                      {quote.document_type !== 'contract' && onConvertToContract && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onConvertToContract(quote.id)}
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 h-8 px-2"
                          title={t('quotesPage.convertToContractTitle', { number: quote.quote_number })}
                          aria-label={t('quotesPage.convertToContract')}
                        >
                          <span className="hidden xl:inline">{t('quotesPage.convertToContract')}</span>
                        </Button>
                      )}
                      {onMarkAsLost && !['accepted', 'rejected', 'expired'].includes(quote.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMarkAsLost(quote)}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 h-8 px-2"
                          title={t('quotesPage.markAsLost')}
                          aria-label={t('quotesPage.markAsLost')}
                        >
                          <CircleOff className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(quote.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 px-2"
                        title={t('common.delete') || 'Supprimer'}
                        aria-label={t('common.delete') || 'Supprimer'}
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

export default memo(QuoteListTable);
