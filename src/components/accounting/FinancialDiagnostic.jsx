import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  Droplets,
  FileDown,
  FileText,
  LayoutGrid,
  List,
  MoveDown,
  MoveUp,
  PanelRightOpen,
  Scale,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import RatioInfoPopover from './RatioInfoPopover';
import MarginAnalysisSection from './MarginAnalysisSection';
import FinancingAnalysisSection from './FinancingAnalysisSection';
import KeyRatiosSection from './KeyRatiosSection';

const STORAGE_KEY = 'cashpilot.financial-diagnostic-layout.v3';

const COMPARISON_OPTIONS = {
  yoy: { label: 'N/N-1', sourceKey: 'yearOverYear' },
  mom: { label: 'M/M', sourceKey: 'monthOverMonth' },
  qoq: { label: 'T/T', sourceKey: 'quarterOverQuarter' },
};

const SECTION_FILTERS = [
  { value: 'all', labelKey: 'financial_diagnostic.filter_all' },
  { value: 'margins', labelKey: 'financial_diagnostic.filter_margins' },
  { value: 'financing', labelKey: 'financial_diagnostic.filter_financing' },
  { value: 'ratios', labelKey: 'financial_diagnostic.filter_ratios' },
];

const SORT_OPTIONS = [
  { value: 'custom', labelKey: 'financial_diagnostic.sort_custom' },
  { value: 'priority', labelKey: 'financial_diagnostic.sort_priority' },
  { value: 'value', labelKey: 'financial_diagnostic.sort_value' },
  { value: 'alpha', labelKey: 'financial_diagnostic.sort_alpha' },
];

const SECTOR_BENCHMARKS = {
  services: {
    grossMarginPercent: 42,
    ebitdaMargin: 14,
    operatingMargin: 11,
    netMargin: 8,
    roe: 15,
    roce: 11,
    currentRatio: 1.4,
    quickRatio: 1.1,
    cashRatio: 0.25,
    financialLeverage: 1.1,
    debtRatio: 1.1,
    autonomyRatio: 48,
    bfr: 25000,
    caf: 50000,
    operatingCashFlow: 32000,
  },
  commerce: {
    grossMarginPercent: 30,
    ebitdaMargin: 9,
    operatingMargin: 6,
    netMargin: 4,
    roe: 12,
    roce: 8,
    currentRatio: 1.2,
    quickRatio: 0.9,
    cashRatio: 0.2,
    financialLeverage: 1.4,
    debtRatio: 1.5,
    autonomyRatio: 41,
    bfr: 35000,
    caf: 42000,
    operatingCashFlow: 21000,
  },
  industrie: {
    grossMarginPercent: 36,
    ebitdaMargin: 13,
    operatingMargin: 9,
    netMargin: 6,
    roe: 13,
    roce: 10,
    currentRatio: 1.5,
    quickRatio: 1.0,
    cashRatio: 0.2,
    financialLeverage: 1.7,
    debtRatio: 1.8,
    autonomyRatio: 37,
    bfr: 50000,
    caf: 72000,
    operatingCashFlow: 38000,
  },
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const shiftDateInput = (dateInput, { years = 0, months = 0, days = 0 } = {}) => {
  if (!dateInput) return null;
  const shifted = new Date(`${dateInput}T00:00:00`);
  shifted.setFullYear(shifted.getFullYear() + years);
  shifted.setMonth(shifted.getMonth() + months);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const formatMoney = (value, currency) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency,
}).format(asNumber(value));

const formatMetric = (value, formatType, currency) => {
  const number = asNumber(value);
  if (formatType === 'currency') return formatMoney(number, currency);
  if (formatType === 'percentage') return `${number.toFixed(1)}%`;
  return number.toFixed(2);
};

