import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PanelRightOpen } from 'lucide-react';
import { COMPARISON_OPTIONS } from './diagnosticConstants';
import { formatMetric, formatMoney, getMetricValue } from './diagnosticUtils';

const DiagnosticDrilldownDialog = ({
  selectedCard,
  diagnostic,
  comparisonDiagnostic,
  comparisonMode,
  benchmarks,
  benchmarkSector,
  selectedAccounts,
  currency,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="w-[95vw] max-w-3xl sm:max-w-[48rem] bg-[#070d1d] border border-gray-700 text-gray-100 sm:left-auto sm:right-0 sm:top-0 sm:translate-x-0 sm:translate-y-0 sm:h-full sm:rounded-none">
        {selectedCard && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PanelRightOpen className="w-5 h-5 text-blue-300" />
                {t('financial_diagnostic.drilldown_title', { title: selectedCard.title })}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {t('financial_diagnostic.drilldown_desc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-gray-900/70 border-gray-800">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">{t('financial_diagnostic.current_value')}</p>
                    <p className="text-lg font-bold text-gray-100 mt-1">
                      {formatMetric(getMetricValue(diagnostic, selectedCard.metricKey), selectedCard.format, currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/70 border-gray-800">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">{COMPARISON_OPTIONS[comparisonMode].label}</p>
                    <p className="text-lg font-bold text-gray-100 mt-1">
                      {Number.isFinite(getMetricValue(comparisonDiagnostic, selectedCard.metricKey))
                        ? formatMetric(
                            getMetricValue(comparisonDiagnostic, selectedCard.metricKey),
                            selectedCard.format,
                            currency
                          )
                        : '-'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-900/70 border-gray-800">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-400">{t('financial_diagnostic.sector_median_short')}</p>
                    <p className="text-lg font-bold text-gray-100 mt-1">
                      {Number.isFinite(benchmarks[benchmarkSector]?.[selectedCard.metricKey])
                        ? formatMetric(
                            benchmarks[benchmarkSector]?.[selectedCard.metricKey],
                            selectedCard.format,
                            currency
                          )
                        : '-'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gray-900/70 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-200">{t('financial_diagnostic.why_score')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-gray-200">{selectedCard.why}</CardContent>
              </Card>

              <Card className="bg-gray-900/70 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-emerald-200">{t('financial_diagnostic.how_improve')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-gray-200">{selectedCard.how}</CardContent>
              </Card>

              <Card className="bg-gray-900/70 border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-100">
                    {t('financial_diagnostic.source_accounts_top12')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedAccounts.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('financial_diagnostic.no_source_accounts')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-800">
                            <th className="text-left py-2 pr-3">{t('financial_diagnostic.table_code')}</th>
                            <th className="text-left py-2 pr-3">{t('financial_diagnostic.table_account')}</th>
                            <th className="text-right py-2">{t('financial_diagnostic.table_balance')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAccounts.map((account) => (
                            <tr key={account.account_code} className="border-b border-gray-900">
                              <td className="py-2 pr-3 font-mono text-gray-300">{account.account_code}</td>
                              <td className="py-2 pr-3 text-gray-200">{account.account_name}</td>
                              <td className="py-2 text-right font-semibold text-gray-100">
                                {formatMoney(account.balance, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DiagnosticDrilldownDialog;
