import { describe, expect, it } from 'vitest';
import {
  calculateCapexFromEntries,
  calculatePreTaxIncome,
  extractFinancialPosition,
} from '@/utils/financialMetrics';

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