const metricAccessors = {
  revenue: (d) => asNumber(d?.margins?.revenue),
  grossMargin: (d) => asNumber(d?.margins?.grossMargin),
  grossMarginPercent: (d) => asNumber(d?.margins?.grossMarginPercent),
  ebitda: (d) => asNumber(d?.margins?.ebitda),
  ebitdaMargin: (d) => asNumber(d?.margins?.ebitdaMargin),
  operatingResult: (d) => asNumber(d?.margins?.operatingResult),
  operatingMargin: (d) => asNumber(d?.margins?.operatingMargin),
  caf: (d) => asNumber(d?.financing?.caf),
  workingCapital: (d) => asNumber(d?.financing?.workingCapital),
  bfr: (d) => asNumber(d?.financing?.bfr),
  bfrVariation: (d) => asNumber(d?.financing?.bfrVariation),
  operatingCashFlow: (d) => asNumber(d?.financing?.operatingCashFlow),
  netDebt: (d) => asNumber(d?.financing?.netDebt),
  equity: (d) => asNumber(d?.financing?.equity),
  totalDebt: (d) => asNumber(d?.financing?.totalDebt),
  debtRatio: (d) => {
    const equity = asNumber(d?.financing?.equity);
    return equity !== 0 ? asNumber(d?.financing?.totalDebt) / equity : 0;
  },
  debtShare: (d) => {
    const equity = asNumber(d?.financing?.equity);
    const debt = asNumber(d?.financing?.totalDebt);
    return equity + debt > 0 ? (debt / (equity + debt)) * 100 : 0;
  },
  roe: (d) => asNumber(d?.ratios?.profitability?.roe),
  roa: (d) => asNumber(d?.ratios?.profitability?.roa),
  roce: (d) => asNumber(d?.ratios?.profitability?.roce),
  netMargin: (d) => asNumber(d?.ratios?.profitability?.netMargin),
  currentRatio: (d) => asNumber(d?.ratios?.liquidity?.currentRatio),
  quickRatio: (d) => asNumber(d?.ratios?.liquidity?.quickRatio),
  cashRatio: (d) => asNumber(d?.ratios?.liquidity?.cashRatio),
  financialLeverage: (d) => asNumber(d?.ratios?.leverage?.financialLeverage),
  autonomyRatio: (d) => {
    const leverage = asNumber(d?.ratios?.leverage?.financialLeverage);
    return leverage !== 0 ? (1 / (1 + leverage)) * 100 : 100;
  },
};
const CARD_DEFINITIONS = [
  {
    id: 'revenue',
    i18nKey: 'revenue',
    section: 'margins',
    metricKey: 'revenue',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'revenue',
    sourceGroup: 'revenue',
    icon: DollarSign,
    colorClass: 'text-blue-300',
    hasInfo: true,
  },
  {
    id: 'gross-margin',
    i18nKey: 'gross_margin',
    section: 'margins',
    metricKey: 'grossMargin',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Target,
    colorClass: 'text-emerald-300',
    hasInfo: true,
  },
  {
    id: 'gross-margin-rate',
    i18nKey: 'gross_margin_rate',
    section: 'margins',
    metricKey: 'grossMarginPercent',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: TrendingUp,
    colorClass: 'text-emerald-300',
  },
  {
    id: 'ebitda',
    i18nKey: 'ebitda',
    section: 'margins',
    metricKey: 'ebitda',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'expense',
    icon: Activity,
    colorClass: 'text-violet-300',
  },
  {
    id: 'ebitda-margin',
    i18nKey: 'ebitda_margin',
    section: 'margins',
    metricKey: 'ebitdaMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: BarChart3,
    colorClass: 'text-violet-300',
  },
  {
    id: 'operating-result',
    i18nKey: 'operating_result',
    section: 'margins',
    metricKey: 'operatingResult',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'expense',
    icon: TrendingUp,
    colorClass: 'text-green-300',
  },
  {
    id: 'operating-margin',
    i18nKey: 'operating_margin',
    section: 'margins',
    metricKey: 'operatingMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Sparkles,
    colorClass: 'text-green-300',
  },
  {
    id: 'caf',
    i18nKey: 'caf',
    section: 'financing',
    metricKey: 'caf',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Wallet,
    colorClass: 'text-emerald-300',
  },
  {
    id: 'working-capital',
    i18nKey: 'working_capital',
    section: 'financing',
    metricKey: 'workingCapital',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: CreditCard,
    colorClass: 'text-sky-300',
  },
  {
    id: 'bfr',
    i18nKey: 'bfr',
    section: 'financing',
    metricKey: 'bfr',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'liquidity',
    icon: ArrowRightLeft,
    colorClass: 'text-orange-300',
  },
  {
    id: 'bfr-variation',
    i18nKey: 'bfr_variation',
    section: 'financing',
    metricKey: 'bfrVariation',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'liquidity',
    icon: MoveUp,
    colorClass: 'text-orange-300',
  },
  {
    id: 'operating-cashflow',
    i18nKey: 'operating_cashflow',
    section: 'financing',
    metricKey: 'operatingCashFlow',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Activity,
    colorClass: 'text-emerald-300',
  },
  {
    id: 'net-debt',
    i18nKey: 'net_debt',
    section: 'financing',
    metricKey: 'netDebt',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'cashFlow',
    sourceGroup: 'debt',
    icon: CreditCard,
    colorClass: 'text-amber-300',
  },
  {
    id: 'debt-ratio',
    i18nKey: 'debt_ratio',
    section: 'financing',
    metricKey: 'debtRatio',
    format: 'number',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: Scale,
    colorClass: 'text-amber-300',
  },
  {
    id: 'debt-share',
    i18nKey: 'debt_share',
    section: 'financing',
    metricKey: 'debtShare',
    format: 'percentage',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: MoveDown,
    colorClass: 'text-amber-300',
  },
  {
    id: 'roe',
    i18nKey: 'roe',
    section: 'ratios',
    metricKey: 'roe',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Target,
    colorClass: 'text-green-300',
  },
  {
    id: 'roce',
    i18nKey: 'roce',
    section: 'ratios',
    metricKey: 'roce',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Target,
    colorClass: 'text-green-300',
  },
  {
    id: 'roa',
    i18nKey: 'roa',
    section: 'ratios',
    metricKey: 'roa',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Activity,
    colorClass: 'text-green-300',
  },
  {
    id: 'net-margin',
    i18nKey: 'net_margin',
    section: 'ratios',
    metricKey: 'netMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Sparkles,
    colorClass: 'text-cyan-300',
  },
  {
    id: 'current-ratio',
    i18nKey: 'current_ratio',
    section: 'ratios',
    metricKey: 'currentRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: Droplets,
    colorClass: 'text-sky-300',
  },
  {
    id: 'quick-ratio',
    i18nKey: 'quick_ratio',
    section: 'ratios',
    metricKey: 'quickRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: Droplets,
    colorClass: 'text-sky-300',
  },
  {
    id: 'cash-ratio',
    i18nKey: 'cash_ratio',
    section: 'ratios',
    metricKey: 'cashRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Droplets,
    colorClass: 'text-sky-300',
  },
  {
    id: 'financial-leverage',
    i18nKey: 'financial_leverage',
    section: 'ratios',
    metricKey: 'financialLeverage',
    format: 'number',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: Scale,
    colorClass: 'text-orange-300',
  },
  {
    id: 'autonomy-ratio',
    i18nKey: 'autonomy_ratio',
    section: 'ratios',
    metricKey: 'autonomyRatio',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'equity',
    icon: Scale,
    colorClass: 'text-emerald-300',
  },
];

