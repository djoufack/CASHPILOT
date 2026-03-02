import { createClient } from '@supabase/supabase-js';
import {
  buildBalanceSheetFromEntries,
  buildIncomeStatementFromEntries,
  calculateExpensesFromEntries,
} from '../src/utils/accountingCalculations.js';
import {
  buildFinancialDiagnostic,
  calculateBFR,
} from '../src/utils/financialAnalysisCalculations.js';
import { resolveAccountingCurrency } from '../src/utils/accountingCurrency.js';
import { formatDateInput, formatStartOfYearInput } from '../src/utils/dateFormatting.js';
import { extractFinancialPosition } from '../src/utils/financialMetrics.js';
import { resolvePilotageRegion } from '../src/utils/pilotagePreferences.js';
import { FinancialSimulationEngine } from '../src/utils/scenarioSimulationEngine.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function resolvePeriodBounds() {
  return {
    startDate: formatStartOfYearInput(),
    endDate: formatDateInput(),
  };
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

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
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

async function pickPopulatedUserId(supabase) {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(5000);

  if (error) {
    throw error;
  }

  const counts = new Map();
  for (const row of data || []) {
    const userId = row.user_id;
    counts.set(userId, (counts.get(userId) || 0) + 1);
  }

  const [userId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!userId) {
    throw new Error('No populated accounting user found in accounting_entries.');
  }

  return userId;
}

async function fetchDataset(supabase, userId) {
  const [companyRes, settingsRes, accountsRes, entriesRes] = await Promise.all([
    supabase.from('company').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_accounting_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('accounting_chart_of_accounts').select('*').eq('user_id', userId).order('account_code', { ascending: true }),
    supabase.from('accounting_entries').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
  ]);

  for (const response of [companyRes, settingsRes, accountsRes, entriesRes]) {
    if (response.error) {
      throw response.error;
    }
  }

  return {
    company: companyRes.data,
    settings: settingsRes.data,
    accounts: accountsRes.data || [],
    entries: entriesRes.data || [],
  };
}

