import { getLocale } from '@/utils/dateLocale';

export const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const shiftDateInput = (dateInput, { years = 0, months = 0, days = 0 } = {}) => {
  if (!dateInput) return null;
  const shifted = new Date(`${dateInput}T00:00:00`);
  shifted.setFullYear(shifted.getFullYear() + years);
  shifted.setMonth(shifted.getMonth() + months);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

export const formatMoney = (value, currency) =>
  new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
  }).format(asNumber(value));

export const formatMetric = (value, formatType, currency) => {
  const number = asNumber(value);
  if (formatType === 'currency') return formatMoney(number, currency);
  if (formatType === 'percentage') return `${number.toFixed(1)}%`;
  return number.toFixed(2);
};

export const metricAccessors = {
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

export const truncate = (text, max = 120) => {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

export const getMetricValue = (diagnostic, metricKey) => {
  if (!metricKey || !metricAccessors[metricKey]) return null;
  return metricAccessors[metricKey](diagnostic);
};

export const getComparisonInfo = (current, previous, betterWhen = 'higher') => {
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

export const formatDelta = (value, formatType, currency) => {
  const sign = value > 0 ? '+' : '';
  if (formatType === 'currency') return `${sign}${formatMoney(value, currency)}`;
  if (formatType === 'percentage') return `${sign}${value.toFixed(1)} pts`;
  return `${sign}${value.toFixed(2)}`;
};

export const getTrendSeriesMap = (monthlyData) => {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    const empty = Array.from({ length: 12 }, () => 0);
    return { revenue: empty, expense: empty, cashFlow: empty, margin: empty };
  }

  const sorted = [...monthlyData]
    .filter((row) => row && row.key)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-12);

  const padded =
    sorted.length < 12
      ? [...Array.from({ length: 12 - sorted.length }, () => ({ revenue: 0, expense: 0 })), ...sorted]
      : sorted;

  const revenue = padded.map((row) => asNumber(row.revenue));
  const expense = padded.map((row) => asNumber(row.expense));
  const cashFlow = padded.map((_, idx) => revenue[idx] - expense[idx]);
  const margin = padded.map((_, idx) =>
    revenue[idx] !== 0 ? ((revenue[idx] - expense[idx]) / revenue[idx]) * 100 : 0
  );

  return { revenue, expense, cashFlow, margin };
};

export const getAccountsForSourceGroup = (trialBalance, sourceGroup) => {
  if (!Array.isArray(trialBalance)) return [];

  const predicates = {
    revenue: (row) => row.account_type === 'revenue' || String(row.account_code || '').startsWith('70'),
    expense: (row) => row.account_type === 'expense' || String(row.account_code || '').startsWith('6'),
    cash: (row) => String(row.account_code || '').startsWith('5'),
    debt: (row) =>
      row.account_type === 'liability' ||
      ['16', '17', '18', '40', '44'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
    equity: (row) =>
      row.account_type === 'equity' ||
      ['10', '11', '12', '13'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
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

export const buildCriticalAlerts = (diagnostic, currency, t) => {
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
