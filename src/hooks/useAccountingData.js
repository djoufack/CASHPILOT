import { useAccountingDataSQL } from '@/hooks/useAccountingDataSQL';

const USE_SQL = import.meta.env.VITE_USE_SQL_CALCULATIONS === 'true';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  filterByPeriod,
  estimateTax,
  // Single source of truth: entry-based functions only
  buildTrialBalance,
  buildBalanceSheetFromEntries,
  buildIncomeStatementFromEntries,
  buildGeneralLedger,
  buildJournalBook,
  calculateRevenueFromEntries,
  calculateExpensesFromEntries,
  calculateNetIncomeFromEntries,
  calculateOutputVATFromEntries,
  calculateInputVATFromEntries,
  calculateVATBreakdownFromEntries,
  buildMonthlyChartDataFromEntries,
  validateAccountingConsistency,
} from '@/utils/accountingCalculations';
import { buildFinancialDiagnostic, calculateBFR } from '@/utils/financialAnalysisCalculations';
import { evaluateAccountingDatasetQuality } from '@/utils/accountingQualityChecks';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const OPTIONAL_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', 'PGRST204']);

function resolvePeriodBounds(startDate, endDate) {
  const today = formatDateInput();
  const fiscalYearStart = formatStartOfYearInput();

  return {
    startDate: startDate || fiscalYearStart,
    endDate: endDate || today,
  };
}

function shiftDateInput(dateInput, { years = 0, months = 0, days = 0 } = {}) {
  if (!dateInput) return null;
  const shifted = new Date(`${dateInput}T00:00:00`);
  if (Number.isFinite(years) && years !== 0) shifted.setFullYear(shifted.getFullYear() + years);
  if (Number.isFinite(months) && months !== 0) shifted.setMonth(shifted.getMonth() + months);
  if (Number.isFinite(days) && days !== 0) shifted.setDate(shifted.getDate() + days);
  return formatDateInput(shifted);
}

function isOptionalSchemaError(error) {
  if (!error) return false;
  if (OPTIONAL_SCHEMA_ERROR_CODES.has(error.code)) return true;

  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('accounting_currency')
  );
}

function unwrapRequiredResponse(response, resourceName) {
  if (response?.error) {
    const error = new Error(`${resourceName}: ${response.error.message}`);
    error.code = response.error.code;
    throw error;
  }

  return response?.data ?? [];
}

function unwrapOptionalResponse(response, resourceName, fallbackValue) {
  if (response?.error) {
    if (isOptionalSchemaError(response.error)) {
      console.warn(`Optional Supabase resource unavailable for ${resourceName}:`, response.error.message);
      return fallbackValue;
    }

    const error = new Error(`${resourceName}: ${response.error.message}`);
    error.code = response.error.code;
    throw error;
  }

  return response?.data ?? fallbackValue;
}

