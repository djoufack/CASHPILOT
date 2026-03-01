import { describe, expect, it } from 'vitest';
import { buildFinancialDiagnostic } from '@/utils/financialAnalysisCalculations';
import {
  calculateCapexFromEntries,
  calculatePreTaxIncome,
  extractFinancialPosition,
} from '@/utils/financialMetrics';
import {
  buildPilotageMonthlySeries,
  computePilotageRatios,
} from '@/utils/pilotageCalculations';

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

  it('recognizes belgian receivables, suppliers, cash and debt accounts', () => {
    const balanceSheet = {
      assets: [
        { account_code: '240', account_name: 'Installations', account_type: 'asset', balance: 10000 },
        { account_code: '400', account_name: 'Clients', account_type: 'asset', balance: 8000 },
        { account_code: '550', account_name: 'Banque', account_type: 'asset', balance: 3000 },
      ],
      liabilities: [
        { account_code: '440', account_name: 'Fournisseurs', account_type: 'liability', balance: 6000 },
        { account_code: '174', account_name: 'Emprunts bancaires', account_type: 'liability', balance: 5000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 10000 },
      ],
      totalAssets: 21000,
    };

    const metrics = extractFinancialPosition(balanceSheet, 'belgium');

    expect(metrics.receivables).toBe(8000);
    expect(metrics.tradePayables).toBe(6000);
    expect(metrics.cash).toBe(3000);
    expect(metrics.financialDebt).toBe(5000);
  });

  it('derives capex and pre-tax income from entries', () => {
    const accounts = [
      { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset' },
      { account_code: '404', account_name: 'Supplier of fixed assets', account_type: 'liability' },
      { account_code: '215', account_name: 'Software', account_type: 'asset' },
      { account_code: '695', account_name: 'Impot sur les benefices', account_type: 'expense' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
    ];
    const entries = [
      { entry_ref: 'CAP-001', account_code: '218', debit: '1200', credit: '0', transaction_date: '2026-01-05' },
      { entry_ref: 'CAP-001', account_code: '404', debit: '0', credit: '1200', transaction_date: '2026-01-05' },
      { entry_ref: 'RECLASS-001', account_code: '218', debit: '200', credit: '0', transaction_date: '2026-01-20' },
      { entry_ref: 'RECLASS-001', account_code: '215', debit: '0', credit: '200', transaction_date: '2026-01-20' },
      { entry_ref: 'TAX-001', account_code: '695', debit: '500', credit: '0', transaction_date: '2026-01-31' },
    ];

    expect(calculateCapexFromEntries(entries, accounts, '2026-01-01', '2026-01-31')).toBe(1200);
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

  it('excludes financial charges and income tax from EBITDA for french datasets', () => {
    const accounts = [
      { account_code: '101', account_name: 'Capital', account_type: 'equity' },
      { account_code: '164', account_name: 'Bank loan', account_type: 'liability' },
      { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset' },
      { account_code: '411', account_name: 'Clients', account_type: 'asset' },
      { account_code: '401', account_name: 'Suppliers', account_type: 'liability' },
      { account_code: '512', account_name: 'Banque', account_type: 'asset' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
      { account_code: '601', account_name: 'Achats', account_type: 'expense' },
      { account_code: '613', account_name: 'Loyer', account_type: 'expense' },
      { account_code: '641', account_name: 'Salaires', account_type: 'expense' },
      { account_code: '6611', account_name: 'Interets des emprunts', account_type: 'expense' },
      { account_code: '6811', account_name: 'Dotations aux amortissements', account_type: 'expense' },
      { account_code: '695', account_name: 'Impot sur les benefices', account_type: 'expense' },
    ];

    const entries = [
      { entry_ref: 'REV-001', account_code: '701', debit: '0', credit: '10000', transaction_date: '2026-01-31' },
      { entry_ref: 'EXP-001', account_code: '601', debit: '4000', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'EXP-002', account_code: '613', debit: '1000', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'PAY-001', account_code: '641', debit: '1200', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'FIN-001', account_code: '6611', debit: '300', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'AMO-001', account_code: '6811', debit: '500', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'TAX-001', account_code: '695', debit: '400', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'CAP-001', account_code: '218', debit: '900', credit: '0', transaction_date: '2026-01-12' },
      { entry_ref: 'CAP-001', account_code: '401', debit: '0', credit: '900', transaction_date: '2026-01-12' },
    ];

    const balanceSheet = {
      assets: [
        { account_code: '218', account_name: 'Industrial equipment', account_type: 'asset', balance: 8000 },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', balance: 4000 },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', balance: 2000 },
      ],
      liabilities: [
        { account_code: '401', account_name: 'Suppliers', account_type: 'liability', balance: 1800 },
        { account_code: '164', account_name: 'Bank loan', account_type: 'liability', balance: 5000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 7200 },
      ],
      totalAssets: 14000,
      balanced: true,
    };

    const incomeStatement = {
      totalRevenue: 10000,
      totalExpenses: 7400,
      netIncome: 2600,
    };

    const diagnostic = buildFinancialDiagnostic(
      entries,
      accounts,
      balanceSheet,
      incomeStatement,
      '2026-01-01',
      '2026-01-31',
      { financing: { bfr: 1000 } },
      'france'
    );

    expect(diagnostic.margins.ebitda).toBe(3800);
    expect(diagnostic.margins.operatingResult).toBe(3300);
    expect(diagnostic.financing.caf).toBe(3100);
    expect(diagnostic.tax.preTaxIncome).toBe(3000);
  });
});

describe('computePilotageRatios', () => {
  it('uses average balance positions and real debt service cash flows', () => {
    const accounts = [
      { account_code: '101', account_name: 'Capital', account_type: 'equity' },
      { account_code: '164', account_name: 'Bank loan', account_type: 'liability' },
      { account_code: '218', account_name: 'Equipment', account_type: 'asset' },
      { account_code: '370', account_name: 'Stock', account_type: 'asset' },
      { account_code: '411', account_name: 'Clients', account_type: 'asset' },
      { account_code: '401', account_name: 'Fournisseurs', account_type: 'liability' },
      { account_code: '512', account_name: 'Banque', account_type: 'asset' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
      { account_code: '601', account_name: 'Achats', account_type: 'expense' },
      { account_code: '6611', account_name: 'Interets des emprunts', account_type: 'expense' },
    ];

    const entries = [
      { entry_ref: 'REV-001', account_code: '701', debit: '0', credit: '12000', transaction_date: '2026-01-10' },
      { entry_ref: 'REV-001', account_code: '411', debit: '12000', credit: '0', transaction_date: '2026-01-10' },
      { entry_ref: 'PUR-001', account_code: '601', debit: '5000', credit: '0', transaction_date: '2026-01-15' },
      { entry_ref: 'PUR-001', account_code: '401', debit: '0', credit: '5000', transaction_date: '2026-01-15' },
      { entry_ref: 'INT-001', account_code: '6611', debit: '300', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'INT-001', account_code: '512', debit: '0', credit: '300', transaction_date: '2026-01-31' },
      { entry_ref: 'DS-001', account_code: '164', debit: '2000', credit: '0', transaction_date: '2026-01-31' },
      { entry_ref: 'DS-001', account_code: '512', debit: '0', credit: '2000', transaction_date: '2026-01-31' },
    ];

    const balanceSheet = {
      assets: [
        { account_code: '218', account_name: 'Equipment', account_type: 'asset', balance: 12000 },
        { account_code: '370', account_name: 'Stock', account_type: 'asset', balance: 1500 },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', balance: 9000 },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', balance: 5000 },
      ],
      liabilities: [
        { account_code: '401', account_name: 'Fournisseurs', account_type: 'liability', balance: 3000 },
        { account_code: '164', account_name: 'Bank loan', account_type: 'liability', balance: 8000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 12000 },
      ],
      totalAssets: 27500,
      balanced: true,
    };

    const previousBalanceSheet = {
      assets: [
        { account_code: '218', account_name: 'Equipment', account_type: 'asset', balance: 11000 },
        { account_code: '370', account_name: 'Stock', account_type: 'asset', balance: 1000 },
        { account_code: '411', account_name: 'Clients', account_type: 'asset', balance: 6000 },
        { account_code: '512', account_name: 'Banque', account_type: 'asset', balance: 4000 },
      ],
      liabilities: [
        { account_code: '401', account_name: 'Fournisseurs', account_type: 'liability', balance: 2000 },
        { account_code: '164', account_name: 'Bank loan', account_type: 'liability', balance: 9000 },
      ],
      equity: [
        { account_code: '101', account_name: 'Capital', account_type: 'equity', balance: 10000 },
      ],
      totalAssets: 22000,
      balanced: true,
    };

    const ratios = computePilotageRatios({
      balanceSheet,
      previousBalanceSheet,
      incomeStatement: {
        totalRevenue: 12000,
        totalExpenses: 5300,
        netIncome: 3000,
      },
      entries,
      accounts,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      region: 'france',
      financialDiagnostic: {
        margins: {
          revenue: 12000,
          ebitda: 5000,
          operatingResult: 4500,
        },
        financing: {
          operatingCashFlow: 4800,
          capex: 800,
        },
      },
    });

    expect(ratios.activity.dso).toBeCloseTo((7500 / 12000) * 365, 5);
    expect(ratios.activity.dpo).toBeCloseTo((2500 / 5000) * 365, 5);
    expect(ratios.activity.stockRotationDays).toBeCloseTo((1250 / 5000) * 365, 5);
    expect(ratios.profitability.roa).toBeCloseTo((3000 / 24750) * 100, 5);
    expect(ratios.structure.financialIndependence).toBeCloseTo((11000 / 24750) * 100, 5);
    expect(ratios.coverage.interestCoverage).toBe(15);
    expect(ratios.coverage.dscr).toBeCloseTo((4800 + 800) / 2300, 5);
    expect(ratios.extracted.annualDebtService).toBe(2300);
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
        cumulativeCashNet: 250,
      },
      {
        key: '2026-02',
        month: 'Fev',
        revenue: 2000,
        expense: 1500,
        net: 500,
        cashIn: 1800,
        cashOut: 1400,
        cashNet: 400,
        cumulativeCashFlow: 650,
        cumulativeCashNet: 650,
      },
    ]);
  });
});
