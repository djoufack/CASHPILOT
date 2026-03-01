import { useMemo } from 'react';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useCashFlow } from '@/hooks/useCashFlow';
import { useCompany } from '@/hooks/useCompany';
import { useReferenceData } from '@/contexts/ReferenceDataContext';
import {
  buildPilotageMonthlySeries,
  computePilotageRatios,
  computeAlerts,
} from '@/utils/pilotageCalculations';
import { buildTaxSynthesis } from '@/utils/taxCalculations';
import { buildValuationSummary } from '@/utils/valuationCalculations';
import { getSectorBenchmarks, evaluateRatio } from '@/utils/sectorBenchmarks';
import {
  DEFAULT_PILOTAGE_SECTOR,
  normalizePilotageSector,
  resolvePilotageRegion,
} from '@/utils/pilotagePreferences';

const hasFiniteMetric = (source) =>
  Boolean(
    source &&
      Object.values(source).some((value) =>
        typeof value === 'number' && Number.isFinite(value)
      )
  );

const createAvailabilityItem = (key, titleKey, status, missingInputs = []) => ({
  key,
  titleKey,
  status,
  missingInputs,
});

export const usePilotageData = (startDate, endDate, sector = 'b2b_services', region = 'france') => {
  // 1. Get raw data from existing hooks
  const accountingData = useAccountingData(startDate, endDate);
  const cashFlowResult = useCashFlow({ startDate, endDate, granularity: 'month' });
  const { company, loading: companyLoading, error: companyError } = useCompany();
  const { loading: referenceLoading, error: referenceError } = useReferenceData();
  const resolvedContext = useMemo(() => resolvePilotageRegion({
    accountingCountry: accountingData.accountingSettings?.country,
    companyCountry: company?.country,
    fallback: region,
  }), [accountingData.accountingSettings?.country, company?.country, region]);
  const effectiveRegion = resolvedContext.region;
  const effectiveSector = normalizePilotageSector(sector || company?.business_sector || DEFAULT_PILOTAGE_SECTOR);

  // 2. Compute pilotage ratios
  const pilotageRatios = useMemo(() => {
    if (accountingData.loading || !accountingData.balanceSheet) return null;
    return computePilotageRatios({
      balanceSheet: accountingData.balanceSheet,
      incomeStatement: accountingData.incomeStatement,
      entries: accountingData.entries,
      accounts: accountingData.accounts,
      startDate,
      endDate,
      financialDiagnostic: accountingData.financialDiagnostic,
      previousBalanceSheet: accountingData.previousBalanceSheet,
      region: effectiveRegion,
    });
  }, [
    accountingData.balanceSheet,
    accountingData.incomeStatement,
    accountingData.entries,
    accountingData.accounts,
    accountingData.financialDiagnostic,
    accountingData.loading,
    accountingData.previousBalanceSheet,
    startDate,
    endDate,
    effectiveRegion,
  ]);

  const monthlyData = useMemo(() => {
    return buildPilotageMonthlySeries(
      accountingData.monthlyData,
      cashFlowResult.cashFlowData
    );
  }, [accountingData.monthlyData, cashFlowResult.cashFlowData]);

  // 3. Compute alerts
  const alerts = useMemo(() => {
    if (!pilotageRatios) return [];
    return computeAlerts(pilotageRatios, accountingData.financialDiagnostic);
  }, [pilotageRatios, accountingData.financialDiagnostic]);

  // 4. Get sector benchmarks
  const benchmarks = useMemo(() => {
    return getSectorBenchmarks(effectiveSector);
  }, [effectiveSector]);

  // 5. Evaluate ratios against benchmarks — returns object with same keys as ratios but with quality string
  const ratioEvaluations = useMemo(() => {
    if (!pilotageRatios || !benchmarks) return {};
    return {
      dso: evaluateRatio(pilotageRatios.activity?.dso, benchmarks.dso, true),
      dpo: evaluateRatio(pilotageRatios.activity?.dpo, benchmarks.dpo, false),
      stockRotationDays: benchmarks.stockRotationDays ? evaluateRatio(pilotageRatios.activity?.stockRotationDays, benchmarks.stockRotationDays, true) : null,
      ccc: evaluateRatio(pilotageRatios.activity?.ccc, benchmarks.ccc, true),
      bfrToRevenue: evaluateRatio(pilotageRatios.activity?.bfrToRevenue, benchmarks.bfrToRevenue, true),
      financialIndependence: evaluateRatio(pilotageRatios.structure?.financialIndependence, benchmarks.financialIndependence, false),
      gearing: evaluateRatio(pilotageRatios.structure?.gearing, benchmarks.gearing, true),
      currentRatio: evaluateRatio(pilotageRatios.structure?.currentRatio ?? accountingData.financialDiagnostic?.ratios?.liquidity?.currentRatio, benchmarks.currentRatio, false),
      roe: evaluateRatio(pilotageRatios.profitability?.roe ?? accountingData.financialDiagnostic?.ratios?.profitability?.roe, benchmarks.roe, false),
      roa: evaluateRatio(pilotageRatios.profitability?.roa, benchmarks.roa, false),
      roce: evaluateRatio(pilotageRatios.profitability?.roce ?? accountingData.financialDiagnostic?.ratios?.profitability?.roce, benchmarks.roce, false),
      operatingMargin: evaluateRatio(accountingData.financialDiagnostic?.margins?.operatingMargin, benchmarks.operatingMargin, false),
      grossMargin: evaluateRatio(accountingData.financialDiagnostic?.margins?.grossMarginPercent, benchmarks.grossMargin, false),
      netMargin: evaluateRatio(accountingData.financialDiagnostic?.ratios?.profitability?.netMargin, benchmarks.netMargin, false),
    };
  }, [pilotageRatios, benchmarks, accountingData.financialDiagnostic]);

  // 6. Tax synthesis
  const taxSynthesis = useMemo(() => {
    if (accountingData.loading) return null;
    const preTaxIncome = accountingData.financialDiagnostic?.tax?.preTaxIncome || 0;
    return buildTaxSynthesis({
      preTaxIncome,
      revenue: accountingData.revenue || 0,
      rdExpenses: 0, // Could be extracted from specific accounts later
      region: effectiveRegion,
      isSmallBusiness: company?.company_type === 'freelance',
    });
  }, [
    accountingData.financialDiagnostic?.tax?.preTaxIncome,
    accountingData.loading,
    accountingData.revenue,
    company?.company_type,
    effectiveRegion,
  ]);

  // 7. Valuation
  const valuation = useMemo(() => {
    if (accountingData.loading || referenceLoading || !accountingData.financialDiagnostic) return null;
    const ebitda = accountingData.financialDiagnostic?.margins?.ebitda || 0;
    const fcf = pilotageRatios?.cashFlow?.freeCashFlow || 0;
    return buildValuationSummary({
      ebitda,
      freeCashFlow: fcf,
      sector: effectiveSector,
      region: effectiveRegion,
      growthRate: 0.02,
    });
  }, [accountingData.financialDiagnostic, accountingData.loading, pilotageRatios, effectiveSector, effectiveRegion, referenceLoading]);

  // 8. Loading state
  const loading = accountingData.loading || cashFlowResult.loading || companyLoading || referenceLoading;
  const error = accountingData.error || cashFlowResult.error || companyError || referenceError;
  const dataQuality = useMemo(() => {
    const qualityGate = accountingData.qualityGate;
    const entriesCount = accountingData.entries?.length || 0;
    const accountsCount = accountingData.accounts?.length || 0;
    const monthlyPoints = monthlyData.length;
    const criticalAlerts = (alerts || []).filter((alert) => alert.severity === 'critical').length;
    const warningAlerts = (alerts || []).filter((alert) => alert.severity === 'warning').length;
    const preTaxIncome = accountingData.financialDiagnostic?.tax?.preTaxIncome;
    const ebitda = accountingData.financialDiagnostic?.margins?.ebitda || 0;
    const freeCashFlow = pilotageRatios?.cashFlow?.freeCashFlow || 0;
    const hasAccountingSetup = accountsCount > 0;
    const hasOperationalData = entriesCount > 0;
    const datasetStatus = !hasAccountingSetup
      ? 'setup'
      : !hasOperationalData
        ? 'empty'
        : qualityGate?.reliabilityStatus === 'blocked'
          ? 'blocked'
          : qualityGate?.reliabilityStatus === 'warning'
            ? 'warning'
        : 'ready';

    const lastEntryDate = accountingData.entries?.reduce((latest, entry) => {
      if (!entry?.transaction_date) return latest;
      return !latest || entry.transaction_date > latest ? entry.transaction_date : latest;
    }, null);

    const periodDays = (() => {
      if (!startDate || !endDate) return 0;
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      return Math.max(0, Math.round((end - start) / 86400000) + 1);
    })();

    return {
      datasetStatus,
      entriesCount,
      accountsCount,
      monthlyPoints,
      criticalAlerts,
      warningAlerts,
      blockingIssues: qualityGate?.blockingIssues?.length || 0,
      dataWarnings: qualityGate?.warnings?.length || 0,
      lastEntryDate,
      periodDays,
      preTaxReady: Number.isFinite(preTaxIncome) && qualityGate?.canRunPilotage !== false,
      valuationReady: ebitda > 0 && freeCashFlow > 0 && qualityGate?.canRunPilotage !== false,
      valuationMode: qualityGate?.canRunPilotage === false
        ? 'unavailable'
        : freeCashFlow > 0
          ? 'full'
          : ebitda > 0
            ? 'multiples-only'
            : 'unavailable',
      qualityGate,
      topIssues: qualityGate?.issues?.slice(0, 3) || [],
    };
  }, [
    accountingData.accounts,
    accountingData.entries,
    accountingData.financialDiagnostic?.margins?.ebitda,
    accountingData.financialDiagnostic?.tax?.preTaxIncome,
    accountingData.qualityGate,
    alerts,
    endDate,
    monthlyData,
    pilotageRatios?.cashFlow?.freeCashFlow,
    startDate,
  ]);

  const analysisAvailability = useMemo(() => {
    const hasAccounts = (accountingData.accounts?.length || 0) > 0;
    const hasEntries = (accountingData.entries?.length || 0) > 0;
    const hasBalanceSheet =
      hasAccounts &&
      hasEntries &&
      (
        (accountingData.balanceSheet?.assets?.length || 0) > 0 ||
        (accountingData.balanceSheet?.liabilities?.length || 0) > 0 ||
        (accountingData.balanceSheet?.equity?.length || 0) > 0 ||
        Math.abs(accountingData.balanceSheet?.totalAssets || 0) > 0 ||
        Math.abs(accountingData.balanceSheet?.totalLiabilities || 0) > 0 ||
        Math.abs(accountingData.balanceSheet?.totalEquity || 0) > 0
      );
    const hasIncomeStatement =
      hasEntries &&
      (
        (accountingData.incomeStatement?.revenueItems?.length || 0) > 0 ||
        (accountingData.incomeStatement?.expenseItems?.length || 0) > 0 ||
        Math.abs(accountingData.incomeStatement?.totalRevenue || 0) > 0 ||
        Math.abs(accountingData.incomeStatement?.totalExpenses || 0) > 0 ||
        Math.abs(accountingData.incomeStatement?.netIncome || 0) > 0
      );
    const hasTrialBalance = hasEntries && (accountingData.trialBalance?.length || 0) > 0;
    const hasMonthlySeries = hasEntries && (monthlyData?.length || 0) > 0;
    const hasCashSeries = hasEntries && (cashFlowResult.cashFlowData?.length || 0) > 0;
    const hasMargins = hasIncomeStatement && hasFiniteMetric(accountingData.financialDiagnostic?.margins);
    const hasFinancing = hasBalanceSheet && hasFiniteMetric(accountingData.financialDiagnostic?.financing);
    const hasLiquidityRatios = hasBalanceSheet && hasFiniteMetric(accountingData.financialDiagnostic?.ratios?.liquidity);
    const hasProfitabilityRatios = hasIncomeStatement && hasFiniteMetric(accountingData.financialDiagnostic?.ratios?.profitability);
    const hasStructureRatios = hasBalanceSheet && hasFiniteMetric(pilotageRatios?.structure);
    const hasActivityRatios = hasEntries && hasFiniteMetric(pilotageRatios?.activity);
    const hasAlertsInputs = hasStructureRatios || hasActivityRatios || hasProfitabilityRatios || hasCashSeries;
    const hasPreTaxIncome =
      hasIncomeStatement &&
      Number.isFinite(accountingData.financialDiagnostic?.tax?.preTaxIncome);
    const hasValuation = hasEntries && Boolean(valuation?.multiples || valuation?.dcf);
    const hasSensitivity = (valuation?.sensitivity?.length || 0) > 0;
    const hasBenchmarks = Object.keys(benchmarks || {}).length > 0;
    const hasRatioEvaluations = Object.values(ratioEvaluations || {}).some(Boolean);
    const hasCapitalStructure =
      hasFinancing &&
      ['equity', 'totalDebt', 'bfr'].some((key) =>
        Number.isFinite(accountingData.financialDiagnostic?.financing?.[key])
      );
    const hasTrendSeries = hasEntries && (monthlyData?.length || 0) > 1;

    return {
      overview: {
        kpis: createAvailabilityItem(
          'overview.kpis',
          'pilotage.dataRequirements.items.kpis',
          hasIncomeStatement || hasMargins || hasValuation ? 'ready' : 'unavailable',
          hasIncomeStatement || hasMargins || hasValuation
            ? []
            : ['chartOfAccounts', 'journalEntries', 'incomeStatement']
        ),
        performanceChart: createAvailabilityItem(
          'overview.performanceChart',
          'pilotage.dataRequirements.items.performanceChart',
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
          'pilotage.dataRequirements.items.ratioStatus',
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
          'pilotage.dataRequirements.items.alerts',
          hasAlertsInputs ? 'ready' : 'unavailable',
          hasAlertsInputs ? [] : ['journalEntries', 'balanceSheet', 'cashSeries']
        ),
      },
      accounting: {
        structure: createAvailabilityItem(
          'accounting.structure',
          'pilotage.dataRequirements.items.structureRatios',
          hasStructureRatios ? 'ready' : 'unavailable',
          hasStructureRatios ? [] : ['balanceSheet', 'incomeStatement', 'structureRatios']
        ),
        liquidity: createAvailabilityItem(
          'accounting.liquidity',
          'pilotage.dataRequirements.items.liquidityRatios',
          hasLiquidityRatios ? 'ready' : 'unavailable',
          hasLiquidityRatios ? [] : ['balanceSheet', 'incomeStatement']
        ),
        activity: createAvailabilityItem(
          'accounting.activity',
          'pilotage.dataRequirements.items.activityRatios',
          hasActivityRatios ? 'ready' : 'unavailable',
          hasActivityRatios ? [] : ['journalEntries', 'incomeStatement', 'activityRatios']
        ),
        trialBalance: createAvailabilityItem(
          'accounting.trialBalance',
          'pilotage.dataRequirements.items.trialBalance',
          hasTrialBalance ? 'ready' : 'unavailable',
          hasTrialBalance ? [] : ['chartOfAccounts', 'journalEntries', 'trialBalance']
        ),
      },
      financial: {
        margins: createAvailabilityItem(
          'financial.margins',
          'pilotage.dataRequirements.items.marginAnalysis',
          hasMargins ? 'ready' : 'unavailable',
          hasMargins ? [] : ['incomeStatement', 'journalEntries']
        ),
        financing: createAvailabilityItem(
          'financial.financing',
          'pilotage.dataRequirements.items.financingAnalysis',
          hasFinancing ? 'ready' : 'unavailable',
          hasFinancing ? [] : ['balanceSheet', 'journalEntries', 'financingData']
        ),
        profitability: createAvailabilityItem(
          'financial.profitability',
          'pilotage.dataRequirements.items.profitabilityRatios',
          hasProfitabilityRatios ? 'ready' : 'unavailable',
          hasProfitabilityRatios ? [] : ['incomeStatement', 'balanceSheet', 'profitabilityRatios']
        ),
        capitalStructure: createAvailabilityItem(
          'financial.capitalStructure',
          'pilotage.dataRequirements.items.capitalStructure',
          hasCapitalStructure ? 'ready' : 'unavailable',
          hasCapitalStructure ? [] : ['balanceSheet', 'financingData']
        ),
        profitabilityTrend: createAvailabilityItem(
          'financial.profitabilityTrend',
          'pilotage.dataRequirements.items.profitabilityTrend',
          hasTrendSeries ? 'ready' : 'unavailable',
          hasTrendSeries ? [] : ['journalEntries', 'monthlySeries']
        ),
      },
      taxValuation: {
        tax: createAvailabilityItem(
          'taxValuation.tax',
          'pilotage.dataRequirements.items.taxSynthesis',
          hasPreTaxIncome ? 'ready' : 'unavailable',
          hasPreTaxIncome ? [] : ['incomeStatement', 'taxBase']
        ),
        valuation: createAvailabilityItem(
          'taxValuation.valuation',
          'pilotage.dataRequirements.items.valuation',
          hasValuation
            ? dataQuality?.valuationMode === 'full'
              ? 'ready'
              : 'partial'
            : 'unavailable',
          hasValuation
            ? dataQuality?.valuationMode === 'full'
              ? []
              : ['valuationInputs']
            : ['incomeStatement', 'cashSeries', 'valuationInputs']
        ),
        sensitivity: createAvailabilityItem(
          'taxValuation.sensitivity',
          'pilotage.dataRequirements.items.sensitivity',
          hasSensitivity ? 'ready' : 'unavailable',
          hasSensitivity ? [] : ['valuationInputs']
        ),
        benchmark: createAvailabilityItem(
          'taxValuation.benchmark',
          'pilotage.dataRequirements.items.benchmark',
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
  }, [
    accountingData.accounts,
    accountingData.balanceSheet,
    accountingData.entries,
    accountingData.financialDiagnostic?.financing,
    accountingData.financialDiagnostic?.margins,
    accountingData.financialDiagnostic?.ratios?.liquidity,
    accountingData.financialDiagnostic?.ratios?.profitability,
    accountingData.financialDiagnostic?.tax?.preTaxIncome,
    accountingData.incomeStatement,
    accountingData.trialBalance,
    benchmarks,
    cashFlowResult.cashFlowData,
    dataQuality?.valuationMode,
    monthlyData,
    pilotageRatios?.activity,
    pilotageRatios?.structure,
    ratioEvaluations,
    valuation,
  ]);

  return {
    // Loading & error
    loading,
    error,

    // Raw accounting data (pass-through)
    revenue: accountingData.revenue || 0,
    totalExpenses: accountingData.totalExpenses || 0,
    netIncome: accountingData.netIncome || 0,
    balanceSheet: accountingData.balanceSheet,
    incomeStatement: accountingData.incomeStatement,
    trialBalance: accountingData.trialBalance,
    monthlyData,
    rawMonthlyData: accountingData.monthlyData,
    previousBalanceSheet: accountingData.previousBalanceSheet,
    entries: accountingData.entries,
    accounts: accountingData.accounts,
    financialDiagnostic: accountingData.financialDiagnostic,
    qualityGate: accountingData.qualityGate,

    // Cash flow
    cashFlow: cashFlowResult,

    // Pilotage-specific computed data
    pilotageRatios,
    alerts,
    benchmarks,
    ratioEvaluations,
    taxSynthesis,
    valuation,
    dataQuality,
    analysisAvailability,

    // Company info
    company,
    accountingSettings: accountingData.accountingSettings,
    region: effectiveRegion,
    regionSource: resolvedContext.source,
    sector: effectiveSector,

    // Refresh
    refresh: accountingData.refresh,
  };
};
