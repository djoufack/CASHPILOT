import { describe, it, expect } from 'vitest';
import {
  filterByPeriod,
  calculateRevenue,
  calculateRevenueTTC,
  calculateExpenses,
  calculateNetIncome,
  calculateOutputVAT,
  calculateInputVAT,
  calculateVATPayable,
  calculateVATBreakdown,
  estimateTax,
  DEFAULT_TAX_BRACKETS,
  aggregateByMonth,
  buildTrialBalance,
  buildBalanceSheetFromEntries,
  buildIncomeStatementFromEntries,
  buildGeneralLedger,
  buildJournalBook,
  extractAccountsByPrefix,
  getTotalDebt,
  getCashAndEquivalents,
  getCurrentAssets,
  getCurrentLiabilities,
  getInventory,
  getEquity,
  getLongTermDebt,
} from '@/utils/accountingCalculations';

// ============================================================================
// filterByPeriod
// ============================================================================
describe('filterByPeriod', () => {
  const items = [
    { date: '2024-01-15', amount: 100 },
    { date: '2024-02-15', amount: 200 },
    { date: '2024-03-15', amount: 300 },
    { date: '2024-04-15', amount: 400 },
  ];

  it('should filter items within date range', () => {
    const result = filterByPeriod(items, '2024-02-01', '2024-03-31');
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(200);
    expect(result[1].amount).toBe(300);
  });

  it('should include items on boundary dates', () => {
    const result = filterByPeriod(items, '2024-01-15', '2024-01-15');
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
  });

  it('should return all items when range covers everything', () => {
    const result = filterByPeriod(items, '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(4);
  });

  it('should return empty array when no items match', () => {
    const result = filterByPeriod(items, '2025-01-01', '2025-12-31');
    expect(result).toHaveLength(0);
  });

  it('should return all items when startDate is null', () => {
    const result = filterByPeriod(items, null, '2024-12-31');
    expect(result).toHaveLength(4);
  });

  it('should return all items when endDate is null', () => {
    const result = filterByPeriod(items, '2024-01-01', null);
    expect(result).toHaveLength(4);
  });

  it('should return empty array for null items', () => {
    expect(filterByPeriod(null, '2024-01-01', '2024-12-31')).toEqual([]);
  });

  it('should use custom date field', () => {
    const customItems = [
      { created_at: '2024-01-15', value: 10 },
      { created_at: '2024-06-15', value: 20 },
    ];
    const result = filterByPeriod(customItems, '2024-01-01', '2024-03-31', 'created_at');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(10);
  });
});

// ============================================================================
// calculateRevenue
// ============================================================================
describe('calculateRevenue', () => {
  it('should sum total_ht of paid invoices', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ht: '1000' },
      { date: '2024-01-20', status: 'paid', total_ht: '500' },
      { date: '2024-01-30', status: 'draft', total_ht: '800' },
    ];
    const result = calculateRevenue(invoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(1500);
  });

  it('should exclude unpaid invoices', () => {
    const invoices = [
      { date: '2024-01-10', status: 'sent', total_ht: '1000' },
      { date: '2024-01-20', status: 'overdue', total_ht: '500' },
    ];
    const result = calculateRevenue(invoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(calculateRevenue([], '2024-01-01', '2024-01-31')).toBe(0);
  });

  it('should handle missing total_ht', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid' },
    ];
    expect(calculateRevenue(invoices, '2024-01-01', '2024-01-31')).toBe(0);
  });
});

// ============================================================================
// calculateRevenueTTC
// ============================================================================
describe('calculateRevenueTTC', () => {
  it('should sum total_ttc of paid invoices', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ttc: '1200', total_ht: '1000' },
      { date: '2024-01-20', status: 'paid', total_ttc: '600', total_ht: '500' },
    ];
    const result = calculateRevenueTTC(invoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(1800);
  });

  it('should fallback to total_ht when total_ttc is missing', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ht: '1000' },
    ];
    const result = calculateRevenueTTC(invoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(1000);
  });
});