async function createScenarioArtifacts(supabase, userId, baseDate, endDate) {
  const scenarioName = `__codex_remote_scenario_test__${Date.now()}`;
  const { data: scenario, error: scenarioError } = await supabase
    .from('financial_scenarios')
    .insert([{
      user_id: userId,
      name: scenarioName,
      description: 'Temporary remote scenario test created by Codex',
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
      description: 'Assumption injected for remote end-to-end test',
      category: 'revenue',
      assumption_type: 'growth_rate',
      parameters: { rate: 5 },
      start_date: baseDate,
      end_date: endDate,
    },
    {
      scenario_id: scenario.id,
      name: 'Reduction couts fixes 2%',
      description: 'Assumption injected for remote end-to-end test',
      category: 'expense_reduction',
      assumption_type: 'percentage_change',
      parameters: { rate: 2 },
      start_date: baseDate,
      end_date: endDate,
    },
    {
      scenario_id: scenario.id,
      name: 'Charges additionnelles recurrentes',
      description: 'Assumption injected for remote end-to-end test',
      category: 'social_charges',
      assumption_type: 'recurring',
      parameters: { amount: 10000 },
      start_date: baseDate,
      end_date: endDate,
    },
  ];

  const { data: insertedAssumptions, error: assumptionsError } = await supabase
    .from('scenario_assumptions')
    .insert(assumptions)
    .select('*');

  if (assumptionsError) {
    await supabase.from('financial_scenarios').delete().eq('id', scenario.id);
    throw assumptionsError;
  }

  return {
    scenario,
    assumptions: insertedAssumptions || [],
  };
}

async function cleanupScenarioArtifacts(supabase, scenarioId) {
  if (!scenarioId) {
    return;
  }

  await supabase.from('financial_scenarios').delete().eq('id', scenarioId);
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestedUserId = process.env.TEST_USER_ID || null;
  const cleanup = process.env.CLEANUP !== 'false';
  const userId = requestedUserId || await pickPopulatedUserId(supabase);
  const { company, settings, accounts, entries } = await fetchDataset(supabase, userId);

  if (!accounts.length) {
    throw new Error(`No chart of accounts found for user ${userId}.`);
  }

  if (!entries.length) {
    throw new Error(`No accounting entries found for user ${userId}.`);
  }

  const period = resolvePeriodBounds();
  const region = resolvePilotageRegion({
    accountingCountry: settings?.country,
    companyCountry: company?.country,
  }).region;
  const balanceSheet = buildBalanceSheetFromEntries(accounts, entries, period.startDate, period.endDate);
  const incomeStatement = buildIncomeStatementFromEntries(accounts, entries, period.startDate, period.endDate);

  const previousEndDate = new Date(`${period.startDate}T00:00:00`);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousBalanceSheet = buildBalanceSheetFromEntries(
    accounts,
    entries,
    null,
    formatDateInput(previousEndDate)
  );

  const financialDiagnostic = buildFinancialDiagnostic(
    entries,
    accounts,
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

  if (!financialDiagnostic || financialDiagnostic.valid === false) {
    throw new Error(`Financial diagnostic is invalid for user ${userId}.`);
  }

  const annualizationFactor = getAnnualizationFactor(period.startDate, period.endDate);
  const annualRevenue = (financialDiagnostic.margins?.revenue || 0) * annualizationFactor;
  const fallbackAnnualExpenses = calculateExpensesFromEntries(
    entries,
    accounts,
    period.startDate,
    period.endDate
  ) * annualizationFactor;
  const annualExpenses = Math.max(
    0,
    financialDiagnostic.margins
      ? ((financialDiagnostic.margins.revenue || 0) - (financialDiagnostic.margins.ebitda || 0)) *
          annualizationFactor
      : fallbackAnnualExpenses
  );
  const financialPosition = extractFinancialPosition(balanceSheet, region);
  const currentFinancialState = {
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
    bfr: financialDiagnostic.financing?.bfr || 0,
  };

  const { baseDate, endDate } = buildScenarioWindow();
  let scenario = null;
  let assumptions = [];

  try {
    const artifacts = await createScenarioArtifacts(supabase, userId, baseDate, endDate);
    scenario = artifacts.scenario;
    assumptions = artifacts.assumptions;

    const engine = new FinancialSimulationEngine();
    const results = await engine.simulateScenario(
      scenario,
      assumptions,
      currentFinancialState
    );

    const { error: deleteResultsError } = await supabase
      .from('scenario_results')
      .delete()
      .eq('scenario_id', scenario.id);

    if (deleteResultsError) {
      throw deleteResultsError;
    }

    const resultsToInsert = results.map((result) => ({
      scenario_id: scenario.id,
      calculation_date: result.date,
      period_label: result.period_label,
      metrics: buildResultMetrics(result),
    }));

    const { error: insertResultsError } = await supabase
      .from('scenario_results')
      .insert(resultsToInsert);

    if (insertResultsError) {
      throw insertResultsError;
    }

    const { error: updateScenarioError } = await supabase
      .from('financial_scenarios')
      .update({ status: 'completed' })
      .eq('id', scenario.id);

    if (updateScenarioError) {
      throw updateScenarioError;
    }

    const { data: persistedResults, error: persistedResultsError } = await supabase
      .from('scenario_results')
      .select('id, calculation_date, period_label, metrics')
      .eq('scenario_id', scenario.id)
      .order('calculation_date', { ascending: true });

    if (persistedResultsError) {
      throw persistedResultsError;
    }

    const persisted = persistedResults || [];
    const summary = {
      userId,
      companyName: company?.company_name || null,
      companyCurrency: resolveAccountingCurrency(company),
      region,
      period,
      accountsCount: accounts.length,
      entriesCount: entries.length,
      scenarioId: scenario.id,
      assumptionsCount: assumptions.length,
      resultsCount: persisted.length,
      firstPeriod: persisted[0]?.metrics || null,
      lastPeriod: persisted[persisted.length - 1]?.metrics || null,
      cleanedUp: cleanup,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (cleanup && scenario?.id) {
      await cleanupScenarioArtifacts(supabase, scenario.id);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
