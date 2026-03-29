import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useCashFlowForecast } from '@/hooks/useCashFlowForecast';
import CashFlowSummaryCards from '@/components/cashflow/CashFlowSummaryCards';
import CashFlowChart from '@/components/cashflow/CashFlowChart';
import CashFlowAlerts from '@/components/cashflow/CashFlowAlerts';
import { Brain, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Lightbulb, BarChart3 } from 'lucide-react';
import { getLocale } from '@/utils/dateLocale';
import { Button } from '@/components/ui/button';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const PERIOD_OPTIONS = [30, 60, 90, 180];

const CashFlowForecastPage = () => {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState(90);
  const { forecast, scenarios, milestones, alerts, analysis, loading, error, fetchForecast } =
    useCashFlowForecast(selectedPeriod);

  const handlePeriodChange = useCallback(
    (days) => {
      setSelectedPeriod(days);
      fetchForecast(days);
    },
    [fetchForecast]
  );

  const handleRefresh = useCallback(() => {
    fetchForecast(selectedPeriod);
  }, [fetchForecast, selectedPeriod]);

  const trendIcon = {
    growing: TrendingUp,
    declining: TrendingDown,
    stable: Minus,
  };

  const trendColor = {
    growing: 'text-emerald-400',
    declining: 'text-red-400',
    stable: 'text-gray-400',
  };

  const trendLabel = {
    growing: t('cashflow.analysis.growing', 'En croissance'),
    declining: t('cashflow.analysis.declining', 'En baisse'),
    stable: t('cashflow.analysis.stable', 'Stable'),
  };

  const volatilityLabel = {
    low: t('cashflow.analysis.lowVolatility', 'Faible'),
    medium: t('cashflow.analysis.mediumVolatility', 'Moyenne'),
    high: t('cashflow.analysis.highVolatility', 'Elevee'),
  };

  const volatilityColor = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  };

  const analysisPanelInfo = {
    title: t('cashflow.analysis.title', 'Analyse IA'),
    definition: 'Lecture synthétique de la tendance, volatilité et recommandations de trésorerie.',
    dataSource: 'Objet `analysis` et bloc `scenarios` retournés par `useCashFlowForecast`.',
    formula: 'Sans formule unique: interprétation des projections multi-scénarios.',
    calculationMethod:
      'Récupère les indicateurs fournis par le moteur IA, puis affiche tendance, volatilité, scénarios et recommandations.',
  };

  return (
    <>
      <Helmet>
        <title>{t('cashflow.page.title', 'Previsions de Tresorerie IA')} - CashPilot</title>
      </Helmet>

      <div className="p-4 md:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {t('cashflow.page.title', 'Previsions de Tresorerie IA')}
              </h1>
              <p className="text-sm text-gray-400">
                {t(
                  'cashflow.page.description',
                  'Prediction intelligente de votre tresorerie avec scenarios et alertes'
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {/* Period Selector */}
            <div className="flex bg-[#141c33] rounded-lg border border-gray-700/50 overflow-hidden">
              {PERIOD_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => handlePeriodChange(days)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedPeriod === days
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {days}
                  {t('cashflow.page.days', 'j')}
                </button>
              ))}
            </div>

            <Button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-[#141c33] hover:bg-gray-700/50 text-white border border-gray-700/50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('cashflow.page.refresh', 'Actualiser')}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* Summary Cards */}
        <CashFlowSummaryCards forecast={forecast} milestones={milestones} loading={loading} />

        {/* Main Chart */}
        <CashFlowChart
          dailyProjections={forecast?.dailyProjections ?? []}
          scenarios={scenarios}
          loading={loading}
          periodDays={selectedPeriod}
        />

        {/* Bottom Section: Analysis + Alerts side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Analysis Panel */}
          <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white inline-flex items-center gap-1.5">
                  <PanelInfoPopover {...analysisPanelInfo} />
                  <span>{t('cashflow.analysis.title', 'Analyse IA')}</span>
                </h3>
                <p className="text-xs text-gray-500">{t('cashflow.analysis.subtitle', 'Tendance et volatilite')}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Trend & Volatility indicators */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
                    <span className="text-xs text-gray-500 block mb-1">
                      {t('cashflow.analysis.trendLabel', 'Tendance')}
                    </span>
                    <div className="flex items-center gap-2">
                      {analysis.trend &&
                        (() => {
                          const TIcon = trendIcon[analysis.trend] || Minus;
                          return <TIcon className={`w-4 h-4 ${trendColor[analysis.trend] || 'text-gray-400'}`} />;
                        })()}
                      <span className={`text-sm font-semibold ${trendColor[analysis.trend] || 'text-gray-400'}`}>
                        {trendLabel[analysis.trend] || analysis.trend}
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#0a0e1a]/60 rounded-xl p-3 border border-gray-800/30">
                    <span className="text-xs text-gray-500 block mb-1">
                      {t('cashflow.analysis.volatilityLabel', 'Volatilite')}
                    </span>
                    <span
                      className={`text-sm font-semibold ${volatilityColor[analysis.volatility] || 'text-gray-400'}`}
                    >
                      {volatilityLabel[analysis.volatility] || analysis.volatility}
                    </span>
                  </div>
                </div>

                {/* Scenario Summary */}
                {scenarios && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-300">
                      {t('cashflow.analysis.scenariosTitle', 'Scenarios')}
                    </h4>
                    {['optimistic', 'baseline', 'pessimistic'].map((key) => {
                      const sc = scenarios[key];
                      if (!sc) return null;
                      const colorMap = {
                        optimistic: 'text-emerald-400',
                        baseline: 'text-blue-400',
                        pessimistic: 'text-red-400',
                      };
                      const bgMap = {
                        optimistic: 'bg-emerald-500/10 border-emerald-500/20',
                        baseline: 'bg-blue-500/10 border-blue-500/20',
                        pessimistic: 'bg-red-500/10 border-red-500/20',
                      };
                      return (
                        <div
                          key={key}
                          className={`${bgMap[key]} border rounded-lg p-3 flex justify-between items-center`}
                        >
                          <div>
                            <span className={`text-sm font-medium ${colorMap[key]}`}>{sc.label || key}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{sc.description || ''}</p>
                          </div>
                          <span className={`text-sm font-bold ${colorMap[key]}`}>
                            {sc.projected_balance != null
                              ? new Intl.NumberFormat(getLocale(), {
                                  style: 'currency',
                                  currency: 'EUR',
                                  maximumFractionDigits: 0,
                                }).format(sc.projected_balance)
                              : '--'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-semibold text-gray-300">
                        {t('cashflow.analysis.recommendations', 'Recommandations')}
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {analysis.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="bg-[#0a0e1a]/60 rounded-lg p-3 border border-gray-800/30 text-sm text-gray-300 leading-relaxed"
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                {t('cashflow.analysis.noData', "Lancez une prevision pour obtenir l'analyse IA")}
              </div>
            )}
          </div>

          {/* Alerts */}
          <CashFlowAlerts alerts={alerts} loading={loading} />
        </div>
      </div>
    </>
  );
};

export default CashFlowForecastPage;