// ============================================================================
// calculateExpenses
// ============================================================================
describe('calculateExpenses', () => {
  it('should sum expenses and supplier invoices', () => {
    const expenses = [
      { date: '2024-01-10', amount_ht: '300', amount: '360' },
      { date: '2024-01-20', amount_ht: '200' },
    ];
    const supplierInvoices = [
      { created_at: '2024-01-15', amount: '150' },
    ];
    const result = calculateExpenses(expenses, supplierInvoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(650); // 300 + 200 + 150
  });

  it('should fallback to amount when amount_ht is missing', () => {
    const expenses = [
      { date: '2024-01-10', amount: '100' },
    ];
    const result = calculateExpenses(expenses, [], '2024-01-01', '2024-01-31');
    expect(result).toBe(100);
  });

  it('should handle null supplier invoices', () => {
    const expenses = [{ date: '2024-01-10', amount_ht: '100' }];
    const result = calculateExpenses(expenses, null, '2024-01-01', '2024-01-31');
    expect(result).toBe(100);
  });

  it('should return 0 for empty arrays', () => {
    expect(calculateExpenses([], [], '2024-01-01', '2024-01-31')).toBe(0);
  });
});

// ============================================================================
// calculateNetIncome
// ============================================================================
describe('calculateNetIncome', () => {
  it('should return revenue minus expenses', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ht: '1000' },
    ];
    const expenses = [
      { date: '2024-01-15', amount_ht: '400' },
    ];
    const result = calculateNetIncome(invoices, expenses, [], '2024-01-01', '2024-01-31');
    expect(result).toBe(600);
  });

  it('should return negative when expenses exceed revenue', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ht: '200' },
    ];
    const expenses = [
      { date: '2024-01-15', amount_ht: '500' },
    ];
    const result = calculateNetIncome(invoices, expenses, [], '2024-01-01', '2024-01-31');
    expect(result).toBe(-300);
  });
});

// ============================================================================
// VAT Calculations
// ============================================================================
describe('calculateOutputVAT', () => {
  it('should calculate VAT as ttc - ht for paid invoices', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', total_ttc: '1200', total_ht: '1000' },
      { date: '2024-01-20', status: 'paid', total_ttc: '600', total_ht: '500' },
    ];
    const result = calculateOutputVAT(invoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(300); // (1200-1000) + (600-500)
  });

  it('should exclude unpaid invoices', () => {
    const invoices = [
      { date: '2024-01-10', status: 'draft', total_ttc: '1200', total_ht: '1000' },
    ];
    expect(calculateOutputVAT(invoices, '2024-01-01', '2024-01-31')).toBe(0);
  });
});

describe('calculateInputVAT', () => {
  it('should sum tax_amount from expenses and supplier invoices', () => {
    const expenses = [
      { date: '2024-01-10', tax_amount: '60' },
      { date: '2024-01-20', tax_amount: '40' },
    ];
    const supplierInvoices = [
      { created_at: '2024-01-15', tax_amount: '30' },
    ];
    const result = calculateInputVAT(expenses, supplierInvoices, '2024-01-01', '2024-01-31');
    expect(result).toBe(130);
  });
});

describe('calculateVATPayable', () => {
  it('should return output VAT minus input VAT', () => {
    expect(calculateVATPayable(300, 100)).toBe(200);
  });

  it('should return negative when input VAT exceeds output (VAT credit)', () => {
    expect(calculateVATPayable(100, 300)).toBe(-200);
  });

  it('should return 0 when equal', () => {
    expect(calculateVATPayable(150, 150)).toBe(0);
  });
});

describe('calculateVATBreakdown', () => {
  it('should group output VAT by rate', () => {
    const invoices = [
      { date: '2024-01-10', status: 'paid', tax_rate: '20', total_ttc: '120', total_ht: '100' },
      { date: '2024-01-20', status: 'paid', tax_rate: '20', total_ttc: '240', total_ht: '200' },
      { date: '2024-01-25', status: 'paid', tax_rate: '5.5', total_ttc: '105.5', total_ht: '100' },
    ];
    const result = calculateVATBreakdown(invoices, [], '2024-01-01', '2024-01-31');
    expect(result.output).toHaveLength(2);
    // Sorted by rate descending
    expect(result.output[0].rate).toBe(20);
    expect(result.output[0].vat).toBe(60); // 20 + 40
    expect(result.output[1].rate).toBe(5.5);
    expect(result.output[1].vat).toBe(5.5);
  });

  it('should group input VAT by rate', () => {
    const expenses = [
      { date: '2024-01-10', tax_rate: '20', amount_ht: '100', tax_amount: '20' },
      { date: '2024-01-20', tax_rate: '10', amount_ht: '50', tax_amount: '5' },
    ];
    const result = calculateVATBreakdown([], expenses, '2024-01-01', '2024-01-31');
    expect(result.input).toHaveLength(2);
    expect(result.input[0].rate).toBe(20);
    expect(result.input[0].vat).toBe(20);
  });

  it('should skip expenses with zero tax rate for input VAT', () => {
    const expenses = [
      { date: '2024-01-10', tax_rate: '0', amount_ht: '100', tax_amount: '0' },
    ];
    const result = calculateVATBreakdown([], expenses, '2024-01-01', '2024-01-31');
    expect(result.input).toHaveLength(0);
  });
});

