
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { useTranslation } from 'react-i18next';

/**
 * Reusable component for PDF and HTML export actions with automatic credit consumption.
 *
 * Usage:
 *   <ExportActions
 *     onExportPDF={handleExportPDF}
 *     onExportHTML={handleExportHTML}
 *     pdfCostKey="PDF_INVOICE"
 *     htmlCostKey="EXPORT_HTML"
 *     data={invoiceData}
 *   />
 *
 * @param {Function} onExportPDF - Callback function for PDF export
 * @param {Function} onExportHTML - Callback function for HTML export
 * @param {string} pdfCostKey - Key from CREDIT_COSTS for PDF export (default: 'PDF_REPORT')
 * @param {string} htmlCostKey - Key from CREDIT_COSTS for HTML export (default: 'EXPORT_HTML')
 * @param {boolean} loading - Loading state for buttons
 * @param {boolean} disabled - Disabled state for buttons
 * @param {any} data - Data to pass to export callbacks
 * @param {boolean} showHTML - Whether to show HTML export button (default: true)
 */
export const ExportActions = ({
  onExportPDF,
  onExportHTML,
  pdfCostKey = 'PDF_REPORT',
  htmlCostKey = 'EXPORT_HTML',
  loading = false,
  disabled = false,
  data = null,
  showHTML = true
}) => {
  const { t } = useTranslation();
  const { guardedAction, modalProps } = useCreditsGuard();

  const handlePDF = () => {
    guardedAction(
      CREDIT_COSTS[pdfCostKey],
      t(`credits.costs.${pdfCostKey}`),
      () => onExportPDF(data)
    );
  };

  const handleHTML = () => {
    guardedAction(
      CREDIT_COSTS[htmlCostKey],
      t(`credits.costs.${htmlCostKey}`),
      () => onExportHTML(data)
    );
  };

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <div className="flex gap-2">
        <Button
          onClick={handlePDF}
          disabled={disabled || loading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          PDF ({CREDIT_COSTS[pdfCostKey]} {t('credits.creditsLabel')})
        </Button>

        {showHTML && (
          <Button
            onClick={handleHTML}
            disabled={disabled || loading}
            variant="outline"
            className="border-gray-600 hover:bg-gray-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            HTML ({CREDIT_COSTS[htmlCostKey]} {t('credits.creditsLabel')})
          </Button>
        )}
      </div>
    </>
  );
};

export default ExportActions;
