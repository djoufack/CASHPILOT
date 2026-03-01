import { describe, expect, it } from 'vitest';
import { buildFinancialDiagnostic } from '@/utils/financialAnalysisCalculations';
import {
  calculateCapexFromEntries,
  calculatePreTaxIncome,
  extractFinancialPosition,
} from '@/utils/financialMetrics';
import { buildPilotageMonthlySeries } from '@/utils/pilotageCalculations';

describe('financialMetrics', () => {
  it('extracts cross-zone balance sheet metrics without relying on equity class 10 only', () => {
    const balanceSheet = {
      assets: [
        { account_code: '211', account_name: 'Machines', account_type: 'asset', balance: 4000 },
        { account_code: '370', account_name: 'Stock marchandises', account_type: 'asset', balance: 1000 },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', balance: 1500 },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', balance: 800 },
      ],
      liabilities: [
        { account_code: '440', account_name: 'Supplier invoices', account_type: 'liability', balance: 900 },
        { account_code: '451', account_name: 'VAT payable', account_type: 'liability', balance: 250 },
        { account_code: '164', account_name: 'Bank loan', account_type: 'liability', balance: 3000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 5000 },
        { account_code: '131', account_name: 'Report a nouveau', account_type: 'equity', balance: 1200 },
      ],
      totalAssets: 7300,
    };

    const metrics = extractFinancialPosition(balanceSheet);

    expect(metrics.equity).toBe(6200);
    expect(metrics.fixedAssets).toBe(4000);
    expect(metrics.inventory).toBe(1000);
    expect(metrics.cash).toBe(800);
    expect(metrics.receivables).toBe(1500);
    expect(metrics.tradePayables).toBe(900);
    expect(metrics.taxLiabilities).toBe(250);
    expect(metrics.currentAssets).toBe(3300);
    expect(metrics.currentLiabilities).toBe(1150);
    expect(metrics.operatingCurrentAssets).toBe(2500);
    expect(metrics.financialDebt).toBe(3000);
    expect(metrics.permanentCapital).toBe(9200);
  });

  it('derives capex and pre-tax income from entries', () => {
    const accounts = [
      { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset' },
      { account_code: '695', account_name: 'Impot sur les benefices', account_type: 'expense' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
    ];
    const entries = [
      { account_code: '218', debit: '1200', credit: '0', transaction_date: '2026-01-05' },
      { account_code: '218', debit: '0', credit: '200', transaction_date: '2026-01-20' },
      { account_code: '695', debit: '500', credit: '0', transaction_date: '2026-01-31' },
    ];

    expect(calculateCapexFromEntries(entries, accounts, '2026-01-01', '2026-01-31')).toBe(1000);
    expect(calculatePreTaxIncome(2500, entries, accounts, '2026-01-01', '2026-01-31')).toBe(3000);
  });
});

describe('buildFinancialDiagnostic', () => {
  it('propagates generic equity, capex and pre-tax income into the diagnostic', () => {
    const accounts = [
      { account_code: '101', account_name: 'Capital', account_type: 'equity' },
      { account_code: '131', account_name: 'Report a nouveau', account_type: 'equity' },
      { account_code: '164', account_name: 'Bank loan', account_type: 'liability' },
      { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset' },
      { account_code: '370', account_name: 'Stock marchandises', account_type: 'asset' },
      { account_code: '411', account_name: 'Clients', account_type: 'asset' },
      { account_code: '440', account_name: 'Supplier invoices', account_type: 'liability' },
      { account_code: '451', account_name: 'VAT payable', account_type: 'liability' },
      { account_code: '512', account_name: 'Banque', account_type: 'asset' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
      { account_code: '601', account_name: 'Achats', account_type: 'expense' },
      { account_code: '681', account_name: 'Dotations', account_type: 'expense' },
      { account_code: '695', account_name: 'Impot sur les benefices', account_type: 'expense' },
    ];

    const entries = [
      { account_code: '701', debit: '0', credit: '10000', transaction_date: '2026-01-31' },
      { account_code: '601', debit: '6500', credit: '0', transaction_date: '2026-01-31' },
      { account_code: '681', debit: '500', credit: '0', transaction_date: '2026-01-31' },
      { account_code: '695', debit: '500', credit: '0', transaction_date: '2026-01-31' },
      { account_code: '218', debit: '1000', credit: '0', transaction_date: '2026-01-15' },
    ];

    const balanceSheet = {
      assets: [
        { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset', balance: 4000 },
        { account_code: '370', account_name: 'Stock marchandises', account_type: 'asset', balance: 1000 },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', balance: 1500 },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', balance: 800 },
      ],
      liabilities: [
        { account_code: '440', account_name: 'Supplier invoices', account_type: 'liability', balance: 900 },
        { account_code: '451', account_name: 'VAT payable', account_type: 'liability', balance: 250 },
        { account_code: '164', account_name: 'Bank loan', account_type: 'liability', balance: 3000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 5000 },
        { account_code: '131', account_name: 'Report a nouveau', account_type: 'equity', balance: 1200 },
      ],
      totalAssets: 7300,
      balanced: true,
    };

    const incomeStatement = {
      totalRevenue: 10000,
      totalExpenses: 7500,
      netIncome: 2500,
    };

    const diagnostic = buildFinancialDiagnostic(
      entries,
      accounts,
      balanceSheet,
      incomeStatement,
      '2026-01-01',
      '2026-01-31',
      { financing: { bfr: 1000 } }
    );

    expect(diagnostic.financing.equity).toBe(6200);
    expect(diagnostic.financing.totalDebt).toBe(3000);
    expect(diagnostic.financing.capex).toBe(1000);
    expect(diagnostic.tax.preTaxIncome).toBe(3000);
  });
});

describe('buildPilotageMonthlySeries', () => {
  it('normalizes monthly series for charts and keeps cumulative cash flow based on cash net', () => {
    const series = buildPilotageMonthlySeries(
      [
        { key: '2026-01', name: 'janv.', revenue: 1000, expense: 600 },
        { key: '2026-02', name: 'fevr.', revenue: 2000, expense: 1500 },
      ],
      [
        { key: '2026-01', label: 'Jan', income: 900, expenses: 650, net: 250 },
        { key: '2026-02', label: 'Feb', income: 1800, expenses: 1400, net: 400 },
      ]
    );

    expect(series).toEqual([
      {
        key: '2026-01',
        month: 'Jan',
        revenue: 1000,
        expense: 600,
        net: 400,
        cashIn: 900,
        cashOut: 650,
        cashNet: 250,
        cumulativeCashFlow: 250,
      },
      {
        key: '2026-02',
        month: 'Feb',
        revenue: 2000,
        expense: 1500,
        net: 500,
        cashIn: 1800,
        cashOut: 1400,
        cashNet: 400,
        cumulativeCashFlow: 650,
      },
    ]);
  });
});
