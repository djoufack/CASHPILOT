import { describe, it, expect } from 'vitest';
import {
  normalizeTransactions,
  computeMatchScore,
  autoMatchLines,
  getReconciliationSummary,
  searchMatches,
  enhancedMatchScore,
  findBestMatches,
} from '@/utils/reconciliationMatcher';

// ============================================================================
// normalizeTransactions
// ============================================================================
describe('normalizeTransactions', () => {
  it('should normalize paid invoices as positive amounts', () => {
    const invoices = [
      { id: '1', status: 'paid', total_ttc: 1000, date: '2026-01-15', invoice_number: 'INV-001' },
    ];
    const result = normalizeTransactions(invoices, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1000);
    expect(result[0].source_type).toBe('invoice');
  });

  it('should skip non-paid invoices', () => {
    const invoices = [
      { id: '1', status: 'draft', total_ttc: 1000, date: '2026-01-15' },
      { id: '2', status: 'sent', total_ttc: 500, date: '2026-01-20' },
    ];
    const result = normalizeTransactions(invoices, [], []);
    expect(result).toHaveLength(0);
  });

  it('should normalize expenses as negative amounts', () => {
    const expenses = [
      { id: '1', amount: 200, expense_date: '2026-01-10', description: 'Office supplies' },
    ];
    const result = normalizeTransactions([], expenses, []);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-200);
    expect(result[0].source_type).toBe('expense');
  });

  it('should normalize paid supplier invoices as negative amounts', () => {
    const supplierInvoices = [
      { id: '1', payment_status: 'paid', total_amount: 500, vat_amount: 100, invoice_date: '2026-01-12' },
    ];
    const result = normalizeTransactions([], [], supplierInvoices);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-600);
    expect(result[0].source_type).toBe('supplier_invoice');
  });

  it('should skip unpaid supplier invoices', () => {
    const supplierInvoices = [
      { id: '1', payment_status: 'pending', total_amount: 500 },
    ];
    const result = normalizeTransactions([], [], supplierInvoices);
    expect(result).toHaveLength(0);
  });

  it('should handle all empty inputs', () => {
    expect(normalizeTransactions()).toHaveLength(0);
  });

  it('should combine all sources', () => {
    const invoices = [{ id: '1', status: 'paid', total_ttc: 1000, date: '2026-01-15' }];
    const expenses = [{ id: '2', amount: 200, expense_date: '2026-01-10' }];
    const suppliers = [{ id: '3', payment_status: 'paid', total_amount: 300, invoice_date: '2026-01-12' }];
    const result = normalizeTransactions(invoices, expenses, suppliers);
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// computeMatchScore
// ============================================================================
describe('computeMatchScore', () => {
  it('should return high score for exact amount + same day match', () => {
    const bankLine = { amount: 1000, date: '2026-01-15', description: 'Payment INV-001' };
    const txn = { amount: 1000, date: '2026-01-15', reference: 'INV-001' };
    const score = computeMatchScore(bankLine, txn);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should return 0 for opposite direction (positive bank + negative txn)', () => {
    const bankLine = { amount: 1000, date: '2026-01-15', description: 'Payment' };
    const txn = { amount: -500, date: '2026-01-15', reference: null };
    expect(computeMatchScore(bankLine, txn)).toBe(0);
  });

  it('should score amount proximity', () => {
    const bankLine = { amount: -100, date: '2026-01-15', description: '' };
    const txnExact = { amount: -100, date: '2026-01-15', reference: null };
    const txnClose = { amount: -99.5, date: '2026-01-15', reference: null };
    const txnFar = { amount: -50, date: '2026-01-15', reference: null };

    const scoreExact = computeMatchScore(bankLine, txnExact);
    const scoreClose = computeMatchScore(bankLine, txnClose);
    const scoreFar = computeMatchScore(bankLine, txnFar);

    expect(scoreExact).toBeGreaterThan(scoreClose);
    expect(scoreClose).toBeGreaterThan(scoreFar);
  });

  it('should score date proximity', () => {
    const bankLine = { amount: 100, date: '2026-01-15', description: '' };
    const txnSameDay = { amount: 100, date: '2026-01-15', reference: null };
    const txnWeekLater = { amount: 100, date: '2026-01-22', reference: null };

    const scoreSameDay = computeMatchScore(bankLine, txnSameDay);
    const scoreWeekLater = computeMatchScore(bankLine, txnWeekLater);

    expect(scoreSameDay).toBeGreaterThan(scoreWeekLater);
  });

  it('should give bonus for reference match', () => {
    const bankLine = { amount: 100, date: '2026-01-15', description: 'Payment for INV2026001' };
    const txnWithRef = { amount: 100, date: '2026-01-15', reference: 'INV2026001' };
    const txnNoRef = { amount: 100, date: '2026-01-15', reference: null };

    const scoreWithRef = computeMatchScore(bankLine, txnWithRef);
    const scoreNoRef = computeMatchScore(bankLine, txnNoRef);

    expect(scoreWithRef).toBeGreaterThan(scoreNoRef);
  });

  it('should cap score at 100', () => {
    const bankLine = { amount: 1000, date: '2026-01-15', description: 'Acme Corp INV-001' };
    const txn = { amount: 1000, date: '2026-01-15', reference: 'INV-001', clientName: 'Acme Corp' };
    expect(computeMatchScore(bankLine, txn)).toBeLessThanOrEqual(100);
  });

  it('should handle zero amounts', () => {
    const bankLine = { amount: 0, date: '2026-01-15', description: '' };
    const txn = { amount: 0, date: '2026-01-15', reference: null };
    const score = computeMatchScore(bankLine, txn);
    expect(score).toBeGreaterThanOrEqual(50);
  });
});

// ============================================================================
// autoMatchLines
// ============================================================================
describe('autoMatchLines', () => {
  it('should auto-match high-confidence pairs', () => {
    const bankLines = [
      { id: 'bl-1', amount: 1000, date: '2026-01-15', description: 'INV-001' },
    ];
    const transactions = [
      { id: 'tx-1', amount: 1000, date: '2026-01-15', reference: 'INV-001', source_type: 'invoice' },
    ];
    const results = autoMatchLines(bankLines, transactions);
    expect(results).toHaveLength(1);
    expect(results[0].matched).toBe(true);
    expect(results[0].autoMatched).toBe(true);
  });

  it('should return unmatched for low-score pairs', () => {
    const bankLines = [
      { id: 'bl-1', amount: 1000, date: '2026-01-15', description: 'Random payment' },
    ];
    const transactions = [
      { id: 'tx-1', amount: -500, date: '2026-06-01', reference: null, source_type: 'expense' },
    ];
    const results = autoMatchLines(bankLines, transactions);
    expect(results).toHaveLength(1);
    expect(results[0].matched).toBe(false);
  });

  it('should not reuse a transaction for multiple bank lines', () => {
    const bankLines = [
      { id: 'bl-1', amount: 500, date: '2026-01-15', description: 'Payment' },
      { id: 'bl-2', amount: 500, date: '2026-01-16', description: 'Payment' },
    ];
    const transactions = [
      { id: 'tx-1', amount: 500, date: '2026-01-15', reference: null, source_type: 'invoice' },
    ];
    const results = autoMatchLines(bankLines, transactions);
    const autoMatched = results.filter(r => r.autoMatched);
    expect(autoMatched.length).toBeLessThanOrEqual(1);
  });

  it('should handle empty inputs', () => {
    expect(autoMatchLines([], [])).toHaveLength(0);
  });
});

// ============================================================================
// getReconciliationSummary
// ============================================================================
describe('getReconciliationSummary', () => {
  it('should compute summary for mixed reconciliation lines', () => {
    const lines = [
      { amount: 1000, reconciliation_status: 'matched' },
      { amount: -500, reconciliation_status: 'matched' },
      { amount: 200, reconciliation_status: 'unmatched' },
      { amount: -100, reconciliation_status: 'unmatched' },
      { amount: 50, reconciliation_status: 'ignored' },
    ];
    const summary = getReconciliationSummary(lines);
    expect(summary.totalLines).toBe(5);
    expect(summary.matchedLines).toBe(2);
    expect(summary.unmatchedLines).toBe(2);
    expect(summary.ignoredLines).toBe(1);
    expect(summary.matchRate).toBe(40);
    expect(summary.totalCredits).toBe(1250); // 1000 + 200 + 50
    expect(summary.totalDebits).toBe(-600); // -500 + -100
    expect(summary.matchedCredits).toBe(1000);
    expect(summary.matchedDebits).toBe(-500);
  });

  it('should handle empty lines', () => {
    const summary = getReconciliationSummary([]);
    expect(summary.totalLines).toBe(0);
    expect(summary.matchRate).toBe(0);
  });

  it('should handle all matched lines', () => {
    const lines = [
      { amount: 100, reconciliation_status: 'matched' },
      { amount: 200, reconciliation_status: 'matched' },
    ];
    const summary = getReconciliationSummary(lines);
    expect(summary.matchRate).toBe(100);
  });
});

// ============================================================================
// searchMatches
// ============================================================================
describe('searchMatches', () => {
  it('should return scored candidates sorted by score descending', () => {
    const bankLine = { amount: 100, date: '2026-01-15', description: '' };
    const transactions = [
      { id: '1', amount: 100, date: '2026-01-15', reference: null },
      { id: '2', amount: 100, date: '2026-03-01', reference: null },
    ];
    const results = searchMatches(bankLine, transactions);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);
  });

  it('should filter by text', () => {
    const bankLine = { amount: 100, date: '2026-01-15', description: '' };
    const transactions = [
      { id: '1', amount: 100, date: '2026-01-15', reference: null, description: 'Office rent' },
      { id: '2', amount: 100, date: '2026-01-15', reference: null, description: 'Salary payment' },
    ];
    const results = searchMatches(bankLine, transactions, { textFilter: 'rent' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  it('should limit results to 20', () => {
    const bankLine = { amount: 100, date: '2026-01-15', description: '' };
    const transactions = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      amount: 100,
      date: '2026-01-15',
      reference: null,
    }));
    const results = searchMatches(bankLine, transactions);
    expect(results.length).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// enhancedMatchScore
// ============================================================================
describe('enhancedMatchScore', () => {
  it('should return high confidence for exact match', () => {
    const tx = { amount: 1000, date: '2026-01-15', reference: 'INV-001' };
    const inv = { total_ttc: 1000, invoice_date: '2026-01-15', invoice_number: 'INV-001' };
    const result = enhancedMatchScore(tx, inv);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.isMatch).toBe(true);
  });

  it('should return low confidence for mismatched data', () => {
    const tx = { amount: 1000, date: '2026-01-15', reference: 'PAY-999' };
    const inv = { total_ttc: 50, invoice_date: '2025-06-01', invoice_number: 'INV-001' };
    const result = enhancedMatchScore(tx, inv);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should include factor breakdown', () => {
    const tx = { amount: 500, date: '2026-01-15', reference: '' };
    const inv = { total_ttc: 500, invoice_date: '2026-01-15', invoice_number: '' };
    const result = enhancedMatchScore(tx, inv);
    expect(result.factors).toBeDefined();
    expect(typeof result.factors.amount).toBe('number');
    expect(typeof result.factors.date).toBe('number');
  });

  it('should respect custom threshold', () => {
    const tx = { amount: 500, date: '2026-01-15', reference: '' };
    const inv = { total_ttc: 510, invoice_date: '2026-01-20', invoice_number: '' };
    const highThreshold = enhancedMatchScore(tx, inv, { threshold: 0.9 });
    const lowThreshold = enhancedMatchScore(tx, inv, { threshold: 0.3 });
    expect(highThreshold.isMatch).toBe(false);
    expect(lowThreshold.isMatch).toBe(true);
  });

  it('should score client name matches', () => {
    const tx = { amount: 500, date: '2026-01-15', description: 'Acme Corp payment' };
    const invWithClient = { total_ttc: 500, invoice_date: '2026-01-15', client_name: 'Acme Corp' };
    const invNoClient = { total_ttc: 500, invoice_date: '2026-01-15', client_name: '' };

    const scoreWith = enhancedMatchScore(tx, invWithClient);
    const scoreWithout = enhancedMatchScore(tx, invNoClient);
    expect(scoreWith.factors.client).toBeGreaterThan(scoreWithout.factors.client);
  });
});

// ============================================================================
// findBestMatches
// ============================================================================
describe('findBestMatches', () => {
  it('should find best matches for transactions', () => {
    const transactions = [
      { amount: 1000, date: '2026-01-15', reference: 'INV-001' },
    ];
    const invoices = [
      { total_ttc: 1000, invoice_date: '2026-01-15', invoice_number: 'INV-001' },
      { total_ttc: 500, invoice_date: '2026-02-01', invoice_number: 'INV-002' },
    ];
    const results = findBestMatches(transactions, invoices);
    expect(results).toHaveLength(1);
    expect(results[0].hasMatch).toBe(true);
    expect(results[0].bestMatch).toBeDefined();
  });

  it('should return no match for unmatched transactions', () => {
    const transactions = [{ amount: 99999, date: '2020-01-01', reference: 'NOTHING' }];
    const invoices = [{ total_ttc: 50, invoice_date: '2026-12-01', invoice_number: 'INV-X' }];
    const results = findBestMatches(transactions, invoices);
    expect(results[0].hasMatch).toBe(false);
    expect(results[0].bestMatch).toBeNull();
  });

  it('should limit alternative matches to maxMatches', () => {
    const transactions = [{ amount: 1000, date: '2026-01-15', reference: '' }];
    const invoices = Array.from({ length: 10 }, (_, i) => ({
      total_ttc: 1000,
      invoice_date: '2026-01-15',
      invoice_number: `INV-${i}`,
    }));
    const results = findBestMatches(transactions, invoices, { maxMatches: 2 });
    const totalMatches = (results[0].bestMatch ? 1 : 0) + results[0].alternativeMatches.length;
    expect(totalMatches).toBeLessThanOrEqual(2);
  });
});