const DEFAULT_CARD_ORDER = CARD_DEFINITIONS.map((card) => card.id);

const truncate = (text, max = 120) => {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const getMetricValue = (diagnostic, metricKey) => {
  if (!metricKey || !metricAccessors[metricKey]) return null;
  return metricAccessors[metricKey](diagnostic);
};

const getComparisonInfo = (current, previous, betterWhen = 'higher') => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  const percent = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const better = betterWhen === 'lower' ? delta <= 0 : delta >= 0;

  return {
    delta,
    percent,
    better,
  };
};

const formatDelta = (value, formatType, currency) => {
  const sign = value > 0 ? '+' : '';
  if (formatType === 'currency') return `${sign}${formatMoney(value, currency)}`;
  if (formatType === 'percentage') return `${sign}${value.toFixed(1)} pts`;
  return `${sign}${value.toFixed(2)}`;
};

const getTrendSeriesMap = (monthlyData) => {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    const empty = Array.from({ length: 12 }, () => 0);
    return { revenue: empty, expense: empty, cashFlow: empty, margin: empty };
  }

  const sorted = [...monthlyData]
    .filter((row) => row && row.key)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-12);

  const padded = sorted.length < 12
    ? [...Array.from({ length: 12 - sorted.length }, () => ({ revenue: 0, expense: 0 })), ...sorted]
    : sorted;

  const revenue = padded.map((row) => asNumber(row.revenue));
  const expense = padded.map((row) => asNumber(row.expense));
  const cashFlow = padded.map((_, idx) => revenue[idx] - expense[idx]);
  const margin = padded.map((_, idx) => (revenue[idx] !== 0 ? ((revenue[idx] - expense[idx]) / revenue[idx]) * 100 : 0));

  return { revenue, expense, cashFlow, margin };
};