// ============================================================================
// estimateTax (French corporate tax)
// ============================================================================
describe('estimateTax', () => {
  it('should return 0 tax for zero income', () => {
    const result = estimateTax(0);
    expect(result.totalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.quarterlyPayment).toBe(0);
  });

  it('should return 0 tax for negative income', () => {
    const result = estimateTax(-10000);
    expect(result.totalTax).toBe(0);
  });

  it('should apply reduced PME rate for income under 42500', () => {
    const result = estimateTax(30000);
    // 30000 * 15% = 4500
    expect(result.totalTax).toBe(4500);
    expect(result.effectiveRate).toBe(0.15);
    expect(result.details).toHaveLength(1);
    expect(result.quarterlyPayment).toBe(1125);
  });

  it('should apply both brackets for income above 42500', () => {
    const result = estimateTax(100000);
    // First bracket: 42500 * 15% = 6375
    // Second bracket: 57500 * 25% = 14375
    // Total: 20750
    expect(result.totalTax).toBe(20750);
    expect(result.details).toHaveLength(2);
    expect(result.details[0].taxableAmount).toBe(42500);
    expect(result.details[0].tax).toBe(6375);
    expect(result.details[1].taxableAmount).toBe(57500);
    expect(result.details[1].tax).toBe(14375);
  });

  it('should calculate effective rate correctly', () => {
    const result = estimateTax(100000);
    expect(result.effectiveRate).toBeCloseTo(0.2075, 4);
  });

  it('should calculate quarterly payment correctly', () => {
    const result = estimateTax(100000);
    expect(result.quarterlyPayment).toBe(20750 / 4);
  });

  it('should handle exact bracket boundary (42500)', () => {
    const result = estimateTax(42500);
    // Entirely in first bracket: 42500 * 15% = 6375
    expect(result.totalTax).toBe(6375);
    expect(result.details).toHaveLength(1);
  });

  it('should accept custom brackets', () => {
    const customBrackets = [
      { min: 0, max: 10000, rate: 0.10, label: '10%' },
      { min: 10000, max: Infinity, rate: 0.30, label: '30%' },
    ];
    const result = estimateTax(20000, customBrackets);
    // 10000 * 10% = 1000, 10000 * 30% = 3000
    expect(result.totalTax).toBe(4000);
  });
});

describe('DEFAULT_TAX_BRACKETS', () => {
  it('should have two brackets', () => {
    expect(DEFAULT_TAX_BRACKETS).toHaveLength(2);
  });

  it('should have PME rate at 15%', () => {
    expect(DEFAULT_TAX_BRACKETS[0].rate).toBe(0.15);
    expect(DEFAULT_TAX_BRACKETS[0].max).toBe(42500);
  });

  it('should have normal rate at 25%', () => {
    expect(DEFAULT_TAX_BRACKETS[1].rate).toBe(0.25);
    expect(DEFAULT_TAX_BRACKETS[1].max).toBe(Infinity);
  });
});

// ============================================================================
// aggregateByMonth
// ============================================================================
describe('aggregateByMonth', () => {
  it('should aggregate items by month', () => {
    const items = [
      { date: '2024-01-10', amount: 100 },
      { date: '2024-01-20', amount: 200 },
      { date: '2024-02-15', amount: 300 },
    ];
    const result = aggregateByMonth(items);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('2024-01');
    expect(result[0].total).toBe(300);
    expect(result[1].key).toBe('2024-02');
    expect(result[1].total).toBe(300);
  });

  it('should use custom fields', () => {
    const items = [
      { created_at: '2024-03-10', value: 50 },
      { created_at: '2024-03-20', value: 75 },
    ];
    const result = aggregateByMonth(items, 'created_at', 'value');
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(125);
  });

  it('should return empty for null items', () => {
    expect(aggregateByMonth(null)).toEqual([]);
  });

  it('should return empty for empty array', () => {
    expect(aggregateByMonth([])).toEqual([]);
  });

  it('should skip items with invalid dates', () => {
    const items = [
      { date: '2024-01-10', amount: 100 },
      { date: 'invalid', amount: 200 },
    ];
    const result = aggregateByMonth(items);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(100);
  });

  it('should sort results chronologically', () => {
    const items = [
      { date: '2024-03-10', amount: 300 },
      { date: '2024-01-10', amount: 100 },
      { date: '2024-02-10', amount: 200 },
    ];
    const result = aggregateByMonth(items);
    expect(result[0].key).toBe('2024-01');
    expect(result[1].key).toBe('2024-02');
    expect(result[2].key).toBe('2024-03');
  });
});

