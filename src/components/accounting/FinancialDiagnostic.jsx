import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import MarginAnalysisSection from './MarginAnalysisSection';
import FinancingAnalysisSection from './FinancingAnalysisSection';
import KeyRatiosSection from './KeyRatiosSection';
import { supabase } from '@/lib/supabase';

import {
  STORAGE_KEY,
  COMPARISON_OPTIONS,
  CARD_DEFINITIONS,
  DEFAULT_CARD_ORDER,
  DEFAULT_SECTOR_BENCHMARKS,
} from './financial-diagnostic/diagnosticConstants';

import {
  buildCriticalAlerts,
  formatMetric,
  getAccountsForSourceGroup,
  getMetricValue,
  getTrendSeriesMap,
  shiftDateInput,
} from './financial-diagnostic/diagnosticUtils';

import {
  DiagnosticHeader,
  DiagnosticToolbar,
  DiagnosticAlerts,
  DiagnosticCard,
  DiagnosticDrilldownDialog,
  LayoutCustomizationDialog,
  DiagnosticMobileFab,
} from './financial-diagnostic';

const FinancialDiagnostic = ({
  diagnostic,
  period,
  currency = 'EUR',
  onExportPDF,
  onExportHTML,
  monthlyData = [],
  trialBalance = [],
  comparatives = null,
  onViewStateChange,
}) => {
  const { t } = useTranslation();

  const [benchmarks, setBenchmarks] = useState(DEFAULT_SECTOR_BENCHMARKS);
  useEffect(() => {
    supabase
      .from('sector_benchmarks')
      .select('*')
      .then(({ data }) => {
        if (data?.length) {
          const map = {};
          data.forEach((b) => {
            map[b.sector_code] = b;
          });
          setBenchmarks(map);
        }
      });
  }, []);

  const resolveCard = (card) => ({
    ...card,
    title: t(`financial_diagnostic.cards.${card.i18nKey}.title`),
    why: t(`financial_diagnostic.cards.${card.i18nKey}.why`),
    how: t(`financial_diagnostic.cards.${card.i18nKey}.how`),
    info: card.hasInfo
      ? {
          title: t(`financial_diagnostic.cards.${card.i18nKey}.info_title`),
          formula: t(`financial_diagnostic.cards.${card.i18nKey}.info_formula`),
          definition: t(`financial_diagnostic.cards.${card.i18nKey}.info_definition`),
          utility: t(`financial_diagnostic.cards.${card.i18nKey}.info_utility`),
          interpretation: t(`financial_diagnostic.cards.${card.i18nKey}.info_interpretation`),
        }
      : null,
  });

  const [viewMode, setViewMode] = useState('gallery');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortMode, setSortMode] = useState('custom');
  const [benchmarkSector, setBenchmarkSector] = useState('services');
  const [comparisonMode, setComparisonMode] = useState('yoy');
  const [cardOrder, setCardOrder] = useState(DEFAULT_CARD_ORDER);
  const [hiddenCardIds, setHiddenCardIds] = useState([]);
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.viewMode) setViewMode(parsed.viewMode);
      if (parsed?.sectionFilter) setSectionFilter(parsed.sectionFilter);
      if (parsed?.sortMode) setSortMode(parsed.sortMode);
      if (parsed?.benchmarkSector) setBenchmarkSector(parsed.benchmarkSector);
      if (parsed?.comparisonMode) setComparisonMode(parsed.comparisonMode);
      if (Array.isArray(parsed?.cardOrder)) setCardOrder(parsed.cardOrder);
      if (Array.isArray(parsed?.hiddenCardIds)) setHiddenCardIds(parsed.hiddenCardIds);
    } catch (error) {
      console.warn('Unable to restore diagnostic layout preferences:', error);
    }
  }, []);

  useEffect(() => {
    const payload = {
      viewMode,
      sectionFilter,
      sortMode,
      benchmarkSector,
      comparisonMode,
      cardOrder,
      hiddenCardIds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [benchmarkSector, cardOrder, comparisonMode, hiddenCardIds, sectionFilter, sortMode, viewMode]);

  if (!diagnostic) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            {t('financial_diagnostic.insufficient_data_title')}
          </h3>
          <p className="text-sm text-gray-400 mb-4">{t('financial_diagnostic.insufficient_data_desc')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostic.valid) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">{t('financial_diagnostic.cannot_generate')}</h3>
              <p className="text-sm text-gray-400 mb-3">{t('financial_diagnostic.errors_detected')}</p>
              <ul className="space-y-1">
                {(diagnostic.errors || []).map((error, idx) => (
                  <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  const comparisonDiagnostic = (() => {
    const key = COMPARISON_OPTIONS[comparisonMode]?.sourceKey;
    return key ? comparatives?.[key] || null : null;
  })();

  const comparisonPeriodLabel = (() => {
    if (!period?.startDate || !period?.endDate) return '';
    const shift = comparisonMode === 'yoy' ? { years: -1 } : comparisonMode === 'qoq' ? { months: -3 } : { months: -1 };
    const start = shiftDateInput(period.startDate, shift);
    const end = shiftDateInput(period.endDate, shift);
    if (!start || !end) return '';
    try {
      return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    } catch {
      return '';
    }
  })();

  const trendSeriesMap = getTrendSeriesMap(monthlyData);
  const topAlerts = buildCriticalAlerts(diagnostic, currency, t);
  const alertSeverityByCardId = topAlerts.reduce((acc, alert) => ({ ...acc, [alert.cardId]: alert.severity }), {});

  const orderedIds = (() => {
    const safeIds = cardOrder.filter((id) => DEFAULT_CARD_ORDER.includes(id));
    const missingIds = DEFAULT_CARD_ORDER.filter((id) => !safeIds.includes(id));
    return [...safeIds, ...missingIds];
  })();

  const cards = orderedIds
    .map((id) => CARD_DEFINITIONS.find((card) => card.id === id))
    .filter(Boolean)
    .map(resolveCard);

  const displayedCards = (() => {
    let list = cards.filter((card) => sectionFilter === 'all' || card.section === sectionFilter);
    list = list.filter((card) => !hiddenCardIds.includes(card.id));

    if (sortMode === 'alpha') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    } else if (sortMode === 'value') {
      list = [...list].sort((a, b) => {
        const va = Math.abs(getMetricValue(diagnostic, a.metricKey));
        const vb = Math.abs(getMetricValue(diagnostic, b.metricKey));
        return vb - va;
      });
    } else if (sortMode === 'priority') {
      list = [...list].sort((a, b) => (alertSeverityByCardId[b.id] || 0) - (alertSeverityByCardId[a.id] || 0));
    }

    return list;
  })();

  const selectedCard =
    displayedCards.find((card) => card.id === activeCardId) || cards.find((card) => card.id === activeCardId) || null;

  const selectedAccounts = getAccountsForSourceGroup(trialBalance, selectedCard?.sourceGroup);

  const toggleCardVisibility = (cardId, checked) => {
    setHiddenCardIds((previous) => {
      if (checked) {
        return previous.filter((id) => id !== cardId);
      }
      return previous.includes(cardId) ? previous : [...previous, cardId];
    });
  };

  const moveCard = (cardId, direction) => {
    setCardOrder((previousOrder) => {
      const currentOrder = previousOrder.filter((id) => DEFAULT_CARD_ORDER.includes(id));
      const index = currentOrder.indexOf(cardId);
      if (index < 0) return previousOrder;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= currentOrder.length) return previousOrder;

      const next = [...currentOrder];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const openCardDrilldown = (cardId) => setActiveCardId(cardId);
  const closeCardDrilldown = () => setActiveCardId(null);

  useEffect(() => {
    if (!onViewStateChange) return;

    const snapshot = {
      generatedAt: new Date().toISOString(),
      mode: viewMode,
      sectionFilter,
      sortMode,
      benchmarkSector,
      comparisonMode,
      comparisonLabel: COMPARISON_OPTIONS[comparisonMode]?.label || comparisonMode,
      period: {
        startDate: period?.startDate || null,
        endDate: period?.endDate || null,
        label: formatPeriodLabel(),
        comparedLabel: comparisonPeriodLabel,
      },
      visibleCardCount: displayedCards.length,
      hiddenCardCount: hiddenCardIds.length,
      visibleCards: displayedCards.map((card) => {
        const currentValue = getMetricValue(diagnostic, card.metricKey);
        const comparisonValue = getMetricValue(comparisonDiagnostic, card.metricKey);
        const benchmarkValue = benchmarks[benchmarkSector]?.[card.metricKey];
        return {
          id: card.id,
          title: card.title,
          section: card.section,
          format: card.format,
          currentValue,
          formattedCurrentValue: formatMetric(currentValue, card.format, currency),
          comparisonValue,
          formattedComparisonValue: Number.isFinite(comparisonValue)
            ? formatMetric(comparisonValue, card.format, currency)
            : null,
          benchmarkValue: Number.isFinite(benchmarkValue) ? benchmarkValue : null,
          formattedBenchmarkValue: Number.isFinite(benchmarkValue)
            ? formatMetric(benchmarkValue, card.format, currency)
            : null,
          why: card.why,
          how: card.how,
        };
      }),
    };

    onViewStateChange(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    benchmarkSector,
    comparisonDiagnostic,
    comparisonMode,
    comparisonPeriodLabel,
    currency,
    diagnostic,
    displayedCards,
    hiddenCardIds.length,
    onViewStateChange,
    period?.endDate,
    period?.startDate,
    sectionFilter,
    sortMode,
    viewMode,
  ]);

  return (
    <div className="space-y-6 pb-20 md:pb-4">
      <DiagnosticHeader
        period={period}
        comparisonMode={comparisonMode}
        comparisonPeriodLabel={comparisonPeriodLabel}
        onExportPDF={onExportPDF}
        onExportHTML={onExportHTML}
      />

      <DiagnosticToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        sortMode={sortMode}
        setSortMode={setSortMode}
        comparisonMode={comparisonMode}
        setComparisonMode={setComparisonMode}
        benchmarkSector={benchmarkSector}
        setBenchmarkSector={setBenchmarkSector}
        onOpenLayoutDialog={() => setLayoutDialogOpen(true)}
      />

      <DiagnosticAlerts topAlerts={topAlerts} onOpenCardDrilldown={openCardDrilldown} />

      <div
        className={cn(
          'grid gap-4',
          viewMode === 'detail' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        )}
      >
        {displayedCards.map((card) => (
          <DiagnosticCard
            key={card.id}
            card={card}
            diagnostic={diagnostic}
            comparisonDiagnostic={comparisonDiagnostic}
            comparisonMode={comparisonMode}
            benchmarks={benchmarks}
            benchmarkSector={benchmarkSector}
            trendSeriesMap={trendSeriesMap}
            alertSeverityByCardId={alertSeverityByCardId}
            viewMode={viewMode}
            currency={currency}
            onOpenDrilldown={openCardDrilldown}
          />
        ))}
      </div>

      {viewMode === 'detail' && (
        <div className="space-y-6">
          <MarginAnalysisSection data={diagnostic.margins} currency={currency} />
          <FinancingAnalysisSection data={diagnostic.financing} currency={currency} />
          <KeyRatiosSection data={diagnostic.ratios} />
        </div>
      )}

      <Card className="bg-gray-900/40 border-gray-800">
        <CardContent className="p-4">
          <p className="text-xs text-gray-300">
            <strong>Note:</strong> {t('financial_diagnostic.note_text')}
          </p>
        </CardContent>
      </Card>

      <LayoutCustomizationDialog
        open={layoutDialogOpen}
        onOpenChange={setLayoutDialogOpen}
        orderedIds={orderedIds}
        hiddenCardIds={hiddenCardIds}
        onToggleCardVisibility={toggleCardVisibility}
        onMoveCard={moveCard}
        onReset={() => {
          setCardOrder(DEFAULT_CARD_ORDER);
          setHiddenCardIds([]);
        }}
      />

      <DiagnosticDrilldownDialog
        selectedCard={selectedCard}
        diagnostic={diagnostic}
        comparisonDiagnostic={comparisonDiagnostic}
        comparisonMode={comparisonMode}
        benchmarks={benchmarks}
        benchmarkSector={benchmarkSector}
        selectedAccounts={selectedAccounts}
        currency={currency}
        onClose={closeCardDrilldown}
      />

      <DiagnosticMobileFab
        topAlerts={topAlerts}
        onOpenLayoutDialog={() => setLayoutDialogOpen(true)}
        onOpenCardDrilldown={openCardDrilldown}
        onExportPDF={onExportPDF}
      />
    </div>
  );
};

export default FinancialDiagnostic;
