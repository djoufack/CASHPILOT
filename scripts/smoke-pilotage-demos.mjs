import { createClient } from '@supabase/supabase-js';
import {
  buildBalanceSheetFromEntries,
  buildIncomeStatementFromEntries,
  buildMonthlyChartDataFromEntries,
  buildTrialBalance,
  calculateExpensesFromEntries,
} from '../src/utils/accountingCalculations.js';
import {
  buildFinancialDiagnostic,
  calculateBFR,
} from '../src/utils/financialAnalysisCalculations.js';
import { resolveAccountingCurrency } from '../src/utils/accountingCurrency.js';
import { formatDateInput, formatStartOfYearInput } from '../src/utils/dateFormatting.js';
import { evaluateAccountingDatasetQuality } from '../src/utils/accountingQualityChecks.js';
import { extractFinancialPosition } from '../src/utils/financialMetrics.js';
import { resolvePilotageRegion } from '../src/utils/pilotagePreferences.js';
import { buildTaxSynthesis } from '../src/utils/taxCalculations.js';
import { FinancialSimulationEngine } from '../src/utils/scenarioSimulationEngine.js';

const DEMO_ACCOUNTS = [
  {
    key: 'FR',
    email: 'pilotage.fr.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_FR_PASSWORD',
    expectedRegion: 'france',
  },
  {
    key: 'BE',
    email: 'pilotage.be.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_BE_PASSWORD',
    expectedRegion: 'belgium',
  },
  {
    key: 'OHADA',
    email: 'pilotage.ohada.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_OHADA_PASSWORD',
    expectedRegion: 'ohada',
  },
];

