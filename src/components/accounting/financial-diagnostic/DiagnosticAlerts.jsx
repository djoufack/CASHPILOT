import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const DiagnosticAlerts = ({ topAlerts, onOpenCardDrilldown }) => {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'border',
        topAlerts.length > 0 ? 'border-orange-500/40 bg-orange-500/5' : 'border-emerald-500/40 bg-emerald-500/5'
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
          <AlertTriangle className={cn('w-5 h-5', topAlerts.length > 0 ? 'text-orange-300' : 'text-emerald-300')} />
          {t('financial_diagnostic.top3_critical_actions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topAlerts.length === 0 ? (
          <div className="text-sm text-emerald-200">{t('financial_diagnostic.no_critical_signal')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-orange-500/40 bg-[#1f1422] p-3">
                <p className="text-sm font-semibold text-orange-200">{alert.title}</p>
                <p className="text-xs text-gray-300 mt-1">{alert.description}</p>
                <p className="text-xs text-gray-400 mt-2">{alert.action}</p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 h-9 w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                  onClick={() => onOpenCardDrilldown(alert.cardId)}
                >
                  {t('financial_diagnostic.cta_open_fix')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagnosticAlerts;