const getAccountsForSourceGroup = (trialBalance, sourceGroup) => {
  if (!Array.isArray(trialBalance)) return [];

  const predicates = {
    revenue: (row) => row.account_type === 'revenue' || String(row.account_code || '').startsWith('70'),
    expense: (row) => row.account_type === 'expense' || String(row.account_code || '').startsWith('6'),
    cash: (row) => String(row.account_code || '').startsWith('5'),
    debt: (row) =>
      row.account_type === 'liability' ||
      ['16', '17', '18', '40', '44'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
    equity: (row) => row.account_type === 'equity' || ['10', '11', '12', '13'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
    liquidity: (row) => ['3', '4', '5'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
  };

  const predicate = predicates[sourceGroup] || (() => true);

  return trialBalance
    .filter(predicate)
    .map((row) => ({
      ...row,
      balanceAbs: Math.abs(asNumber(row.balance)),
    }))
    .sort((a, b) => b.balanceAbs - a.balanceAbs)
    .slice(0, 12);
};
const buildCriticalAlerts = (diagnostic, currency, t) => {
  const alerts = [];
  const ebitdaMargin = getMetricValue(diagnostic, 'ebitdaMargin');
  const operatingMargin = getMetricValue(diagnostic, 'operatingMargin');
  const currentRatio = getMetricValue(diagnostic, 'currentRatio');
  const financialLeverage = getMetricValue(diagnostic, 'financialLeverage');
  const operatingCashFlow = getMetricValue(diagnostic, 'operatingCashFlow');
  const bfrVariation = getMetricValue(diagnostic, 'bfrVariation');

  if (operatingMargin < 5) {
    alerts.push({
      id: 'alert-operating-margin',
      severity: 100,
      title: t('financial_diagnostic.alerts.operating_margin_title'),
      description: t('financial_diagnostic.alerts.operating_margin_desc', { value: operatingMargin.toFixed(1) }),
      action: t('financial_diagnostic.alerts.operating_margin_action'),
      cardId: 'operating-margin',
    });
  }

  if (currentRatio < 1) {
    alerts.push({
      id: 'alert-current-ratio',
      severity: 95,
      title: t('financial_diagnostic.alerts.current_ratio_title'),
      description: t('financial_diagnostic.alerts.current_ratio_desc', { value: currentRatio.toFixed(2) }),
      action: t('financial_diagnostic.alerts.current_ratio_action'),
      cardId: 'current-ratio',
    });
  }

  if (financialLeverage > 2) {
    alerts.push({
      id: 'alert-leverage',
      severity: 90,
      title: t('financial_diagnostic.alerts.leverage_title'),
      description: t('financial_diagnostic.alerts.leverage_desc', { value: financialLeverage.toFixed(2) }),
      action: t('financial_diagnostic.alerts.leverage_action'),
      cardId: 'financial-leverage',
    });
  }

  if (operatingCashFlow < 0) {
    alerts.push({
      id: 'alert-cashflow',
      severity: 88,
      title: t('financial_diagnostic.alerts.cashflow_title'),
      description: t('financial_diagnostic.alerts.cashflow_desc', { value: formatMoney(operatingCashFlow, currency) }),
      action: t('financial_diagnostic.alerts.cashflow_action'),
      cardId: 'operating-cashflow',
    });
  }

  if (bfrVariation > 0) {
    alerts.push({
      id: 'alert-bfr',
      severity: 80,
      title: t('financial_diagnostic.alerts.bfr_title'),
      description: t('financial_diagnostic.alerts.bfr_desc', { value: formatMoney(bfrVariation, currency) }),
      action: t('financial_diagnostic.alerts.bfr_action'),
      cardId: 'bfr-variation',
    });
  }

  if (ebitdaMargin < 10) {
    alerts.push({
      id: 'alert-ebitda-margin',
      severity: 78,
      title: t('financial_diagnostic.alerts.ebitda_margin_title'),
      description: t('financial_diagnostic.alerts.ebitda_margin_desc', { value: ebitdaMargin.toFixed(1) }),
      action: t('financial_diagnostic.alerts.ebitda_margin_action'),
      cardId: 'ebitda-margin',
    });
  }

  return alerts.sort((a, b) => b.severity - a.severity).slice(0, 3);
};

const Sparkline = ({ series = [], color = '#34d399' }) => {
  const values = Array.isArray(series) ? series : [];
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 180;
  const height = 40;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const range = max - min;

  const points = values.map((value, idx) => {
    const x = idx * step;
    const y = range === 0 ? height / 2 : height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

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

  const resolveCard = (card) => ({
    ...card,
    title: t(`financial_diagnostic.cards.${card.i18nKey}.title`),
    why: t(`financial_diagnostic.cards.${card.i18nKey}.why`),
    how: t(`financial_diagnostic.cards.${card.i18nKey}.how`),
    info: card.hasInfo ? {
      title: t(`financial_diagnostic.cards.${card.i18nKey}.info_title`),
      formula: t(`financial_diagnostic.cards.${card.i18nKey}.info_formula`),
      definition: t(`financial_diagnostic.cards.${card.i18nKey}.info_definition`),
      utility: t(`financial_diagnostic.cards.${card.i18nKey}.info_utility`),
      interpretation: t(`financial_diagnostic.cards.${card.i18nKey}.info_interpretation`),
    } : null,
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
          <h3 className="text-lg font-semibold text-gray-100 mb-2">{t('financial_diagnostic.insufficient_data_title')}</h3>
          <p className="text-sm text-gray-400 mb-4">
            {t('financial_diagnostic.insufficient_data_desc')}
          </p>
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

  const comparisonDiagnostic = useMemo(() => {
    const key = COMPARISON_OPTIONS[comparisonMode]?.sourceKey;
    return key ? comparatives?.[key] || null : null;
  }, [comparatives, comparisonMode]);

  const comparisonPeriodLabel = useMemo(() => {
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
  }, [comparisonMode, period?.endDate, period?.startDate]);

  const trendSeriesMap = useMemo(() => getTrendSeriesMap(monthlyData), [monthlyData]);
  const topAlerts = useMemo(() => buildCriticalAlerts(diagnostic, currency, t), [diagnostic, currency, t]);
  const alertSeverityByCardId = useMemo(
    () => topAlerts.reduce((acc, alert) => ({ ...acc, [alert.cardId]: alert.severity }), {}),
    [topAlerts]
  );

  const orderedIds = useMemo(() => {
    const safeIds = cardOrder.filter((id) => DEFAULT_CARD_ORDER.includes(id));
    const missingIds = DEFAULT_CARD_ORDER.filter((id) => !safeIds.includes(id));
    return [...safeIds, ...missingIds];
  }, [cardOrder]);

  const cards = useMemo(() => {
    const cardMap = CARD_DEFINITIONS.reduce((acc, card) => ({ ...acc, [card.id]: card }), {});
    return orderedIds.map((id) => cardMap[id]).filter(Boolean).map(resolveCard);
  }, [orderedIds, t]);

  const displayedCards = useMemo(() => {
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
  }, [alertSeverityByCardId, cards, diagnostic, hiddenCardIds, sectionFilter, sortMode]);

  const selectedCard = useMemo(
    () => displayedCards.find((card) => card.id === activeCardId) || cards.find((card) => card.id === activeCardId) || null,
    [activeCardId, cards, displayedCards]
  );

  const selectedAccounts = useMemo(
    () => getAccountsForSourceGroup(trialBalance, selectedCard?.sourceGroup),
    [selectedCard?.sourceGroup, trialBalance]
  );

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
        const benchmarkValue = SECTOR_BENCHMARKS[benchmarkSector]?.[card.metricKey];
        return {
          id: card.id,
          title: card.title,
          section: card.section,
          format: card.format,
          currentValue,
          formattedCurrentValue: formatMetric(currentValue, card.format, currency),
          comparisonValue,
          formattedComparisonValue: Number.isFinite(comparisonValue) ? formatMetric(comparisonValue, card.format, currency) : null,
          benchmarkValue: Number.isFinite(benchmarkValue) ? benchmarkValue : null,
          formattedBenchmarkValue: Number.isFinite(benchmarkValue) ? formatMetric(benchmarkValue, card.format, currency) : null,
          why: card.why,
          how: card.how,
        };
      }),
    };

    onViewStateChange(snapshot);
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

  const renderCard = (card) => {
    const currentValue = getMetricValue(diagnostic, card.metricKey);
    const comparisonValue = getMetricValue(comparisonDiagnostic, card.metricKey);
    const comparisonInfo = getComparisonInfo(currentValue, comparisonValue, card.betterWhen);
    const benchmarkValue = SECTOR_BENCHMARKS[benchmarkSector]?.[card.metricKey];
    const benchmarkGap = Number.isFinite(benchmarkValue) ? currentValue - benchmarkValue : null;
    const trendSeries = trendSeriesMap[card.trendKey] || [];
    const Icon = card.icon || BarChart3;
    const compact = viewMode === 'gallery';
    const comparative = viewMode === 'comparative';
    const hasCardAlert = alertSeverityByCardId[card.id] > 0;

    return (
      <Card
        key={card.id}
        className={cn(
          'border border-gray-800 bg-[#0a1228]/90 hover:border-blue-500/40 transition-colors',
          hasCardAlert && 'border-orange-500/40'
        )}
      >
        <CardContent
          role="button"
          tabIndex={0}
          onClick={() => openCardDrilldown(card.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openCardDrilldown(card.id);
            }
          }}
          aria-label={t('financial_diagnostic.open_detail_aria', { title: card.title })}
          className={cn('p-4 sm:p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-gray-800/80 flex items-center justify-center shrink-0">
                <Icon className={cn('h-5 w-5', card.colorClass || 'text-blue-300')} />
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-1.5">
                  <span onClick={(event) => event.stopPropagation()} data-ignore-drilldown="true">
                    {card.info ? <RatioInfoPopover {...card.info} /> : null}
                  </span>
                  <p className="text-sm font-medium text-gray-200 leading-5">{card.title}</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-100 mt-2">
                  {formatMetric(currentValue, card.format, currency)}
                </p>
              </div>
            </div>

            {comparisonInfo ? (
              <div
                className={cn(
                  'shrink-0 text-xs px-2 py-1 rounded-full border',
                  comparisonInfo.better
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                )}
              >
                {COMPARISON_OPTIONS[comparisonMode].label}: {comparisonInfo.percent !== null ? `${comparisonInfo.percent >= 0 ? '+' : ''}${comparisonInfo.percent.toFixed(1)}%` : '-'}
              </div>
            ) : (
              <div className="text-xs text-gray-500">N/A</div>
            )}
          </div>

          {comparative && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
                <p className="text-[11px] text-gray-400">{t('financial_diagnostic.current_period')}</p>
                <p className="text-sm font-semibold text-gray-100">{formatMetric(currentValue, card.format, currency)}</p>
              </div>
              <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
                <p className="text-[11px] text-gray-400">{COMPARISON_OPTIONS[comparisonMode].label}</p>
                <p className="text-sm font-semibold text-gray-100">{Number.isFinite(comparisonValue) ? formatMetric(comparisonValue, card.format, currency) : '-'}</p>
              </div>
            </div>
          )}

          {Number.isFinite(benchmarkValue) && (
            <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-2">
              <p className="text-[11px] text-blue-200">
                {t('financial_diagnostic.you_label')} <strong>{formatMetric(currentValue, card.format, currency)}</strong> | {t('financial_diagnostic.sector_median')} <strong>{formatMetric(benchmarkValue, card.format, currency)}</strong>
              </p>
              <p className={cn('text-[11px] mt-0.5', (card.betterWhen === 'lower' ? benchmarkGap <= 0 : benchmarkGap >= 0) ? 'text-emerald-300' : 'text-red-300')}>
                {t('financial_diagnostic.gap_label')} {formatDelta(benchmarkGap || 0, card.format, currency)}
              </p>
            </div>
          )}

          <div className="mt-3">
            <Sparkline series={trendSeries} color={card.betterWhen === 'lower' ? '#38bdf8' : '#34d399'} />
            <p className="text-[11px] text-gray-500">{t('financial_diagnostic.mini_trend_12m')}</p>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs text-gray-300">
              <span className="text-blue-300 font-medium">{t('financial_diagnostic.why_score')} </span>
              {compact ? truncate(card.why, 100) : card.why}
            </p>
            <p className="text-xs text-gray-300">
              <span className="text-emerald-300 font-medium">{t('financial_diagnostic.how_improve')} </span>
              {compact ? truncate(card.how, 100) : card.how}
            </p>
          </div>

          {comparisonInfo && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              {comparisonInfo.delta >= 0 ? (
                <ArrowUp className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
              ) : (
                <ArrowDown className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
              )}
              <span className={comparisonInfo.better ? 'text-emerald-300' : 'text-red-300'}>
                {t('financial_diagnostic.variation_label')} {COMPARISON_OPTIONS[comparisonMode].label}: {formatDelta(comparisonInfo.delta, card.format, currency)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  return (
    <div className="space-y-6 pb-20 md:pb-4">
      <Card className="bg-gradient-to-br from-[#0f1528] to-[#141c33] border border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">{t('financial_diagnostic.title')}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4" />
                <span>{t('financial_diagnostic.period_label')} {formatPeriodLabel()}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('financial_diagnostic.comparative_label')} {COMPARISON_OPTIONS[comparisonMode].label}: {comparisonPeriodLabel || 'N/A'}
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

      <Card className="sticky top-2 z-30 border border-gray-700 bg-[#0b1328]/95 backdrop-blur">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-gray-700 p-1 bg-gray-900/70">
              <button
                type="button"
                onClick={() => setViewMode('gallery')}
                aria-pressed={viewMode === 'gallery'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'gallery' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                {t('financial_diagnostic.view_gallery')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                aria-pressed={viewMode === 'detail'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'detail' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <List className="w-4 h-4" />
                {t('financial_diagnostic.view_detail')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('comparative')}
                aria-pressed={viewMode === 'comparative'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'comparative' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <ArrowRightLeft className="w-4 h-4" />
                {t('financial_diagnostic.view_comparative')}
              </button>
            </div>

            <label className="sr-only" htmlFor="diag-filter">{t('financial_diagnostic.filter_cards_label')}</label>
            <select
              id="diag-filter"
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[170px]"
              aria-label={t('financial_diagnostic.filter_cards_label')}
            >
              {SECTION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-sort">{t('financial_diagnostic.sort_cards_label')}</label>
            <select
              id="diag-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[165px]"
              aria-label={t('financial_diagnostic.sort_cards_label')}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-compare">{t('financial_diagnostic.period_comparator_label')}</label>
            <select
              id="diag-compare"
              value={comparisonMode}
              onChange={(event) => setComparisonMode(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[130px]"
              aria-label={t('financial_diagnostic.period_comparator_label')}
            >
              {Object.entries(COMPARISON_OPTIONS).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-sector">{t('financial_diagnostic.benchmark_sector_label')}</label>
            <select
              id="diag-sector"
              value={benchmarkSector}
              onChange={(event) => setBenchmarkSector(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[160px]"
              aria-label={t('financial_diagnostic.benchmark_sector_label')}
            >
              <option value="services">{t('financial_diagnostic.sector_services')}</option>
              <option value="commerce">{t('financial_diagnostic.sector_commerce')}</option>
              <option value="industrie">{t('financial_diagnostic.sector_industry')}</option>
            </select>

            <Button
              variant="outline"
              onClick={() => setLayoutDialogOpen(true)}
              aria-label={t('financial_diagnostic.customize_cards_aria')}
              className="h-10 border-gray-700 text-gray-200"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              {t('financial_diagnostic.customize')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={cn('border', topAlerts.length > 0 ? 'border-orange-500/40 bg-orange-500/5' : 'border-emerald-500/40 bg-emerald-500/5')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
            <AlertTriangle className={cn('w-5 h-5', topAlerts.length > 0 ? 'text-orange-300' : 'text-emerald-300')} />
            {t('financial_diagnostic.top3_critical_actions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topAlerts.length === 0 ? (
            <div className="text-sm text-emerald-200">
              {t('financial_diagnostic.no_critical_signal')}
            </div>
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
                    onClick={() => openCardDrilldown(alert.cardId)}
                  >
                    {t('financial_diagnostic.cta_open_fix')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn(
        'grid gap-4',
        viewMode === 'detail'
          ? 'grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
      )}>
        {displayedCards.map((card) => renderCard(card))}
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

      <Dialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen}>
        <DialogContent className="max-w-2xl bg-gray-950 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>{t('financial_diagnostic.customize_gallery')}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t('financial_diagnostic.customize_gallery_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {orderedIds.map((cardId, index) => {
              const rawCard = CARD_DEFINITIONS.find((item) => item.id === cardId);
              if (!rawCard) return null;
              const cardTitle = t(`financial_diagnostic.cards.${rawCard.i18nKey}.title`);
              const isVisible = !hiddenCardIds.includes(rawCard.id);

              return (
                <div key={rawCard.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 flex items-center gap-3">
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked) => toggleCardVisibility(rawCard.id, Boolean(checked))}
                    aria-label={t('financial_diagnostic.show_card_aria', { title: cardTitle })}
                    className="h-5 w-5 border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{cardTitle}</p>
                    <p className="text-xs text-gray-500">{rawCard.section}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t('financial_diagnostic.move_up_aria', { title: cardTitle })}
                      disabled={index === 0}
                      onClick={() => moveCard(rawCard.id, 'up')}
                      className="h-8 w-8 border-gray-700 text-gray-200"
                    >
                      <MoveUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t('financial_diagnostic.move_down_aria', { title: cardTitle })}
                      disabled={index === orderedIds.length - 1}
                      onClick={() => moveCard(rawCard.id, 'down')}
                      className="h-8 w-8 border-gray-700 text-gray-200"
                    >
                      <MoveDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCardOrder(DEFAULT_CARD_ORDER);
                setHiddenCardIds([]);
              }}
              className="border-gray-700 text-gray-200"
            >
              {t('financial_diagnostic.reset')}
            </Button>
            <Button type="button" onClick={() => setLayoutDialogOpen(false)}>
              {t('financial_diagnostic.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => (!open ? closeCardDrilldown() : null)}>
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
                          ? formatMetric(getMetricValue(comparisonDiagnostic, selectedCard.metricKey), selectedCard.format, currency)
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900/70 border-gray-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400">{t('financial_diagnostic.sector_median_short')}</p>
                      <p className="text-lg font-bold text-gray-100 mt-1">
                        {Number.isFinite(SECTOR_BENCHMARKS[benchmarkSector]?.[selectedCard.metricKey])
                          ? formatMetric(SECTOR_BENCHMARKS[benchmarkSector]?.[selectedCard.metricKey], selectedCard.format, currency)
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
                    <CardTitle className="text-sm text-gray-100">{t('financial_diagnostic.source_accounts_top12')}</CardTitle>
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

      <div className="md:hidden fixed bottom-4 right-4 z-40 flex flex-col gap-2">
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500"
          aria-label={t('financial_diagnostic.customize_cards_aria')}
          onClick={() => setLayoutDialogOpen(true)}
        >
          <Settings2 className="w-5 h-5" />
        </Button>
        {topAlerts[0] && (
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full bg-orange-500 hover:bg-orange-400 text-black"
            aria-label={t('financial_diagnostic.open_critical_action_aria')}
            onClick={() => openCardDrilldown(topAlerts[0].cardId)}
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
    </div>
  );
};

export default FinancialDiagnostic;