const MIN_DEMO_ROWS = 7;

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
const CASH_ACCOUNT_REGEX = /(banque|bank|cash|caisse|tre?sorerie)/i;
const OPENING_ENTRY_REGEX = /^(open|opening|ouverture|solde[-_\s]?initial)/i;
const OPTIONAL_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', 'PGRST204']);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function getDemoPassword(account) {
  const value = process.env[account.passwordEnv];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${account.passwordEnv}`);
  }

  return String(value).trim();
}

function resolvePeriodBounds() {
  return {
    startDate: formatStartOfYearInput(),
    endDate: formatDateInput(),
  };
}

function normalizeNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function hasFiniteMetric(source) {
  return Boolean(
    source &&
      Object.values(source).some(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
  );
}

function createAvailabilityItem(key, status, missingInputs = []) {
  return {
    key,
    status,
    missingInputs,
  };
}

function collapseSectionAvailability(section) {
  const items = Object.values(section || {});
  const statuses = items.map((item) => item.status);

  if (statuses.length === 0 || statuses.every((status) => status === 'ready')) {
    return 'ready';
  }

  if (statuses.every((status) => status === 'ready' || status === 'partial')) {
    return 'partial';
  }

  return 'unavailable';
}

function normalizePilotageSector(value) {
  const normalized = String(value || '').trim();
  return normalized || 'b2b_services';
}

function isOptionalSchemaError(error) {
  if (!error) return false;
  if (OPTIONAL_SCHEMA_ERROR_CODES.has(error.code)) return true;

  const message = String(error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find');
}

async function fetchOptionalTable(queryFactory, fallbackValue) {
  try {
    const response = await queryFactory();
    if (response?.error) {
      if (isOptionalSchemaError(response.error)) {
        return fallbackValue;
      }

      throw response.error;
    }

    return response?.data ?? fallbackValue;
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      return fallbackValue;
    }

    throw error;
  }
}

function getGroupKey(dateStr, granularity) {
  if (!dateStr) return null;

  const ym = dateStr.substring(0, 7);
  const month = Number.parseInt(ym.substring(5, 7), 10);
  const monthLabel = MONTH_NAMES[month - 1] || ym;

  if (granularity === 'week') {
    const day = Number.parseInt(dateStr.substring(8, 10), 10);
    const week = Math.min(Math.ceil(day / 7), 4);
    return { key: `${ym}-S${week}`, label: `${monthLabel} S${week}` };
  }

  return { key: ym, label: ym };
}

function isCashAccount(account) {
  const code = String(account?.account_code || '').trim();
  const accountType = account?.account_type;
  const accountText = `${account?.account_name || ''} ${account?.account_category || ''}`;

  return (
    accountType === 'asset' &&
    (code.startsWith('5') || CASH_ACCOUNT_REGEX.test(accountText))
  );
}

function isOpeningBalanceEntry(group) {
  const ref = String(group?.entry_ref || '').trim();
  if (OPENING_ENTRY_REGEX.test(ref)) return true;

  return (group?.lines || []).every((line) =>
    OPENING_ENTRY_REGEX.test(String(line?.description || '').trim())
  );
}

function aggregateCashEntryGroups(entries = [], accountMap = new Map()) {
  const groups = new Map();

  for (const entry of entries || []) {
    const key = entry.entry_ref || entry.id;
    const existing = groups.get(key) || {
      key,
      date: entry.transaction_date,
      entry_ref: entry.entry_ref || '',
      lines: [],
    };

    existing.lines.push(entry);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).flatMap((group) => {
    if (isOpeningBalanceEntry(group)) {
      return [];
    }

    const cashDelta = group.lines.reduce((sum, line) => {
      const account = accountMap.get(line.account_code);
      if (!isCashAccount(account)) return sum;

      return sum + normalizeNumber(line.debit) - normalizeNumber(line.credit);
    }, 0);

    if (Math.abs(cashDelta) < 0.01) {
      return [];
    }

    return [{
      date: group.date,
      delta: round(cashDelta),
    }];
  });
}

function buildEmptyBuckets({ startDate, endDate, granularity = 'month' }) {
  const buckets = {};
  const rangeStart = new Date(`${startDate}T00:00:00`);
  const rangeEnd = new Date(`${endDate}T00:00:00`);
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  while (cursor <= lastMonth) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES[cursor.getMonth()];

    if (granularity === 'week') {
      for (let week = 1; week <= 4; week += 1) {
        const key = `${ym}-S${week}`;
        buckets[key] = { key, month: key, label: `${monthLabel} S${week}`, income: 0, expenses: 0, net: 0 };
      }
    } else {
      buckets[ym] = { key: ym, month: ym, label: monthLabel, income: 0, expenses: 0, net: 0 };
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function buildCashFlowData(entries, accounts, period) {
  const buckets = buildEmptyBuckets({
    startDate: period.startDate,
    endDate: period.endDate,
    granularity: 'month',
  });

  const accountMap = new Map((accounts || []).map((account) => [account.account_code, account]));
  const cashMovements = aggregateCashEntryGroups(entries, accountMap);

  for (const movement of cashMovements) {
    const group = getGroupKey(movement.date, 'month');
    if (!group || !buckets[group.key]) {
      continue;
    }

    if (movement.delta >= 0) {
      buckets[group.key].income += movement.delta;
    } else {
      buckets[group.key].expenses += Math.abs(movement.delta);
    }
  }

  return Object.values(buckets).map((bucket) => ({
    ...bucket,
    income: round(bucket.income),
    expenses: round(bucket.expenses),
    net: round(bucket.income - bucket.expenses),
  }));
}

async function loadReferenceData(serviceClient) {
  try {
    const [benchmarksRes, multiplesRes, waccRes] = await Promise.all([
      serviceClient.from('reference_sector_benchmarks').select('*'),
      serviceClient.from('reference_sector_multiples').select('*'),
      serviceClient.from('reference_region_wacc').select('*'),
    ]);

    for (const response of [benchmarksRes, multiplesRes, waccRes]) {
      if (response.error) {
        throw response.error;
      }
    }

    return {
      sectorBenchmarksBySector: (benchmarksRes.data || []).reduce((accumulator, row) => {
        const sector = row.sector || 'b2b_services';
        if (!accumulator[sector]) {
          accumulator[sector] = {};
        }

        accumulator[sector][row.metric_key] = {
          low: normalizeNumber(row.low_value),
          target: normalizeNumber(row.target_value),
          high: normalizeNumber(row.high_value),
        };
        return accumulator;
      }, {}),
      sectorMultiplesBySector: (multiplesRes.data || []).reduce((accumulator, row) => {
        const sector = row.sector || 'b2b_services';
        if (!accumulator[sector]) {
          accumulator[sector] = {};
        }

        accumulator[sector][row.region] = {
          low: normalizeNumber(row.low_value),
          mid: normalizeNumber(row.mid_value),
          high: normalizeNumber(row.high_value),
        };
        return accumulator;
      }, {}),
      regionWaccByRegion: (waccRes.data || []).reduce((accumulator, row) => {
        accumulator[row.region] = {
          riskFree: normalizeNumber(row.risk_free_rate) * 100,
          premium: normalizeNumber(row.equity_premium) * 100,
          beta: normalizeNumber(row.beta),
          wacc: normalizeNumber(row.wacc) * 100,
        };
        return accumulator;
      }, {}),
    };
  } catch (error) {
    console.warn('Reference data unavailable for smoke, continuing with empty benchmarks:', error?.message || error);
    return {
      sectorBenchmarksBySector: {},
      sectorMultiplesBySector: {},
      regionWaccByRegion: {},
    };
  }
}

function getSectorBenchmarks(referenceData, sector) {
  return (
    referenceData.sectorBenchmarksBySector[sector] ||
    referenceData.sectorBenchmarksBySector.b2b_services ||
    {}
  );
}

function getSectorMultiples(referenceData, sector, region) {
  const sectorData =
    referenceData.sectorMultiplesBySector[sector] ||
    referenceData.sectorMultiplesBySector.b2b_services ||
    null;

  if (!sectorData) {
    return { low: 0, mid: 0, high: 0 };
  }

  return sectorData[region] || sectorData.france || { low: 0, mid: 0, high: 0 };
}

function getWaccData(referenceData, region) {
  const data = referenceData.regionWaccByRegion[region] || referenceData.regionWaccByRegion.france;
  if (!data) {
    return {
      riskFreeRate: 0,
      equityPremium: 0,
      beta: 0,
      wacc: 0,
    };
  }

  return {
    riskFreeRate: data.riskFree / 100,
    equityPremium: data.premium / 100,
    beta: data.beta,
    wacc: data.wacc / 100,
  };
}

function evaluateRatio(value, benchmark, inverse = false) {
  if (benchmark == null || value == null) {
    return null;
  }

  if (inverse) {
    if (value <= benchmark.low) return 'excellent';
    if (value <= benchmark.target) return 'good';
    if (value <= benchmark.high) return 'average';
    if (value <= benchmark.high * 1.5) return 'poor';
    return 'critical';
  }

  if (value >= benchmark.high) return 'excellent';
  if (value >= benchmark.target) return 'good';
  if (value >= benchmark.low) return 'average';
  if (value >= benchmark.low * 0.5) return 'poor';
  return 'critical';
}

function calculateMultiplesValuation(ebitda, referenceData, sector, region) {
  const normalizedEbitda = normalizeNumber(ebitda);
  const empty = {
    lowValue: 0,
    midValue: 0,
    highValue: 0,
    multiple: { low: 0, mid: 0, high: 0 },
  };

  if (normalizedEbitda <= 0) {
    return empty;
  }

  const multiple = getSectorMultiples(referenceData, sector, region);
  if (multiple.low === 0 && multiple.mid === 0 && multiple.high === 0) {
    return empty;
  }

  return {
    lowValue: Math.round(normalizedEbitda * multiple.low),
    midValue: Math.round(normalizedEbitda * multiple.mid),
    highValue: Math.round(normalizedEbitda * multiple.high),
    multiple,
  };
}

function calculateDcfValuation(freeCashFlow, wacc, growthRate = 0.02, years = 5) {
  const fcf = normalizeNumber(freeCashFlow);
  const rate = normalizeNumber(wacc);
  const growth = Number.isFinite(growthRate) ? growthRate : 0;

  if (fcf <= 0 || rate <= 0 || rate <= growth || years <= 0) {
    return {
      dcfValue: 0,
      terminalValue: 0,
      presentValueCashFlows: 0,
      projections: [],
    };
  }

  const projections = [];
  let cumulativePresentValue = 0;

  for (let year = 1; year <= years; year += 1) {
    const projectedFcf = fcf * Math.pow(1 + growth, year);
    const discountFactor = 1 / Math.pow(1 + rate, year);
    const presentValue = projectedFcf * discountFactor;

    projections.push({
      year,
      fcf: Math.round(projectedFcf),
      discountFactor: round(discountFactor, 4),
      presentValue: Math.round(presentValue),
    });

    cumulativePresentValue += presentValue;
  }

  const lastFcf = fcf * Math.pow(1 + growth, years);
  const terminalValueUndiscounted = (lastFcf * (1 + growth)) / (rate - growth);
  const terminalDiscountFactor = 1 / Math.pow(1 + rate, years);
  const terminalValue = Math.round(terminalValueUndiscounted * terminalDiscountFactor);
  const presentValueCashFlows = Math.round(cumulativePresentValue);

  return {
    dcfValue: presentValueCashFlows + terminalValue,
    terminalValue,
    presentValueCashFlows,
    projections,
  };
}

function calculateWaccSensitivity(freeCashFlow, baseWacc, growthRate = 0.02) {
  const fcf = normalizeNumber(freeCashFlow);
  const wacc = normalizeNumber(baseWacc);

  if (fcf <= 0 || wacc <= 0) {
    return [];
  }

  const offsets = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];

  return offsets.flatMap((offset) => {
    const adjustedWacc = wacc + offset;
    if (adjustedWacc <= 0 || adjustedWacc <= growthRate) {
      return [];
    }

    const dcf = calculateDcfValuation(fcf, adjustedWacc, growthRate);
    const sign = offset > 0 ? '+' : '';

    return [{
      wacc: round(adjustedWacc, 4),
      waccPercent: `${(adjustedWacc * 100).toFixed(1)}%`,
      value: dcf.dcfValue,
      label: offset === 0 ? 'Base' : `${sign}${Math.round(offset * 100)}%`,
    }];
  });
}

function buildValuationSummary(referenceData, params) {
  const {
    ebitda = 0,
    freeCashFlow = 0,
    sector = 'b2b_services',
    region = 'france',
    growthRate = 0.02,
  } = params || {};

  const wacc = getWaccData(referenceData, region);
  const multiples = calculateMultiplesValuation(ebitda, referenceData, sector, region);
  const dcf = calculateDcfValuation(freeCashFlow, wacc.wacc, growthRate);
  const sensitivity = calculateWaccSensitivity(freeCashFlow, wacc.wacc, growthRate);

  let consensusLow = 0;
  let consensusMid = 0;
  let consensusHigh = 0;

  const hasMultiples = multiples.midValue > 0;
  const hasDcf = dcf.dcfValue > 0;

  if (hasMultiples && hasDcf) {
    consensusLow = Math.round(Math.min(multiples.lowValue, dcf.dcfValue * 0.85));
    consensusMid = Math.round((multiples.midValue + dcf.dcfValue) / 2);
    consensusHigh = Math.round(Math.max(multiples.highValue, dcf.dcfValue * 1.15));
  } else if (hasMultiples) {
    consensusLow = multiples.lowValue;
    consensusMid = multiples.midValue;
    consensusHigh = multiples.highValue;
  } else if (hasDcf) {
    consensusLow = Math.round(dcf.dcfValue * 0.85);
    consensusMid = dcf.dcfValue;
    consensusHigh = Math.round(dcf.dcfValue * 1.15);
  }

  return {
    inputs: {
      ebitda,
      freeCashFlow,
      sector,
      region,
      growthRate,
    },
    wacc,
    multiples,
    dcf,
    sensitivity,
    consensus: {
      lowValue: consensusLow,
      midValue: consensusMid,
      highValue: consensusHigh,
    },
  };
}

function buildAnalysisAvailability({
  accounts,
  entries,
  balanceSheet,
  incomeStatement,
  trialBalance,
  monthlyData,
  cashFlowData,
  financialDiagnostic,
  structureRatios,
  activityRatios,
  benchmarks,
  ratioEvaluations,
  valuation,
  valuationMode,
}) {
  const hasAccounts = (accounts?.length || 0) > 0;
  const hasEntries = (entries?.length || 0) > 0;
  const hasBalanceSheet =
    hasAccounts &&
    hasEntries &&
    (
      (balanceSheet?.assets?.length || 0) > 0 ||
      (balanceSheet?.liabilities?.length || 0) > 0 ||
      (balanceSheet?.equity?.length || 0) > 0 ||
      Math.abs(balanceSheet?.totalAssets || 0) > 0 ||
      Math.abs(balanceSheet?.totalLiabilities || 0) > 0 ||
      Math.abs(balanceSheet?.totalEquity || 0) > 0
    );
  const hasIncomeStatement =
    hasEntries &&
    (
      (incomeStatement?.revenueItems?.length || 0) > 0 ||
      (incomeStatement?.expenseItems?.length || 0) > 0 ||
      Math.abs(incomeStatement?.totalRevenue || 0) > 0 ||
      Math.abs(incomeStatement?.totalExpenses || 0) > 0 ||
      Math.abs(incomeStatement?.netIncome || 0) > 0
    );
  const hasTrialBalance = hasEntries && (trialBalance?.length || 0) > 0;
  const hasMonthlySeries = hasEntries && (monthlyData?.length || 0) > 0;
  const hasCashSeries = hasEntries && (cashFlowData?.length || 0) > 0;
  const hasMargins = hasIncomeStatement && hasFiniteMetric(financialDiagnostic?.margins);
  const hasFinancing = hasBalanceSheet && hasFiniteMetric(financialDiagnostic?.financing);
  const hasLiquidityRatios = hasBalanceSheet && hasFiniteMetric(financialDiagnostic?.ratios?.liquidity);
  const hasProfitabilityRatios = hasIncomeStatement && hasFiniteMetric(financialDiagnostic?.ratios?.profitability);
  const hasStructureRatios = hasBalanceSheet && hasFiniteMetric(structureRatios);
  const hasActivityRatios = hasEntries && hasFiniteMetric(activityRatios);
  const hasAlertsInputs = hasStructureRatios || hasActivityRatios || hasProfitabilityRatios || hasCashSeries;
  const hasPreTaxIncome =
    hasIncomeStatement &&
    Number.isFinite(financialDiagnostic?.tax?.preTaxIncome);
  const hasValuation = hasEntries && Boolean(valuation?.multiples?.midValue || valuation?.dcf?.dcfValue);
  const hasSensitivity = (valuation?.sensitivity?.length || 0) > 0;
  const hasBenchmarks = Object.keys(benchmarks || {}).length > 0;
  const hasRatioEvaluations = Object.values(ratioEvaluations || {}).some(Boolean);
  const hasCapitalStructure =
    hasFinancing &&
    ['equity', 'totalDebt', 'bfr'].some((key) =>
      Number.isFinite(financialDiagnostic?.financing?.[key])
    );
  const hasTrendSeries = hasEntries && (monthlyData?.length || 0) > 1;

  return {
    overview: {
      kpis: createAvailabilityItem(
        'overview.kpis',
        hasIncomeStatement || hasMargins || hasValuation ? 'ready' : 'unavailable',
        hasIncomeStatement || hasMargins || hasValuation
          ? []
          : ['chartOfAccounts', 'journalEntries', 'incomeStatement']
      ),
      performanceChart: createAvailabilityItem(
        'overview.performanceChart',
        hasMonthlySeries && hasCashSeries
          ? 'ready'
          : hasMonthlySeries
            ? 'partial'
            : 'unavailable',
        hasMonthlySeries && hasCashSeries
          ? []
          : hasMonthlySeries
            ? ['cashSeries']
            : ['journalEntries', 'monthlySeries', 'cashSeries']
      ),
      ratioStatus: createAvailabilityItem(
        'overview.ratioStatus',
        hasRatioEvaluations
          ? 'ready'
          : hasStructureRatios
            ? 'partial'
            : 'unavailable',
        hasRatioEvaluations
          ? []
          : hasStructureRatios
            ? ['benchmarkReference']
            : ['balanceSheet', 'incomeStatement', 'structureRatios']
      ),
      alerts: createAvailabilityItem(
        'overview.alerts',
        hasAlertsInputs ? 'ready' : 'unavailable',
        hasAlertsInputs ? [] : ['journalEntries', 'balanceSheet', 'cashSeries']
      ),
    },
    accounting: {
      structure: createAvailabilityItem(
        'accounting.structure',
        hasStructureRatios ? 'ready' : 'unavailable',
        hasStructureRatios ? [] : ['balanceSheet', 'incomeStatement', 'structureRatios']
      ),
      liquidity: createAvailabilityItem(
        'accounting.liquidity',
        hasLiquidityRatios ? 'ready' : 'unavailable',
        hasLiquidityRatios ? [] : ['balanceSheet', 'incomeStatement']
      ),
      activity: createAvailabilityItem(
        'accounting.activity',
        hasActivityRatios ? 'ready' : 'unavailable',
        hasActivityRatios ? [] : ['journalEntries', 'incomeStatement', 'activityRatios']
      ),
      trialBalance: createAvailabilityItem(
        'accounting.trialBalance',
        hasTrialBalance ? 'ready' : 'unavailable',
        hasTrialBalance ? [] : ['chartOfAccounts', 'journalEntries', 'trialBalance']
      ),
    },
    financial: {
      margins: createAvailabilityItem(
        'financial.margins',
        hasMargins ? 'ready' : 'unavailable',
        hasMargins ? [] : ['incomeStatement', 'journalEntries']
      ),
      financing: createAvailabilityItem(
        'financial.financing',
        hasFinancing ? 'ready' : 'unavailable',
        hasFinancing ? [] : ['balanceSheet', 'journalEntries', 'financingData']
      ),
      profitability: createAvailabilityItem(
        'financial.profitability',
        hasProfitabilityRatios ? 'ready' : 'unavailable',
        hasProfitabilityRatios ? [] : ['incomeStatement', 'balanceSheet', 'profitabilityRatios']
      ),
      capitalStructure: createAvailabilityItem(
        'financial.capitalStructure',
        hasCapitalStructure ? 'ready' : 'unavailable',
        hasCapitalStructure ? [] : ['balanceSheet', 'financingData']
      ),
      profitabilityTrend: createAvailabilityItem(
        'financial.profitabilityTrend',
        hasTrendSeries ? 'ready' : 'unavailable',
        hasTrendSeries ? [] : ['journalEntries', 'monthlySeries']
      ),
    },
    taxValuation: {
      tax: createAvailabilityItem(
        'taxValuation.tax',
        hasPreTaxIncome ? 'ready' : 'unavailable',
        hasPreTaxIncome ? [] : ['incomeStatement', 'taxBase']
      ),
      valuation: createAvailabilityItem(
        'taxValuation.valuation',
        hasValuation
          ? valuationMode === 'full'
            ? 'ready'
            : 'partial'
          : 'unavailable',
        hasValuation
          ? valuationMode === 'full'
            ? []
            : ['valuationInputs']
          : ['incomeStatement', 'cashSeries', 'valuationInputs']
      ),
      sensitivity: createAvailabilityItem(
        'taxValuation.sensitivity',
        hasSensitivity ? 'ready' : 'unavailable',
        hasSensitivity ? [] : ['valuationInputs']
      ),
      benchmark: createAvailabilityItem(
        'taxValuation.benchmark',
        hasBenchmarks && hasRatioEvaluations
          ? 'ready'
          : hasBenchmarks
            ? 'partial'
            : 'unavailable',
        hasBenchmarks && hasRatioEvaluations
          ? []
          : hasBenchmarks
            ? ['benchmarkReference', 'profitabilityRatios']
            : ['benchmarkReference', 'profitabilityRatios', 'structureRatios']
      ),
    },
    inputs: {
      hasAccounts,
      hasEntries,
      hasBalanceSheet,
      hasIncomeStatement,
      hasTrialBalance,
      hasMonthlySeries,
      hasCashSeries,
    },
  };
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getAnnualizationFactor(startDate, endDate) {
  if (!startDate || !endDate) {
    return 1;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const durationMs = end.getTime() - start.getTime();

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 1;
  }

  const periodDays = Math.max(1, Math.round(durationMs / 86400000) + 1);
  return 365 / periodDays;
}

function buildScenarioWindow() {
  const baseDate = new Date();
  const endDate = addMonths(baseDate, 12);

  return {
    baseDate: formatDateInput(baseDate),
    endDate: formatDateInput(endDate),
  };
}

function buildResultMetrics(result) {
  return {
    revenue: result.revenue,
    expenses: result.expenses,
    grossMargin: result.grossMargin,
    ebitda: result.ebitda,
    ebitdaMargin: result.ebitdaMargin,
    depreciation: result.depreciation,
    operatingResult: result.operatingResult,
    operatingMargin: result.operatingMargin,
    netIncome: result.netIncome,
    netMargin: result.netMargin,
    caf: result.caf,
    bfrChange: result.bfrChange,
    operatingCashFlow: result.operatingCashFlow,
    cashBalance: result.cashBalance,
    currentAssets: result.currentAssets,
    fixedAssets: result.fixedAssets,
    totalAssets: result.totalAssets,
    currentLiabilities: result.currentLiabilities,
    debt: result.debt,
    totalLiabilities: result.totalLiabilities,
    equity: result.equity,
    bfr: result.bfr,
    currentRatio: result.currentRatio,
    quickRatio: result.quickRatio,
    cashRatio: result.cashRatio,
    debtToEquity: result.debtToEquity,
    roe: result.roe,
    roce: result.roce,
  };
}

function buildCurrentFinancialState(period, financialDiagnostic, balanceSheet, region) {
  const annualizationFactor = getAnnualizationFactor(period.startDate, period.endDate);
  const annualRevenue = normalizeNumber(financialDiagnostic?.margins?.revenue) * annualizationFactor;
  const annualExpenses =
    Math.max(
      0,
      (
        normalizeNumber(financialDiagnostic?.margins?.revenue) -
        normalizeNumber(financialDiagnostic?.margins?.ebitda)
      ) * annualizationFactor
    ) ||
    calculateExpensesFromEntries([], [], period.startDate, period.endDate);
  const financialPosition = extractFinancialPosition(balanceSheet, region);

  return {
    revenue: annualRevenue,
    avgPrice: 100,
    volume: annualRevenue / 100 || 0,
    expenses: annualExpenses,
    fixedExpenses: annualExpenses * 0.6,
    variableExpenses: annualExpenses * 0.3,
    salaries: annualExpenses * 0.1,
    cash: financialPosition.cash || 0,
    receivables: financialPosition.receivables || 0,
    payables: financialPosition.tradePayables || 0,
    inventory: financialPosition.inventory || 0,
    fixedAssets: financialPosition.fixedAssets || 0,
    equity: financialPosition.equity || 0,
    debt: financialPosition.totalDebt || 0,
    bfr: normalizeNumber(financialDiagnostic?.financing?.bfr),
  };
}

async function fetchDataset(client, userId) {
  const [
    companiesRes,
    preferenceRes,
    settingsRes,
    accountsRes,
    entriesRes,
    clientsRes,
    invoicesRes,
    expensesRes,
    scenariosRes,
    recurringInvoicesRes,
    creditNotesRes,
    deliveryNotesRes,
    receivablesRes,
    payablesRes,
    purchaseOrders,
    suppliers,
    products,
    services,
    productCategories,
    serviceCategories,
    supplierOrders,
    supplierInvoices,
    stockHistory,
    stockAlerts,
    bankConnections,
    bankSyncHistory,
    bankTransactions,
    peppolLogs,
    fixedAssets,
    analyticalAxes,
    snapshots,
    quotes,
    projects,
    timesheets,
    payments,
  ] = await Promise.all([
    client.from('company').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    fetchOptionalTable(
      () => client.from('user_company_preferences').select('active_company_id').eq('user_id', userId).maybeSingle(),
      null
    ),
    client.from('user_accounting_settings').select('*').eq('user_id', userId).maybeSingle(),
    client.from('accounting_chart_of_accounts').select('*').eq('user_id', userId).order('account_code', { ascending: true }),
    client.from('accounting_entries').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
    fetchOptionalTable(
      () => client.from('clients').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    client.from('invoices').select('*').eq('user_id', userId).order('date', { ascending: false }),
    client.from('expenses').select('*').eq('user_id', userId).order('expense_date', { ascending: false }),
    client.from('financial_scenarios').select('id, status, company_id').eq('user_id', userId).order('created_at', { ascending: false }),
    fetchOptionalTable(
      () => client.from('recurring_invoices').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('credit_notes').select('*').eq('user_id', userId).order('date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('delivery_notes').select('*').eq('user_id', userId).order('date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('receivables').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('payables').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('purchase_orders').select('*').eq('user_id', userId).order('date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('suppliers').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('services').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('product_categories').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('service_categories').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('supplier_orders').select('*').eq('user_id', userId).order('order_date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('supplier_invoices').select('*').order('invoice_date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('product_stock_history').select('*').order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('stock_alerts').select('*').order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('bank_connections').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('bank_sync_history').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('bank_transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('peppol_transmission_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('accounting_fixed_assets').select('*').eq('user_id', userId).order('acquisition_date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('accounting_analytical_axes').select('*').eq('user_id', userId).eq('is_active', true).order('axis_type'),
      []
    ),
    fetchOptionalTable(
      () => client.from('dashboard_snapshots').select('id, company_id, snapshot_type, is_public').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('quotes').select('id, company_id, signature_status, signature_token, signature_url').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('projects').select('id, company_id').eq('user_id', userId).order('created_at', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('timesheets').select('*').eq('user_id', userId).order('date', { ascending: false }),
      []
    ),
    fetchOptionalTable(
      () => client.from('payments').select('id, company_id, amount').eq('user_id', userId).order('payment_date', { ascending: false }),
      []
    ),
  ]);

  for (const response of [companiesRes, settingsRes, accountsRes, entriesRes, invoicesRes, expensesRes, scenariosRes]) {
    if (response.error) {
      throw response.error;
    }
  }

  const companies = companiesRes.data || [];
  const preferredCompanyId = preferenceRes?.active_company_id || null;
  const activeCompany = companies.find((company) => company.id === preferredCompanyId) || companies[0] || null;
  const activeCompanyId = activeCompany?.id || null;
  const filterActiveCompany = (rows) => (
    !activeCompanyId
      ? (rows || [])
      : (rows || []).filter((row) => row.company_id === activeCompanyId)
  );

  const companyCoverage = companies.map((company) => ({
    id: company.id,
    name: company.company_name,
    clients: (clientsRes || []).filter((row) => row.company_id === company.id).length,
    invoices: (invoicesRes.data || []).filter((row) => row.company_id === company.id).length,
    quotes: (quotes || []).filter((row) => row.company_id === company.id).length,
    expenses: (expensesRes.data || []).filter((row) => row.company_id === company.id).length,
    projects: (projects || []).filter((row) => row.company_id === company.id).length,
    products: (products || []).filter((row) => row.company_id === company.id).length,
    payments: (payments || []).filter((row) => row.company_id === company.id).length,
    entries: (entriesRes.data || []).filter((row) => row.company_id === company.id).length,
    recurringInvoices: (recurringInvoicesRes || []).filter((row) => row.company_id === company.id).length,
    creditNotes: (creditNotesRes || []).filter((row) => row.company_id === company.id).length,
    deliveryNotes: (deliveryNotesRes || []).filter((row) => row.company_id === company.id).length,
    receivables: (receivablesRes || []).filter((row) => row.company_id === company.id).length,
    payables: (payablesRes || []).filter((row) => row.company_id === company.id).length,
    purchaseOrders: (purchaseOrders || []).filter((row) => row.company_id === company.id).length,
    fixedAssets: (fixedAssets || []).filter((row) => row.company_id === company.id).length,
    snapshots: (snapshots || []).filter((row) => row.company_id === company.id).length,
    supplierOrders: (supplierOrders || []).filter((row) => row.company_id === company.id).length,
    supplierInvoices: (supplierInvoices || []).filter((row) => row.company_id === company.id).length,
    stockEvents: (stockHistory || []).filter((row) => row.company_id === company.id).length,
    bankConnections: (bankConnections || []).filter((row) => row.company_id === company.id).length,
    bankSyncHistory: (bankSyncHistory || []).filter((row) => row.company_id === company.id).length,
    bankTransactions: (bankTransactions || []).filter((row) => row.company_id === company.id).length,
    peppolLogs: (peppolLogs || []).filter((row) => row.company_id === company.id).length,
    scenarios: (scenariosRes.data || []).filter((row) => row.company_id === company.id).length,
    timesheets: (timesheets || []).filter((row) => row.company_id === company.id).length,
  }));

  return {
    company: activeCompany,
    companies,
    activeCompanyId,
    preferredCompanyId,
    companyCoverage,
    accountingSettings: settingsRes.data,
    accounts: accountsRes.data || [],
    clients: filterActiveCompany(clientsRes || []),
    entries: filterActiveCompany(entriesRes.data || []),
    invoices: filterActiveCompany(invoicesRes.data || []),
    expenses: filterActiveCompany(expensesRes.data || []),
    recurringInvoices: filterActiveCompany(recurringInvoicesRes || []),
    creditNotes: filterActiveCompany(creditNotesRes || []),
    deliveryNotes: filterActiveCompany(deliveryNotesRes || []),
    receivables: filterActiveCompany(receivablesRes || []),
    payables: filterActiveCompany(payablesRes || []),
    purchaseOrders: filterActiveCompany(purchaseOrders || []),
    suppliers: suppliers || [],
    products: filterActiveCompany(products || []),
    services: services || [],
    productCategories: filterActiveCompany(productCategories || []),
    serviceCategories: serviceCategories || [],
    supplierOrders: filterActiveCompany(supplierOrders || []),
    supplierInvoices: filterActiveCompany(supplierInvoices || []),
    scenarios: filterActiveCompany(scenariosRes.data || []),
    stockHistory: filterActiveCompany(stockHistory || []),
    stockAlerts: filterActiveCompany(stockAlerts || []),
    bankConnections: filterActiveCompany(bankConnections || []),
    bankSyncHistory: filterActiveCompany(bankSyncHistory || []),
    bankTransactions: filterActiveCompany(bankTransactions || []),
    peppolLogs: filterActiveCompany(peppolLogs || []),
    fixedAssets: filterActiveCompany(fixedAssets || []),
    analyticalAxes: analyticalAxes || [],
    snapshots: snapshots || [],
    quotes: quotes || [],
    projects: projects || [],
    timesheets: filterActiveCompany(timesheets || []),
    payments: payments || [],
    allEntries: entriesRes.data || [],
    allInvoices: invoicesRes.data || [],
  };
}

function buildPilotageSnapshot(dataset, referenceData, period) {
  const regionInfo = resolvePilotageRegion({
    accountingCountry: dataset.accountingSettings?.country,
    companyCountry: dataset.company?.country,
  });
  const region = regionInfo.region;
  const sector = normalizePilotageSector(dataset.company?.business_sector);

  const balanceSheet = buildBalanceSheetFromEntries(
    dataset.accounts,
    dataset.entries,
    period.startDate,
    period.endDate
  );
  const incomeStatement = buildIncomeStatementFromEntries(
    dataset.accounts,
    dataset.entries,
    period.startDate,
    period.endDate
  );
  const previousEndDate = new Date(`${period.startDate}T00:00:00`);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousBalanceSheet = buildBalanceSheetFromEntries(
    dataset.accounts,
    dataset.entries,
    null,
    formatDateInput(previousEndDate)
  );
  const financialDiagnostic = buildFinancialDiagnostic(
    dataset.entries,
    dataset.accounts,
    balanceSheet,
    incomeStatement,
    period.startDate,
    period.endDate,
    {
      balanceSheet: previousBalanceSheet,
      financing: {
        bfr: calculateBFR(previousBalanceSheet, region),
      },
    },
    region
  );
  const qualityGate = evaluateAccountingDatasetQuality({
    accounts: dataset.accounts,
    entries: dataset.entries,
    regionHint: region,
  });
  const monthlyData = buildMonthlyChartDataFromEntries(
    dataset.entries,
    dataset.accounts,
    period.startDate,
    period.endDate
  );
  const cashFlowData = buildCashFlowData(dataset.entries, dataset.accounts, period);
  const trialBalance = buildTrialBalance(
    dataset.entries.filter((entry) => {
      if (!entry?.transaction_date) return false;
      return entry.transaction_date >= period.startDate && entry.transaction_date <= period.endDate;
    }),
    dataset.accounts
  );
  const financialPosition = extractFinancialPosition(balanceSheet, region);
  const revenue = normalizeNumber(financialDiagnostic?.margins?.revenue);
  const ebitda = normalizeNumber(financialDiagnostic?.margins?.ebitda);
  const freeCashFlow =
    normalizeNumber(financialDiagnostic?.financing?.operatingCashFlow) -
    normalizeNumber(financialDiagnostic?.financing?.capex);
  const structureRatios = {
    financialIndependence:
      financialPosition.totalAssets > 0
        ? (financialPosition.equity / financialPosition.totalAssets) * 100
        : null,
    gearing:
      financialPosition.equity !== 0
        ? normalizeNumber(financialDiagnostic?.financing?.netDebt) / financialPosition.equity
        : 0,
    currentRatio: financialDiagnostic?.ratios?.liquidity?.currentRatio ?? null,
  };
  const activityRatios = {
    dso:
      revenue === 0
        ? (financialPosition.receivables === 0 ? 0 : null)
        : (financialPosition.receivables / revenue) * 365,
    dpo:
      revenue === 0
        ? (financialPosition.tradePayables === 0 ? 0 : null)
        : (financialPosition.tradePayables / revenue) * 365,
    bfrToRevenue:
      revenue === 0
        ? (normalizeNumber(financialDiagnostic?.financing?.bfr) === 0 ? 0 : null)
        : (normalizeNumber(financialDiagnostic?.financing?.bfr) / revenue) * 100,
  };
  const benchmarks = getSectorBenchmarks(referenceData, sector);
  const ratioEvaluations = {
    dso: evaluateRatio(activityRatios.dso, benchmarks.dso, true),
    dpo: evaluateRatio(activityRatios.dpo, benchmarks.dpo, false),
    bfrToRevenue: evaluateRatio(activityRatios.bfrToRevenue, benchmarks.bfrToRevenue, true),
    currentRatio: evaluateRatio(structureRatios.currentRatio, benchmarks.currentRatio, false),
    roe: evaluateRatio(financialDiagnostic?.ratios?.profitability?.roe, benchmarks.roe, false),
    operatingMargin: evaluateRatio(financialDiagnostic?.margins?.operatingMargin, benchmarks.operatingMargin, false),
    grossMargin: evaluateRatio(financialDiagnostic?.margins?.grossMarginPercent, benchmarks.grossMargin, false),
    netMargin: evaluateRatio(financialDiagnostic?.ratios?.profitability?.netMargin, benchmarks.netMargin, false),
  };
  const valuationMode =
    qualityGate?.canRunPilotage === false
      ? 'unavailable'
      : freeCashFlow > 0
        ? 'full'
        : ebitda > 0
          ? 'multiples-only'
          : 'unavailable';
  const valuation = buildValuationSummary(referenceData, {
    ebitda,
    freeCashFlow,
    sector,
    region,
    growthRate: 0.02,
  });
  const taxSynthesis = buildTaxSynthesis({
    preTaxIncome: normalizeNumber(financialDiagnostic?.tax?.preTaxIncome),
    revenue,
    rdExpenses: 0,
    region,
    isSmallBusiness: dataset.company?.company_type === 'freelance',
  });
  const analysisAvailability = buildAnalysisAvailability({
    accounts: dataset.accounts,
    entries: dataset.entries,
    balanceSheet,
    incomeStatement,
    trialBalance,
    monthlyData,
    cashFlowData,
    financialDiagnostic,
    structureRatios,
    activityRatios,
    benchmarks,
    ratioEvaluations,
    valuation,
    valuationMode,
  });

  return {
    region,
    regionSource: regionInfo.source,
    sector,
    balanceSheet,
    incomeStatement,
    previousBalanceSheet,
    financialDiagnostic,
    qualityGate,
    monthlyData,
    cashFlowData,
    trialBalance,
    structureRatios,
    activityRatios,
    benchmarks,
    ratioEvaluations,
    valuationMode,
    valuation,
    taxSynthesis,
    analysisAvailability,
  };
}

async function createScenarioArtifacts(client, userId, baseDate, endDate) {
  const scenarioName = `__codex_pilotage_smoke__${Date.now()}`;
  const { data: scenario, error: scenarioError } = await client
    .from('financial_scenarios')
    .insert([{
      user_id: userId,
      name: scenarioName,
      description: 'Temporary pilotage smoke test scenario created by Codex',
      base_date: baseDate,
      end_date: endDate,
      status: 'draft',
      is_baseline: false,
    }])
    .select()
    .single();

  if (scenarioError) {
    throw scenarioError;
  }

  const assumptions = [
    {
      scenario_id: scenario.id,
      name: 'Croissance CA +5%',
      description: 'Smoke test assumption',
      category: 'revenue',
      assumption_type: 'growth_rate',
      parameters: { rate: 5 },
      start_date: baseDate,
      end_date: endDate,
    },
    {
      scenario_id: scenario.id,
      name: 'Reduction couts fixes 2%',
      description: 'Smoke test assumption',
      category: 'expense_reduction',
      assumption_type: 'percentage_change',
      parameters: { rate: 2 },
      start_date: baseDate,
      end_date: endDate,
    },
    {
      scenario_id: scenario.id,
      name: 'Charges additionnelles recurrentes',
      description: 'Smoke test assumption',
      category: 'social_charges',
      assumption_type: 'recurring',
      parameters: { amount: 10000 },
      start_date: baseDate,
      end_date: endDate,
    },
  ];

  const { data: insertedAssumptions, error: assumptionsError } = await client
    .from('scenario_assumptions')
    .insert(assumptions)
    .select('*');

  if (assumptionsError) {
    await cleanupScenarioArtifacts(client, scenario.id);
    throw assumptionsError;
  }

  return {
    scenario,
    assumptions: insertedAssumptions || [],
  };
}

async function cleanupScenarioArtifacts(client, scenarioId) {
  if (!scenarioId) return;

  await client.from('scenario_results').delete().eq('scenario_id', scenarioId);
  await client.from('scenario_assumptions').delete().eq('scenario_id', scenarioId);
  await client.from('financial_scenarios').delete().eq('id', scenarioId);
}

async function runSimulatorSmoke(client, userId, pilotageSnapshot, period) {
  const engine = new FinancialSimulationEngine();
  const { baseDate, endDate } = buildScenarioWindow();
  const currentFinancialState = buildCurrentFinancialState(
    period,
    pilotageSnapshot.financialDiagnostic,
    pilotageSnapshot.balanceSheet,
    pilotageSnapshot.region
  );
  let scenarioId = null;

  try {
    const artifacts = await createScenarioArtifacts(client, userId, baseDate, endDate);
    scenarioId = artifacts.scenario.id;
    const results = await engine.simulateScenario(
      artifacts.scenario,
      artifacts.assumptions,
      currentFinancialState
    );

    const { error: deleteResultsError } = await client
      .from('scenario_results')
      .delete()
      .eq('scenario_id', artifacts.scenario.id);

    if (deleteResultsError) {
      throw deleteResultsError;
    }

    const { error: insertResultsError } = await client
      .from('scenario_results')
      .insert(results.map((result) => ({
        scenario_id: artifacts.scenario.id,
        calculation_date: result.date,
        period_label: result.period_label,
        metrics: buildResultMetrics(result),
      })));

    if (insertResultsError) {
      throw insertResultsError;
    }

    const { error: updateScenarioError } = await client
      .from('financial_scenarios')
      .update({ status: 'completed' })
      .eq('id', artifacts.scenario.id);

    if (updateScenarioError) {
      throw updateScenarioError;
    }

    const { data: persistedResults, error: persistedResultsError } = await client
      .from('scenario_results')
      .select('id, calculation_date, period_label, metrics')
      .eq('scenario_id', artifacts.scenario.id)
      .order('calculation_date', { ascending: true });

    if (persistedResultsError) {
      throw persistedResultsError;
    }

    return {
      passed: (persistedResults || []).length > 0,
      scenarioId: artifacts.scenario.id,
      assumptionsCount: artifacts.assumptions.length,
      resultsCount: (persistedResults || []).length,
      firstPeriod: persistedResults?.[0]?.metrics || null,
      lastPeriod: persistedResults?.[persistedResults.length - 1]?.metrics || null,
    };
  } finally {
    await cleanupScenarioArtifacts(client, scenarioId);
  }
}

async function runAuditSmoke(session, period) {
  const url = `${requireEnv('SUPABASE_URL')}/functions/v1/audit-comptable`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      period_start: period.startDate,
      period_end: period.endDate,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`audit-comptable failed with HTTP ${response.status}: ${payload}`);
  }

  const payload = await response.json();
  const categoryCount = Object.keys(payload?.categories || {}).length;

  return {
    passed: Number.isFinite(payload?.score) && categoryCount > 0,
    score: payload?.score ?? null,
    grade: payload?.grade ?? null,
    country: payload?.country ?? null,
    totalChecks: payload?.summary?.total_checks ?? null,
    warnings: payload?.summary?.warnings ?? null,
    errors: payload?.summary?.errors ?? null,
    categoryCount,
  };
}

function summarizeTabs(analysisAvailability, simulatorResult, auditResult) {
  const overviewStatus = collapseSectionAvailability(analysisAvailability.overview);
  const accountingStatus = collapseSectionAvailability(analysisAvailability.accounting);
  const financialStatus = collapseSectionAvailability(analysisAvailability.financial);
  const taxValuationStatus = collapseSectionAvailability(analysisAvailability.taxValuation);

  return {
    overview: {
      status: overviewStatus,
      passed: overviewStatus !== 'unavailable',
      items: analysisAvailability.overview,
    },
    accounting: {
      status: accountingStatus,
      passed: accountingStatus !== 'unavailable',
      items: analysisAvailability.accounting,
    },
    financial: {
      status: financialStatus,
      passed: financialStatus !== 'unavailable',
      items: analysisAvailability.financial,
    },
    taxValuation: {
      status: taxValuationStatus,
      passed: taxValuationStatus !== 'unavailable',
      items: analysisAvailability.taxValuation,
    },
    simulator: simulatorResult,
    aiAudit: auditResult,
  };
}

async function smokeAccount(authKey, account, period, referenceData) {
  const client = createClient(requireEnv('SUPABASE_URL'), authKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const password = getDemoPassword(account);
  const authResult = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });

  if (authResult.error) {
    throw authResult.error;
  }

  const session = authResult.data.session;
  const user = authResult.data.user;

  if (!session?.access_token || !user?.id) {
    throw new Error(`Authentication succeeded without an active session for ${account.email}.`);
  }

  const dataset = await fetchDataset(client, user.id);
  const pilotageSnapshot = buildPilotageSnapshot(dataset, referenceData, period);
  const simulatorResult = await runSimulatorSmoke(client, user.id, pilotageSnapshot, period);
  const auditResult = await runAuditSmoke(session, period);
  const tabs = summarizeTabs(pilotageSnapshot.analysisAvailability, simulatorResult, auditResult);
  const tabFailures = Object.entries(tabs)
    .filter(([, result]) => result?.passed === false)
    .map(([tab]) => tab);
  const multiCompanyReady =
    dataset.companies.length >= MIN_DEMO_ROWS &&
    dataset.companyCoverage.every((company) =>
      company.clients >= MIN_DEMO_ROWS &&
      company.invoices >= MIN_DEMO_ROWS &&
      company.quotes >= MIN_DEMO_ROWS &&
      company.expenses >= MIN_DEMO_ROWS &&
      company.projects >= MIN_DEMO_ROWS &&
      company.products >= MIN_DEMO_ROWS &&
      company.supplierOrders >= MIN_DEMO_ROWS &&
      company.supplierInvoices >= MIN_DEMO_ROWS &&
      company.stockEvents >= MIN_DEMO_ROWS &&
      company.recurringInvoices >= MIN_DEMO_ROWS &&
      company.creditNotes >= MIN_DEMO_ROWS &&
      company.deliveryNotes >= MIN_DEMO_ROWS &&
      company.receivables >= MIN_DEMO_ROWS &&
      company.payables >= MIN_DEMO_ROWS &&
      company.purchaseOrders >= MIN_DEMO_ROWS &&
      company.bankConnections >= MIN_DEMO_ROWS &&
      company.bankTransactions >= MIN_DEMO_ROWS &&
      company.peppolLogs >= MIN_DEMO_ROWS &&
      company.scenarios >= MIN_DEMO_ROWS &&
      company.timesheets >= MIN_DEMO_ROWS &&
      company.entries > 0
    );
  const featureCoverage = {
    multiCompany: multiCompanyReady,
    fixedAssets: dataset.fixedAssets.length >= 2 && dataset.companyCoverage.every((company) => company.fixedAssets >= MIN_DEMO_ROWS),
    analyticalAccounting: dataset.analyticalAxes.length >= MIN_DEMO_ROWS && dataset.entries.some((entry) => entry.cost_center || entry.department || entry.product_line),
    sharedSnapshots: dataset.snapshots.length >= 3 && dataset.companyCoverage.some((company) => company.snapshots > 0),
    quoteSignature:
      dataset.quotes.some((quote) => quote.signature_status === 'pending' && quote.signature_token) &&
      dataset.quotes.some((quote) => quote.signature_status === 'signed' && quote.signature_url),
    stripePaymentLinks: dataset.allInvoices.some((invoice) => invoice.stripe_payment_link_url) && dataset.allInvoices.some((invoice) => invoice.stripe_payment_intent_id),
  };
  const featureFailures = Object.entries(featureCoverage)
    .filter(([, passed]) => !passed)
    .map(([feature]) => `feature:${feature}`);
  const screenCoverage = {
    clientsPage: dataset.clients.length >= MIN_DEMO_ROWS,
    portfolioPage:
      dataset.companies.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) =>
        company.clients >= MIN_DEMO_ROWS &&
        company.invoices >= MIN_DEMO_ROWS &&
        company.projects >= MIN_DEMO_ROWS &&
        company.products >= MIN_DEMO_ROWS
      ),
    invoicesPage: dataset.invoices.length >= MIN_DEMO_ROWS,
    quotesPage: dataset.quotes.length >= MIN_DEMO_ROWS,
    expensesPage: dataset.expenses.length >= MIN_DEMO_ROWS,
    recurringInvoicesPage:
      dataset.recurringInvoices.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.recurringInvoices >= MIN_DEMO_ROWS),
    creditNotesPage:
      dataset.creditNotes.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.creditNotes >= MIN_DEMO_ROWS),
    deliveryNotesPage:
      dataset.deliveryNotes.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.deliveryNotes >= MIN_DEMO_ROWS),
    debtManagerPage:
      dataset.receivables.length >= MIN_DEMO_ROWS &&
      dataset.payables.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.receivables >= MIN_DEMO_ROWS && company.payables >= MIN_DEMO_ROWS),
    purchaseOrdersPage:
      dataset.purchaseOrders.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.purchaseOrders >= MIN_DEMO_ROWS),
    purchasesPage:
      dataset.purchaseOrders.length >= MIN_DEMO_ROWS &&
      dataset.supplierOrders.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.supplierOrders >= MIN_DEMO_ROWS),
    suppliersPage: dataset.suppliers.length >= MIN_DEMO_ROWS,
    supplierInvoicesPage:
      dataset.supplierInvoices.length >= MIN_DEMO_ROWS &&
      dataset.supplierInvoices.some((invoice) => invoice.payment_status === 'paid') &&
      dataset.supplierInvoices.some((invoice) => invoice.payment_status === 'pending') &&
      dataset.companyCoverage.every((company) => company.supplierInvoices >= MIN_DEMO_ROWS),
    servicesPage: dataset.services.length >= MIN_DEMO_ROWS,
    categoriesPage:
      dataset.productCategories.length >= MIN_DEMO_ROWS &&
      dataset.serviceCategories.length >= MIN_DEMO_ROWS,
    stockManagementPage:
      dataset.products.length >= MIN_DEMO_ROWS &&
      dataset.stockHistory.length >= MIN_DEMO_ROWS &&
      dataset.stockAlerts.length >= MIN_DEMO_ROWS &&
      dataset.companyCoverage.every((company) => company.stockEvents >= MIN_DEMO_ROWS),
    bankConnectionsPage:
      dataset.bankConnections.length >= MIN_DEMO_ROWS &&
      dataset.bankTransactions.length >= MIN_DEMO_ROWS &&
      dataset.bankSyncHistory.some((sync) => sync.status === 'success') &&
      dataset.bankConnections.some((connection) => connection.status === 'expired' || connection.status === 'error') &&
      dataset.companyCoverage.every((company) => company.bankConnections >= MIN_DEMO_ROWS && company.bankTransactions >= MIN_DEMO_ROWS),
    scenariosPage:
      dataset.scenarios.length >= MIN_DEMO_ROWS &&
      dataset.scenarios.every((scenario) => scenario.status === 'completed') &&
      dataset.companyCoverage.every((company) => company.scenarios >= MIN_DEMO_ROWS),
    peppolPage:
      dataset.peppolLogs.length >= MIN_DEMO_ROWS &&
      dataset.peppolLogs.some((log) => log.direction === 'outbound' && log.status === 'delivered') &&
      dataset.peppolLogs.some((log) => log.direction === 'outbound' && log.status === 'pending') &&
      dataset.peppolLogs.some((log) => log.direction === 'inbound' && log.status === 'accepted') &&
      dataset.companyCoverage.every((company) => company.peppolLogs >= MIN_DEMO_ROWS),
    projectsPage: dataset.projects.length >= MIN_DEMO_ROWS,
    timesheetsPage: dataset.timesheets.length >= MIN_DEMO_ROWS,
  };
  const screenFailures = Object.entries(screenCoverage)
    .filter(([, passed]) => !passed)
    .map(([screen]) => `screen:${screen}`);

  await client.auth.signOut();

  return {
    key: account.key,
    email: account.email,
    userId: user.id,
    companyName: dataset.company?.company_name || null,
    currency: resolveAccountingCurrency(dataset.company),
    region: pilotageSnapshot.region,
    expectedRegion: account.expectedRegion,
    regionMatchesExpectation: pilotageSnapshot.region === account.expectedRegion,
    regionSource: pilotageSnapshot.regionSource,
    qualityStatus: pilotageSnapshot.qualityGate?.reliabilityStatus || null,
    data: {
      companies: dataset.companies.length,
      activeCompanyId: dataset.activeCompanyId,
      companyCountry: dataset.company?.country || null,
      accountingCountry: dataset.accountingSettings?.country || null,
      accounts: dataset.accounts.length,
      entries: dataset.entries.length,
      clients: dataset.clients.length,
      invoices: dataset.invoices.length,
      expenses: dataset.expenses.length,
      recurringInvoices: dataset.recurringInvoices.length,
      creditNotes: dataset.creditNotes.length,
      deliveryNotes: dataset.deliveryNotes.length,
      receivables: dataset.receivables.length,
      payables: dataset.payables.length,
      purchaseOrders: dataset.purchaseOrders.length,
      suppliers: dataset.suppliers.length,
      supplierOrders: dataset.supplierOrders.length,
      supplierInvoices: dataset.supplierInvoices.length,
      products: dataset.products.length,
      services: dataset.services.length,
      productCategories: dataset.productCategories.length,
      serviceCategories: dataset.serviceCategories.length,
      stockHistory: dataset.stockHistory.length,
      stockAlerts: dataset.stockAlerts.length,
      bankConnections: dataset.bankConnections.length,
      bankSyncHistory: dataset.bankSyncHistory.length,
      bankTransactions: dataset.bankTransactions.length,
      peppolLogs: dataset.peppolLogs.length,
      fixedAssets: dataset.fixedAssets.length,
      analyticalAxes: dataset.analyticalAxes.length,
      snapshots: dataset.snapshots.length,
      quotes: dataset.quotes.length,
      timesheets: dataset.timesheets.length,
      existingScenarios: dataset.scenarios.length,
      monthlyPoints: pilotageSnapshot.monthlyData.length,
      cashPoints: pilotageSnapshot.cashFlowData.length,
    },
    companyCoverage: dataset.companyCoverage,
    featureCoverage,
    screenCoverage,
    financials: {
      revenue: round(pilotageSnapshot.financialDiagnostic?.margins?.revenue),
      ebitda: round(pilotageSnapshot.financialDiagnostic?.margins?.ebitda),
      preTaxIncome: round(pilotageSnapshot.financialDiagnostic?.tax?.preTaxIncome),
      freeCashFlow: round(
        normalizeNumber(pilotageSnapshot.financialDiagnostic?.financing?.operatingCashFlow) -
        normalizeNumber(pilotageSnapshot.financialDiagnostic?.financing?.capex)
      ),
      taxDue: round(pilotageSnapshot.taxSynthesis?.finalTaxDue),
      valuationMode: pilotageSnapshot.valuationMode,
      valuationMid: pilotageSnapshot.valuation?.consensus?.midValue || 0,
    },
    tabs,
    passed:
      pilotageSnapshot.region === account.expectedRegion &&
      tabFailures.length === 0 &&
      featureFailures.length === 0 &&
      screenFailures.length === 0,
    failures: [
      ...(pilotageSnapshot.region === account.expectedRegion ? [] : [`region:${pilotageSnapshot.region}`]),
      ...tabFailures,
      ...featureFailures,
      ...screenFailures,
    ],
  };
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const authKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!authKey) {
    throw new Error('Missing environment variable: SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  const period = resolvePeriodBounds();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const referenceData = await loadReferenceData(serviceClient);
  const accounts = [];

  for (const account of DEMO_ACCOUNTS) {
    accounts.push(await smokeAccount(authKey, account, period, referenceData));
  }

  const passed = accounts.every((account) => account.passed);
  const summary = {
    projectUrl: supabaseUrl,
    period,
    passed,
    accounts,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
