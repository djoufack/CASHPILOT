import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileDown, Settings2 } from 'lucide-react';

const DiagnosticMobileFab = ({ topAlerts, onOpenLayoutDialog, onOpenCardDrilldown, onExportPDF }) => {
  const { t } = useTranslation();

  return (
    <div className="md:hidden fixed bottom-4 right-4 z-40 flex flex-col gap-2">
      <Button
        type="button"
        size="icon"
        className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500"
        aria-label={t('financial_diagnostic.customize_cards_aria')}
        onClick={onOpenLayoutDialog}
      >
        <Settings2 className="w-5 h-5" />
      </Button>
      {topAlerts[0] && (
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full bg-orange-500 hover:bg-orange-400 text-black"
          aria-label={t('financial_diagnostic.open_critical_action_aria')}
          onClick={() => onOpenCardDrilldown(topAlerts[0].cardId)}
        >
          <AlertTriangle className="w-5 h-5" />
        </Button>
      )}
      {onExportPDF && (
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full bg-gray-800 hover:bg-gray-700"
          aria-label={t('financial_diagnostic.export_pdf_mobile_aria')}
          onClick={onExportPDF}
        >
          <FileDown className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

export default DiagnosticMobileFab;