// ============================================================================
// buildTrialBalance
// ============================================================================
describe('buildTrialBalance', () => {
  const accounts = [
    { account_code: '411', account_name: 'Clients', account_type: 'asset', account_category: 'Creances' },
    { account_code: '601', account_name: 'Achats', account_type: 'expense', account_category: 'Charges' },
    { account_code: '701', account_name: 'Ventes', account_type: 'revenue', account_category: 'Produits' },
  ];

  it('should build trial balance from entries', () => {
    const entries = [
      { account_code: '411', debit: '1000', credit: '0' },
      { account_code: '701', debit: '0', credit: '1000' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result).toHaveLength(2);
    const clientAccount = result.find(r => r.account_code === '411');
    expect(clientAccount.totalDebit).toBe(1000);
    expect(clientAccount.totalCredit).toBe(0);
    expect(clientAccount.balance).toBe(1000); // asset: debit - credit
  });

  it('should calculate balance correctly for asset accounts (debit - credit)', () => {
    const entries = [
      { account_code: '411', debit: '500', credit: '200' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result[0].balance).toBe(300);
  });

  it('should calculate balance correctly for revenue accounts (credit - debit)', () => {
    const entries = [
      { account_code: '701', debit: '0', credit: '1000' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result[0].balance).toBe(1000);
  });

  it('should calculate balance correctly for expense accounts (debit - credit)', () => {
    const entries = [
      { account_code: '601', debit: '300', credit: '0' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result[0].balance).toBe(300);
  });

  it('should return empty for null entries', () => {
    expect(buildTrialBalance(null, accounts)).toEqual([]);
  });

  it('should return empty for empty entries', () => {
    expect(buildTrialBalance([], accounts)).toEqual([]);
  });

  it('should sort by account_code', () => {
    const entries = [
      { account_code: '701', debit: '0', credit: '1000' },
      { account_code: '411', debit: '1000', credit: '0' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result[0].account_code).toBe('411');
    expect(result[1].account_code).toBe('701');
  });

  it('should handle entries for unknown accounts', () => {
    const entries = [
      { account_code: '999', debit: '100', credit: '0' },
    ];
    const result = buildTrialBalance(entries, accounts);
    expect(result).toHaveLength(1);
    expect(result[0].account_code).toBe('999');
    expect(result[0].account_type).toBe('unknown');
  });
});

// ============================================================================
// buildBalanceSheetFromEntries
// ============================================================================
describe('buildBalanceSheetFromEntries', () => {
  it('should return empty balance sheet for no entries', () => {
    const result = buildBalanceSheetFromEntries([], [], '2024-01-01', '2024-12-31');
    expect(result.totalAssets).toBe(0);
    expect(result.totalLiabilities).toBe(0);
    expect(result.totalEquity).toBe(0);
    expect(result.balanced).toBe(true);
  });

  it('should return empty for null entries', () => {
    const accounts = [{ account_code: '411', account_name: 'Clients', account_type: 'asset' }];
    const result = buildBalanceSheetFromEntries(accounts, null, '2024-01-01', '2024-12-31');
    expect(result.balanced).toBe(true);
  });

  it('should build balance sheet with asset and revenue entries', () => {
    const accounts = [
      { account_code: '512', account_name: 'Banque', account_type: 'asset', account_category: 'Tresorerie' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue', account_category: 'Produits' },
    ];
    const entries = [
      { account_code: '512', debit: '1000', credit: '0', transaction_date: '2024-06-01' },
      { account_code: '701', debit: '0', credit: '1000', transaction_date: '2024-06-01' },
    ];
    const result = buildBalanceSheetFromEntries(accounts, entries, '2024-01-01', '2024-12-31');
    expect(result.totalAssets).toBe(1000);
    // Net income from revenue goes to equity
    expect(result.totalEquity).toBe(1000);
    expect(result.balanced).toBe(true);
  });
});

// ============================================================================
// buildIncomeStatementFromEntries
// ============================================================================
describe('buildIncomeStatementFromEntries', () => {
  it('should return empty for no entries', () => {
    const result = buildIncomeStatementFromEntries([], [], '2024-01-01', '2024-12-31');
    expect(result.totalRevenue).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.netIncome).toBe(0);
  });

  it('should calculate net income from revenue and expense entries', () => {
    const accounts = [
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue', account_category: 'Produits' },
      { account_code: '601', account_name: 'Achats', account_type: 'expense', account_category: 'Charges' },
    ];
    const entries = [
      { account_code: '701', debit: '0', credit: '5000', transaction_date: '2024-06-01' },
      { account_code: '601', debit: '2000', credit: '0', transaction_date: '2024-06-01' },
    ];
    const result = buildIncomeStatementFromEntries(accounts, entries, '2024-01-01', '2024-12-31');
    expect(result.totalRevenue).toBe(5000);
    expect(result.totalExpenses).toBe(2000);
    expect(result.netIncome).toBe(3000);
  });
});

// ============================================================================
// buildGeneralLedger
// ============================================================================
describe('buildGeneralLedger', () => {
  it('should return empty for no entries', () => {
    expect(buildGeneralLedger([], [], '2024-01-01', '2024-12-31')).toEqual([]);
  });

  it('should return empty for null entries', () => {
    expect(buildGeneralLedger(null, [], '2024-01-01', '2024-12-31')).toEqual([]);
  });

  it('should group entries by account code', () => {
    const accounts = [
      { account_code: '411', account_name: 'Clients', account_type: 'asset' },
      { account_code: '701', account_name: 'Ventes', account_type: 'revenue' },
    ];
    const entries = [
      { account_code: '411', debit: '500', credit: '0', transaction_date: '2024-03-01' },
      { account_code: '411', debit: '300', credit: '0', transaction_date: '2024-03-15' },
      { account_code: '701', debit: '0', credit: '800', transaction_date: '2024-03-10' },
    ];
    const result = buildGeneralLedger(entries, accounts, '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(2);
    const clientLedger = result.find(l => l.account_code === '411');
    expect(clientLedger.entries).toHaveLength(2);
    expect(clientLedger.totalDebit).toBe(800);
    expect(clientLedger.balance).toBe(800); // asset: debit - credit
  });

  it('should sort entries by transaction date within each account', () => {
    const entries = [
      { account_code: '411', debit: '100', credit: '0', transaction_date: '2024-03-15' },
      { account_code: '411', debit: '200', credit: '0', transaction_date: '2024-03-01' },
    ];
    const result = buildGeneralLedger(entries, [], '2024-01-01', '2024-12-31');
    expect(new Date(result[0].entries[0].transaction_date).getTime())
      .toBeLessThan(new Date(result[0].entries[1].transaction_date).getTime());
  });
});

// ============================================================================
// buildJournalBook
// ============================================================================
describe('buildJournalBook', () => {
  it('should return empty for no entries', () => {
    expect(buildJournalBook([], '2024-01-01', '2024-12-31')).toEqual([]);
  });

  it('should return empty for null entries', () => {
    expect(buildJournalBook(null, '2024-01-01', '2024-12-31')).toEqual([]);
  });

  it('should group entries by entry_ref', () => {
    const entries = [
      { entry_ref: 'VTE-001', account_code: '411', debit: '1200', credit: '0', transaction_date: '2024-01-10', journal: 'VE' },
      { entry_ref: 'VTE-001', account_code: '701', debit: '0', credit: '1000', transaction_date: '2024-01-10', journal: 'VE' },
      { entry_ref: 'VTE-001', account_code: '4457', debit: '0', credit: '200', transaction_date: '2024-01-10', journal: 'VE' },
    ];
    const result = buildJournalBook(entries, '2024-01-01', '2024-12-31');
    expect(result).toHaveLength(1);
    expect(result[0].entry_ref).toBe('VTE-001');
    expect(result[0].lines).toHaveLength(3);
    expect(result[0].totalDebit).toBe(1200);
    expect(result[0].totalCredit).toBe(1200);
  });

  it('should sort groups by date', () => {
    const entries = [
      { entry_ref: 'B', account_code: '411', debit: '100', credit: '0', transaction_date: '2024-02-01' },
      { entry_ref: 'A', account_code: '411', debit: '200', credit: '0', transaction_date: '2024-01-01' },
    ];
    const result = buildJournalBook(entries, '2024-01-01', '2024-12-31');
    expect(result[0].entry_ref).toBe('A');
    expect(result[1].entry_ref).toBe('B');
  });
});

// ============================================================================
// Balance Sheet Helper Functions
// ============================================================================
describe('Balance Sheet Helper Functions', () => {
  describe('extractAccountsByPrefix', () => {
    it('should extract accounts matching prefix', () => {
      const balanceSheet = {
        assets: [
          { account_code: '411', balance: 100 },
          { account_code: '512', balance: 200 },
        ],
        liabilities: [
          { account_code: '401', balance: 50 },
        ],
        equity: [],
      };
      const result = extractAccountsByPrefix(balanceSheet, '41');
      expect(result).toHaveLength(1);
      expect(result[0].account_code).toBe('411');
    });

    it('should return empty for null balanceSheet', () => {
      expect(extractAccountsByPrefix(null, '41')).toEqual([]);
    });
  });

  describe('getTotalDebt', () => {
    it('should sum class 16 and 17 liabilities', () => {
      const balanceSheet = {
        liabilities: [
          { account_code: '164', balance: 10000 },
          { account_code: '171', balance: 5000 },
          { account_code: '401', balance: 2000 },
        ],
      };
      expect(getTotalDebt(balanceSheet)).toBe(15000);
    });

    it('should return 0 for null', () => {
      expect(getTotalDebt(null)).toBe(0);
    });
  });

  describe('getCashAndEquivalents', () => {
    it('should sum class 52 and 57 assets', () => {
      const balanceSheet = {
        assets: [
          { account_code: '521', balance: 5000 },
          { account_code: '571', balance: 1000 },
          { account_code: '411', balance: 3000 },
        ],
      };
      expect(getCashAndEquivalents(balanceSheet)).toBe(6000);
    });

    it('should return 0 for null', () => {
      expect(getCashAndEquivalents(null)).toBe(0);
    });
  });

  describe('getCurrentAssets', () => {
    it('should sum class 3, 4, and 5 assets', () => {
      const balanceSheet = {
        assets: [
          { account_code: '311', balance: 1000 },  // Stock
          { account_code: '411', balance: 2000 },  // Creances
          { account_code: '521', balance: 3000 },  // Banque
          { account_code: '211', balance: 5000 },  // Immobilisation (not current)
        ],
      };
      expect(getCurrentAssets(balanceSheet)).toBe(6000);
    });

    it('should return 0 for null', () => {
      expect(getCurrentAssets(null)).toBe(0);
    });
  });

  describe('getCurrentLiabilities', () => {
    it('should sum class 40 and 44 liabilities', () => {
      const balanceSheet = {
        liabilities: [
          { account_code: '401', balance: 2000 },
          { account_code: '445', balance: 500 },
          { account_code: '164', balance: 10000 },  // Long term, not current
        ],
      };
      expect(getCurrentLiabilities(balanceSheet)).toBe(2500);
    });

    it('should return 0 for null', () => {
      expect(getCurrentLiabilities(null)).toBe(0);
    });
  });

  describe('getInventory', () => {
    it('should sum class 3 assets', () => {
      const balanceSheet = {
        assets: [
          { account_code: '311', balance: 1000 },
          { account_code: '371', balance: 500 },
          { account_code: '411', balance: 3000 },
        ],
      };
      expect(getInventory(balanceSheet)).toBe(1500);
    });

    it('should return 0 for null', () => {
      expect(getInventory(null)).toBe(0);
    });
  });

  describe('getEquity', () => {
    it('should sum class 10 equity', () => {
      const balanceSheet = {
        equity: [
          { account_code: '101', balance: 50000 },
          { account_code: '106', balance: 10000 },
          { account_code: '120', balance: 5000 },  // Not class 10
        ],
      };
      expect(getEquity(balanceSheet)).toBe(60000);
    });

    it('should return 0 for null', () => {
      expect(getEquity(null)).toBe(0);
    });
  });

  describe('getLongTermDebt', () => {
    it('should sum class 16 liabilities', () => {
      const balanceSheet = {
        liabilities: [
          { account_code: '164', balance: 10000 },
          { account_code: '168', balance: 5000 },
          { account_code: '171', balance: 2000 },  // Class 17, not 16
        ],
      };
      expect(getLongTermDebt(balanceSheet)).toBe(15000);
    });

    it('should return 0 for null', () => {
      expect(getLongTermDebt(null)).toBe(0);
    });
  });
});
