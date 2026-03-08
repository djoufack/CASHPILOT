import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, FileText, Download, FileSignature, Copy, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/calculations';
import { CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import PaginationControls from '@/components/PaginationControls';

const QuoteGalleryView = ({
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginatedQuotes.map((quote) => {
          const client = getQuoteClient(quote);
          const signatureStatus = quote.signature_status || 'unsigned';

          return (
            <div
              key={quote.id}
              className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gradient">{quote.quote_number}</p>
                  <p className="text-xs text-gray-400 mt-1">{client?.company_name || t('timesheets.noClient')}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[quote.status] || statusColors.draft}`}>
                    {statusLabels[quote.status] || quote.status || '-'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${signatureColors[signatureStatus] || signatureColors.unsigned}`}>
                    {signatureLabels[signatureStatus] || signatureLabels.unsigned}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400">{t('quotesPage.date')}</p>
                  <p className="text-gray-200 mt-1">{quote.date ? new Date(quote.date).toLocaleDateString('fr-FR') : '-'}</p>
                </div>
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                  <p className="text-gray-400">{t('invoices.dueDate')}</p>
                  <p className="text-gray-200 mt-1">{quote.due_date ? new Date(quote.due_date).toLocaleDateString('fr-FR') : '-'}</p>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-2">
                <p className="text-gray-400 text-xs">{t('invoices.total')}</p>
                <p className="text-gray-100 font-semibold mt-1">{formatCurrency(quote.total_ttc || 0)}</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewQuote(quote)}
                  className="border-blue-500/40 text-blue-300 hover:bg-blue-900/20 h-8 px-2"
                  title={t('common.view') || 'Visualiser'}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportPDF(quote)}
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-900/20 h-8 px-2"
                  title={t('quotesPage.exportPdfTitle', { credits: CREDIT_COSTS.PDF_QUOTE })}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportHTML(quote)}
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/20 h-8 px-2"
                  title={t('quotesPage.exportHtmlTitle', { credits: CREDIT_COSTS.EXPORT_HTML })}
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-700">
                {(!quote.signature_status || quote.signature_status === 'unsigned') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRequestSignature(quote)}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8 w-8 p-0"
                    title={t('quotesPage.requestSignature')}
                  >
                    <FileSignature className="w-4 h-4" />
                  </Button>
                )}
                {quote.signature_status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopySignatureLink(quote)}
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 h-8 w-8 p-0"
                    title={t('quotesPage.copySignatureLink')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(quote.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                  title={t('common.delete') || 'Supprimer'}
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

export default memo(QuoteGalleryView);
