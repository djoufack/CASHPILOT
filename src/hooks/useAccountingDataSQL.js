/**
 * useAccountingDataSQL — Full SQL-based accounting data hook
 *
 * ALL calculations come from PostgreSQL RPC functions.
 * The frontend is a pure display layer — zero JS accounting logic.
 *
 * SQL functions called:
 *   f_trial_balance, f_income_statement, f_balance_sheet,
 *   f_financial_diagnostic, f_vat_summary, f_vat_breakdown,
 *   f_monthly_chart_data, f_general_ledger, f_journal_book
 *
 * Reference: Plans-Implementation/frontend-to-db-migration-08-03-26-01-42.md
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';
import { estimateTax } from '@/utils/accountingCalculations';
import { evaluateAccountingDatasetQuality } from '@/utils/accountingQualityChecks';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';

const OPTIONAL_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', 'PGRST204']);

function resolvePeriodBounds(startDate, endDate) {
  const today = formatDateInput();
  const fiscalYearStart = formatStartOfYearInput();
  return {
    startDate: startDate || fiscalYearStart,
    endDate: endDate || today,
  };
}

function isOptionalSchemaError(error) {
  if (!error) return false;
  if (OPTIONAL_SCHEMA_ERROR_CODES.has(error.code)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find');
}

export const useAccountingDataSQL = (startDate, endDate) => {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const activeCompanyId = useActiveCompanyId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data (still fetched — needed by some components for display)
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [accountingSettings, setAccountingSettings] = useState(null);

  // SQL-computed data
  const [sqlTrialBalance, setSqlTrialBalance] = useState([]);
  const [sqlCumulativeTrialBalance, setSqlCumulativeTrialBalance] = useState([]);
  const [sqlIncomeStatement, setSqlIncomeStatement] = useState(null);
  const [sqlBalanceSheet, setSqlBalanceSheet] = useState(null);
  const [sqlDiagnostic, setSqlDiagnostic] = useState(null);
  const [sqlVatSummary, setSqlVatSummary] = useState(null);
  const [sqlVatBreakdown, setSqlVatBreakdown] = useState(null);
  const [sqlMonthlyData, setSqlMonthlyData] = useState([]);
  const [sqlGeneralLedger, setSqlGeneralLedger] = useState([]);
  const [sqlJournalBook, setSqlJournalBook] = useState([]);

  const period = useMemo(() => resolvePeriodBounds(startDate, endDate), [startDate, endDate]);

  const fetchAll = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build raw data queries
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

      // RPC params shared by most functions
      const rpcParams = {
        p_user_id: user.id,
        p_company_id: activeCompanyId || null,
        p_start_date: period.startDate,
        p_end_date: period.endDate,
      };

      // Execute ALL queries in parallel: raw data + ALL SQL calculations
      const [
        invRes, expRes, supRes, accRes, mapRes, taxRes, entRes, settingsRes,
        tbRes, cumTbRes, isRes, bsRes, diagRes,
        vatSumRes, vatBkRes, monthlyRes, ledgerRes, journalRes,
      ] = await Promise.all([
        // Raw data
        invoicesQuery,
        expensesQuery,
        (async () => {
          try {
            let q = supabase.from('supplier_invoices').select('*').order('created_at', { ascending: false });
            q = applyCompanyScope(q);
            return await q;
          } catch { return { data: [], error: null }; }
        })(),
        supabase.from('accounting_chart_of_accounts').select('*').eq('user_id', user.id).order('account_code', { ascending: true }),
        supabase.from('accounting_mappings').select('*').eq('user_id', user.id),
        supabase.from('accounting_tax_rates').select('*').eq('user_id', user.id),
        entriesQuery,
        supabase.from('user_accounting_settings').select('*').eq('user_id', user.id).maybeSingle(),

        // SQL RPC calls — ALL accounting calculations
        supabase.rpc('f_trial_balance', rpcParams),
        supabase.rpc('f_trial_balance', { ...rpcParams, p_start_date: null }),
        supabase.rpc('f_income_statement', rpcParams),
        supabase.rpc('f_balance_sheet', { p_user_id: user.id, p_company_id: activeCompanyId || null, p_end_date: period.endDate }),
        supabase.rpc('f_financial_diagnostic', { ...rpcParams, p_region: 'belgium' }),
        supabase.rpc('f_vat_summary', rpcParams),
        supabase.rpc('f_vat_breakdown', rpcParams),
        supabase.rpc('f_monthly_chart_data', rpcParams),
        supabase.rpc('f_general_ledger', rpcParams),
        supabase.rpc('f_journal_book', rpcParams),
      ]);

      // Unwrap raw data
      setInvoices(invRes?.data ?? []);
      setExpenses(expRes?.data ?? []);
      setSupplierInvoices(supRes?.error && isOptionalSchemaError(supRes.error) ? [] : (supRes?.data ?? []));
      setAccounts(accRes?.data ?? []);
      setMappings(mapRes?.data ?? []);
      setTaxRates(taxRes?.data ?? []);
      setEntries(entRes?.data ?? []);
      setAccountingSettings(settingsRes?.data ?? null);

      // Unwrap ALL SQL results
      setSqlTrialBalance(tbRes?.data ?? []);
      setSqlCumulativeTrialBalance(cumTbRes?.data ?? []);
      setSqlIncomeStatement(isRes?.data ?? null);
      setSqlBalanceSheet(bsRes?.data ?? null);
      setSqlDiagnostic(diagRes?.data ?? null);
      setSqlVatSummary(vatSumRes?.data ?? null);
      setSqlVatBreakdown(vatBkRes?.data ?? null);
      setSqlMonthlyData(monthlyRes?.data ?? []);
      setSqlGeneralLedger(ledgerRes?.data ?? []);
      setSqlJournalBook(journalRes?.data ?? []);

    } catch (err) {
      console.error('Error fetching accounting data (SQL mode):', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyScope, user, activeCompanyId, period.startDate, period.endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user || !supabase) return;
    let refreshTimeout = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => { fetchAll(); }, 500);
    };

    const entriesSub = supabase
      .channel('sql_accounting_entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounting_entries', filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();

    const invoicesSub = supabase
      .channel('sql_invoices_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();

    const expensesSub = supabase
      .channel('sql_expenses_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();

    const paymentsSub = supabase
      .channel('sql_payments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      entriesSub.unsubscribe();
      invoicesSub.unsubscribe();
      expensesSub.unsubscribe();
      paymentsSub.unsubscribe();
    };
  }, [user, fetchAll]);

  const hasAutoEntries = useMemo(() => entries.some(e => e.is_auto === true), [entries]);

  // ALL computed values come from SQL — zero JS calculations
  const computed = useMemo(() => {
    if (!period.startDate || !period.endDate) return null;
    if (!sqlIncomeStatement || !sqlBalanceSheet) return null;

    const revenue = sqlIncomeStatement.totalRevenue ?? 0;
    const totalExpenses = sqlIncomeStatement.totalExpenses ?? 0;
    const netIncome = sqlIncomeStatement.netIncome ?? 0;

    // VAT from SQL
    const outputVAT = sqlVatSummary?.outputVAT ?? 0;
    const inputVAT = sqlVatSummary?.inputVAT ?? 0;
    const vatPayable = sqlVatSummary?.vatPayable ?? 0;
    const vatBreakdown = sqlVatBreakdown ?? { output: [], input: [] };

    // Tax estimate (simple bracket calc, kept in JS — it's a pure function with no DB access)
    const taxEstimate = estimateTax(netIncome > 0 ? netIncome : 0);

    // Quality gate (evaluates data completeness — pure function, no DB access)
    const qualityGate = evaluateAccountingDatasetQuality({ accounts, entries });

    return {
      revenue,
      revenueTTC: revenue,
      totalExpenses,
      netIncome,
      outputVAT,
      inputVAT,
      vatPayable,
      vatBreakdown,
      balanceSheet: sqlBalanceSheet,
      incomeStatement: sqlIncomeStatement,
      taxEstimate,
      monthlyData: sqlMonthlyData,
      previousBalanceSheet: null,
      trialBalance: sqlTrialBalance,
      cumulativeTrialBalance: sqlCumulativeTrialBalance,
      generalLedger: sqlGeneralLedger,
      journalBook: sqlJournalBook,
      financialDiagnostic: sqlDiagnostic,
      financialDiagnosticComparatives: {
        monthOverMonth: null,
        quarterOverQuarter: null,
        yearOverYear: null,
      },
      consistencyWarnings: [],
      qualityGate,
    };
  }, [accounts, entries, sqlIncomeStatement, sqlBalanceSheet, sqlTrialBalance, sqlCumulativeTrialBalance, sqlDiagnostic, sqlVatSummary, sqlVatBreakdown, sqlMonthlyData, sqlGeneralLedger, sqlJournalBook, period.endDate, period.startDate]);

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
    // Computed values — 100% from SQL
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
    refresh: fetchAll,
  };
};
