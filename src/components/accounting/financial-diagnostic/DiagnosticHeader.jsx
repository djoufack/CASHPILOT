import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, FileDown, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COMPARISON_OPTIONS } from './diagnosticConstants';

const DiagnosticHeader = ({ period, comparisonMode, comparisonPeriodLabel, onExportPDF, onExportHTML }) => {
  const { t } = useTranslation();

  const formatPeriodLabel = () => {
    if (!period?.startDate || !period?.endDate) return '';
    try {
      const start = format(new Date(period.startDate), 'dd MMMM yyyy', { locale: fr });
      const end = format(new Date(period.endDate), 'dd MMMM yyyy', { locale: fr });
      return `${start} - ${end}`;
    } catch {
      return `${period.startDate} - ${period.endDate}`;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-[#0f1528] to-[#141c33] border border-gray-800">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">{t('financial_diagnostic.title')}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-300">
              <Calendar className="w-4 h-4" />
              <span>
                {t('financial_diagnostic.period_label')} {formatPeriodLabel()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('financial_diagnostic.comparative_label')} {COMPARISON_OPTIONS[comparisonMode].label}:{' '}
              {comparisonPeriodLabel || 'N/A'}
            </p>
          </div>
          <div className="hidden md:flex gap-2 flex-wrap">
            {onExportPDF && (
              <Button
                onClick={onExportPDF}
                variant="outline"
                aria-label={t('financial_diagnostic.export_pdf_aria')}
                className="h-11 px-4 border-gray-700 text-gray-200 hover:bg-blue-500/10"
              >
                <FileDown className="w-4 h-4 mr-2" />
                {t('financial_diagnostic.export_premium_pdf')}
              </Button>
            )}
            {onExportHTML && (
              <Button
                onClick={onExportHTML}
                variant="outline"
                aria-label={t('financial_diagnostic.export_html_aria')}
                className="h-11 px-4 border-gray-700 text-gray-200 hover:bg-blue-500/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('financial_diagnostic.export_premium_html')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiagnosticHeader;
