
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  calculateRevenue,
  calculateRevenueTTC,
  calculateExpenses,
  calculateNetIncome,
  calculateOutputVAT,
  calculateInputVAT,
  calculateVATPayable,
  calculateVATBreakdown,
  buildBalanceSheet,
  buildIncomeStatement,
  estimateTax,
  buildMonthlyChartData,
  DEFAULT_TAX_BRACKETS
} from '@/utils/accountingCalculations';

export const useAccountingData = (startDate, endDate) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw data
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [taxRates, setTaxRates] = useState([]);

  const fetchAll = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [invRes, expRes, supRes, accRes, mapRes, taxRes] = await Promise.all([
        supabase.from('invoices').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        (async () => { try { return await supabase.from('supplier_invoices').select('*').order('created_at', { ascending: false }); } catch { return { data: [], error: null }; } })(),
        supabase.from('accounting_chart_of_accounts').select('*').order('account_code', { ascending: true }),
        supabase.from('accounting_mappings').select('*'),
        supabase.from('accounting_tax_rates').select('*')
      ]);

      setInvoices(invRes.data || []);
      setExpenses(expRes.data || []);
      setSupplierInvoices(supRes?.data || []);
      setAccounts(accRes.data || []);
      setMappings(mapRes.data || []);
      setTaxRates(taxRes.data || []);
    } catch (err) {
      console.error('Error fetching accounting data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Computed values (memoized)
  const computed = useMemo(() => {
    if (!startDate || !endDate) return null;

    const revenue = calculateRevenue(invoices, startDate, endDate);
    const revenueTTC = calculateRevenueTTC(invoices, startDate, endDate);
    const totalExpenses = calculateExpenses(expenses, supplierInvoices, startDate, endDate);
    const netIncome = calculateNetIncome(invoices, expenses, supplierInvoices, startDate, endDate);

    const outputVAT = calculateOutputVAT(invoices, startDate, endDate);
    const inputVAT = calculateInputVAT(expenses, supplierInvoices, startDate, endDate);
    const vatPayable = calculateVATPayable(outputVAT, inputVAT);
    const vatBreakdown = calculateVATBreakdown(invoices, expenses, startDate, endDate);

    const balanceSheet = buildBalanceSheet(accounts, invoices, expenses, supplierInvoices, mappings, startDate, endDate);
    const incomeStatement = buildIncomeStatement(accounts, invoices, expenses, supplierInvoices, mappings, startDate, endDate);

    const taxEstimate = estimateTax(netIncome > 0 ? netIncome : 0);

    const monthlyData = buildMonthlyChartData(invoices, expenses, startDate, endDate);

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
      monthlyData
    };
  }, [invoices, expenses, supplierInvoices, accounts, mappings, startDate, endDate]);

  return {
    loading,
    error,
    // Raw data
    invoices,
    expenses,
    supplierInvoices,
    accounts,
    mappings,
    taxRates,
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
      monthlyData: []
    }),
    refresh: fetchAll
  };
};
