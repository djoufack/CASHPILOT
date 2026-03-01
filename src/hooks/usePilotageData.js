import { useMemo } from 'react';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useCashFlow } from '@/hooks/useCashFlow';
import { useCompany } from '@/hooks/useCompany';
import {
  buildPilotageMonthlySeries,
  computePilotageRatios,
  computeAlerts,
} from '@/utils/pilotageCalculations';
import { buildTaxSynthesis } from '@/utils/taxCalculations';
import { buildValuationSummary } from '@/utils/valuationCalculations';
import { getSectorBenchmarks, evaluateRatio } from '@/utils/sectorBenchmarks';

export const usePilotageData = (startDate, endDate, sector = 'b2b_services', region = 'france') => {
  // 1. Get raw data from existing hooks
  const accountingData = useAccountingData(startDate, endDate);
  const cashFlowResult = useCashFlow({ startDate, endDate, granularity: 'month' });
  const { company } = useCompany();

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
      region,
    });
  }, [
    accountingData.balanceSheet,
    accountingData.incomeStatement,
    accountingData.entries,
    accountingData.accounts,
    accountingData.financialDiagnostic,
    accountingData.loading,
    startDate,
    endDate,
    region,
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
    return getSectorBenchmarks(sector);
  }, [sector]);

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
      currentRatio: evaluateRatio(pilotageRatios.structure?.currentRatio || accountingData.financialDiagnostic?.ratios?.liquidity?.currentRatio, benchmarks.currentRatio, false),
      roe: evaluateRatio(pilotageRatios.profitability?.roe || accountingData.financialDiagnostic?.ratios?.profitability?.roe, benchmarks.roe, false),
      roa: evaluateRatio(pilotageRatios.profitability?.roa, benchmarks.roa, false),
      roce: evaluateRatio(pilotageRatios.profitability?.roce || accountingData.financialDiagnostic?.ratios?.profitability?.roce, benchmarks.roce, false),
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
      region,
      isSmallBusiness: true, // Default PME
    });
  }, [accountingData.financialDiagnostic?.tax?.preTaxIncome, accountingData.revenue, accountingData.loading, region]);

  // 7. Valuation
  const valuation = useMemo(() => {
    if (accountingData.loading || !accountingData.financialDiagnostic) return null;
    const ebitda = accountingData.financialDiagnostic?.margins?.ebitda || 0;
    const fcf = pilotageRatios?.cashFlow?.freeCashFlow || 0;
    return buildValuationSummary({
      ebitda,
      freeCashFlow: fcf,
      sector,
      region,
      growthRate: 0.02,
    });
  }, [accountingData.financialDiagnostic, accountingData.loading, pilotageRatios, sector, region]);

  // 8. Loading state
  const loading = accountingData.loading || cashFlowResult.loading;
  const error = accountingData.error || cashFlowResult.error;
  const dataQuality = useMemo(() => {
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
      lastEntryDate,
      periodDays,
      preTaxReady: Number.isFinite(preTaxIncome),
      valuationReady: ebitda > 0 && freeCashFlow > 0,
      valuationMode: freeCashFlow > 0 ? 'full' : ebitda > 0 ? 'multiples-only' : 'unavailable',
    };
  }, [
    accountingData.accounts,
    accountingData.entries,
    accountingData.financialDiagnostic?.margins?.ebitda,
    accountingData.financialDiagnostic?.tax?.preTaxIncome,
    alerts,
    endDate,
    monthlyData,
    pilotageRatios?.cashFlow?.freeCashFlow,
    startDate,
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
    entries: accountingData.entries,
    accounts: accountingData.accounts,
    financialDiagnostic: accountingData.financialDiagnostic,

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

    // Company info
    company,

    // Refresh
    refresh: accountingData.refresh,
  };
};