export const useAccountingData = (startDate, endDate) => {
  // SQL-based hook is always called (React hook rules: no conditional hooks)
  const sqlResult = useAccountingDataSQL(startDate, endDate);

  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [accountingSettings, setAccountingSettings] = useState(null);
  const period = useMemo(() => resolvePeriodBounds(startDate, endDate), [startDate, endDate]);

  const fetchAll = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let invoicesQuery = supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      let entriesQuery = supabase
        .from('accounting_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      invoicesQuery = applyCompanyScope(invoicesQuery);
      expensesQuery = applyCompanyScope(expensesQuery);
      entriesQuery = applyCompanyScope(entriesQuery, { includeUnassigned: false });

      const [invRes, expRes, supRes, accRes, mapRes, taxRes, entRes, settingsRes] = await Promise.all([
        invoicesQuery,
        expensesQuery,
        (async () => {
          try {
            let supplierInvoicesQuery = supabase
              .from('supplier_invoices')
              .select('*')
              .order('created_at', { ascending: false });

            supplierInvoicesQuery = applyCompanyScope(supplierInvoicesQuery);
            return await supplierInvoicesQuery;
          } catch {
            return { data: [], error: null };
          }
        })(),
        supabase
          .from('accounting_chart_of_accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('account_code', { ascending: true }),
        supabase.from('accounting_mappings').select('*').eq('user_id', user.id),
        supabase.from('accounting_tax_rates').select('*').eq('user_id', user.id),
        entriesQuery,
        supabase
          .from('user_accounting_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      setInvoices(unwrapRequiredResponse(invRes, 'invoices'));
      setExpenses(unwrapRequiredResponse(expRes, 'expenses'));
      setSupplierInvoices(unwrapOptionalResponse(supRes, 'supplier_invoices', []));
      setAccounts(unwrapRequiredResponse(accRes, 'accounting_chart_of_accounts'));
      setMappings(unwrapRequiredResponse(mapRes, 'accounting_mappings'));
      setTaxRates(unwrapRequiredResponse(taxRes, 'accounting_tax_rates'));
      setEntries(unwrapRequiredResponse(entRes, 'accounting_entries'));
      setAccountingSettings(unwrapOptionalResponse(settingsRes, 'user_accounting_settings', null));
    } catch (err) {
      console.error('Error fetching accounting data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time subscriptions for automatic updates with debouncing
  useEffect(() => {
    if (!user || !supabase) return;

    let refreshTimeout = null;

    // Debounced refresh to avoid multiple rapid updates
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        fetchAll();
      }, 500); // Wait 500ms after last change before refreshing
    };

    // Subscribe to accounting entries changes (auto-generated by triggers)
    const entriesSubscription = supabase
      .channel('accounting_entries_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'accounting_entries', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Accounting entry changed:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Subscribe to invoices changes
    const invoicesSubscription = supabase
      .channel('invoices_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Invoice changed:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Subscribe to expenses changes
    const expensesSubscription = supabase
      .channel('expenses_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Expense changed:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Subscribe to payments changes
    const paymentsSubscription = supabase
      .channel('payments_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Payment changed:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe();

    // Cleanup subscriptions and timeout on unmount
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      entriesSubscription.unsubscribe();
      invoicesSubscription.unsubscribe();
      expensesSubscription.unsubscribe();
      paymentsSubscription.unsubscribe();
    };
  }, [user, fetchAll]);

  // Determine if we have auto-generated entries
  const hasAutoEntries = useMemo(() => {
    return entries.some(e => e.is_auto === true);
  }, [entries]);

  // Computed values — SINGLE SOURCE OF TRUTH: all calculations from accounting_entries
  const computed = useMemo(() => {
    if (!period.startDate || !period.endDate) return null;

    const buildDiagnosticForRange = (rangeStartDate, rangeEndDate) => {
      if (!rangeStartDate || !rangeEndDate) return null;

      const rangeBalanceSheet = buildBalanceSheetFromEntries(accounts, entries, rangeStartDate, rangeEndDate);
      const rangeIncomeStatement = buildIncomeStatementFromEntries(accounts, entries, rangeStartDate, rangeEndDate);
      const previousEndDate = shiftDateInput(rangeStartDate, { days: -1 });
      const previousBalanceSheet = buildBalanceSheetFromEntries(
        accounts,
        entries,
        null,
        previousEndDate
      );
      const previousRangeData = {
        balanceSheet: previousBalanceSheet,
        financing: {
          bfr: calculateBFR(previousBalanceSheet),
        },
      };

      return buildFinancialDiagnostic(
        entries,
        accounts,
        rangeBalanceSheet,
        rangeIncomeStatement,
        rangeStartDate,
        rangeEndDate,
        previousRangeData
      );
    };

    // Balance sheet & income statement — always entry-based
    const balanceSheet = buildBalanceSheetFromEntries(accounts, entries, period.startDate, period.endDate);
    const incomeStatement = buildIncomeStatementFromEntries(accounts, entries, period.startDate, period.endDate);

    // All KPIs from entries/statements (returns 0 when no entries — clean state, no estimations)
    const revenue = calculateRevenueFromEntries(entries, accounts, period.startDate, period.endDate);
    const revenueTTC = revenue;
    const totalExpenses = incomeStatement.totalExpenses ?? calculateExpensesFromEntries(entries, accounts, period.startDate, period.endDate);
    const netIncome = incomeStatement.netIncome ?? calculateNetIncomeFromEntries(entries, accounts, period.startDate, period.endDate);

    const outputVAT = calculateOutputVATFromEntries(entries, accounts, period.startDate, period.endDate);
    const inputVAT = calculateInputVATFromEntries(entries, accounts, period.startDate, period.endDate);
    const vatPayable = outputVAT - inputVAT;
    const vatBreakdown = calculateVATBreakdownFromEntries(entries, accounts, period.startDate, period.endDate);

    const taxEstimate = estimateTax(netIncome > 0 ? netIncome : 0);
    const monthlyData = buildMonthlyChartDataFromEntries(entries, accounts, period.startDate, period.endDate);

    // Trial balance, ledger, journal — ALL filtered by period
    const filteredEntries = filterByPeriod(entries, period.startDate, period.endDate, 'transaction_date');
    const trialBalance = buildTrialBalance(filteredEntries, accounts);

    // Cumulative trial balance (all entries up to endDate) — needed for balance sheet notes (Annexes)
    // Balance sheet accounts (classes 1-5) must show cumulative balances, not just the period
    const cumulativeEntries = period.endDate
      ? entries.filter(e => new Date(e.transaction_date) <= new Date(new Date(period.endDate).setHours(23, 59, 59, 999)))
      : entries;
    const cumulativeTrialBalance = buildTrialBalance(cumulativeEntries, accounts);
    const generalLedger = buildGeneralLedger(entries, accounts, period.startDate, period.endDate);
    const journalBook = buildJournalBook(entries, period.startDate, period.endDate);

    const previousPeriodData = (() => {
      if (!period.startDate) return null;

      const previousEndDate = new Date(`${period.startDate}T00:00:00`);
      previousEndDate.setDate(previousEndDate.getDate() - 1);

      const previousBalanceSheet = buildBalanceSheetFromEntries(
        accounts,
        entries,
        null,
        formatDateInput(previousEndDate)
      );

      return {
        balanceSheet: previousBalanceSheet,
        financing: {
          bfr: calculateBFR(previousBalanceSheet),
        },
      };
    })();

    // Financial diagnostic
    const financialDiagnostic = buildFinancialDiagnostic(
      entries,
      accounts,
      balanceSheet,
      incomeStatement,
      period.startDate,
      period.endDate,
      previousPeriodData
    );

    const financialDiagnosticComparatives = {
      monthOverMonth: buildDiagnosticForRange(
        shiftDateInput(period.startDate, { months: -1 }),
        shiftDateInput(period.endDate, { months: -1 })
      ),
      quarterOverQuarter: buildDiagnosticForRange(
        shiftDateInput(period.startDate, { months: -3 }),
        shiftDateInput(period.endDate, { months: -3 })
      ),
      yearOverYear: buildDiagnosticForRange(
        shiftDateInput(period.startDate, { years: -1 }),
        shiftDateInput(period.endDate, { years: -1 })
      ),
    };

    // Consistency validation
    const consistencyWarnings = validateAccountingConsistency(
      { revenue, totalExpenses, netIncome },
      incomeStatement
    );
    if (consistencyWarnings.length > 0) {
      console.warn('Accounting consistency warnings:', consistencyWarnings);
    }

    const qualityGate = evaluateAccountingDatasetQuality({
      accounts,
      entries,
    });

    return {
      revenue,
      revenueTTC,
      totalExpenses,
      netIncome,
      outputVAT,
      inputVAT,
      vatPayable,
      vatBreakdown,
      balanceSheet,
      incomeStatement,
      taxEstimate,
      monthlyData,
      previousBalanceSheet: previousPeriodData?.balanceSheet || null,
      trialBalance,
      cumulativeTrialBalance,
      generalLedger,
      journalBook,
      financialDiagnostic,
      financialDiagnosticComparatives,
      consistencyWarnings,
      qualityGate,
    };
  }, [accounts, entries, period.endDate, period.startDate]);

  // Feature flag: when SQL mode is ON, return SQL results (all hooks above still ran — React rules)
  if (USE_SQL) {
    return sqlResult;
  }

  return {
    loading,
    error,
    period,
    accountingSettings,
    // Raw data
    invoices,
    expenses,
    supplierInvoices,
    accounts,
    mappings,
    taxRates,
    entries,
    hasAutoEntries,
    // Computed values
    ...(computed || {
      revenue: 0,
      revenueTTC: 0,
      totalExpenses: 0,
      netIncome: 0,
      outputVAT: 0,
      inputVAT: 0,
      vatPayable: 0,
      vatBreakdown: { output: [], input: [] },
      balanceSheet: { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, balanced: true },
      incomeStatement: { revenueItems: [], expenseItems: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0 },
      taxEstimate: { totalTax: 0, effectiveRate: 0, details: [], quarterlyPayment: 0 },
      monthlyData: [],
      previousBalanceSheet: null,
      trialBalance: [],
      cumulativeTrialBalance: [],
      generalLedger: [],
      journalBook: [],
      financialDiagnostic: null,
      financialDiagnosticComparatives: {
        monthOverMonth: null,
        quarterOverQuarter: null,
        yearOverYear: null,
      },
      consistencyWarnings: [],
      qualityGate: null,
    }),
    refresh: fetchAll
  };
};
