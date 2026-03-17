import { describe, it, expect } from 'vitest';

// ============================================================================
// Business logic extracted from supabase/functions/audit-comptable/index.ts
// Tests the pure helper functions: num(), round2(), gradeFromScore(),
// computeScore(), and the individual check logic patterns.
// ============================================================================

// ---------- Helpers (exact copy from edge function) ----------

function num(v) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function gradeFromScore(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function computeScore(checks) {
  const weights = { error: 10, warning: 5, info: 2 };
  let totalWeight = 0;
  let failedWeight = 0;
  for (const c of checks) {
    const w = weights[c.severity] ?? 5;
    totalWeight += w;
    if (c.status === 'fail') failedWeight += w;
    else if (c.status === 'warning') failedWeight += w * 0.5;
  }
  if (totalWeight === 0) return 100;
  return round2(((totalWeight - failedWeight) / totalWeight) * 100);
}

// ---------- Legal VAT rates per country ----------

const LEGAL_VAT_RATES = {
  FR: [0, 2.1, 5.5, 10, 20],
  BE: [0, 6, 12, 21],
  OHADA: [0, 5, 10, 15, 18, 19.25, 20],
};

// ============================================================================
// num() helper
// ============================================================================
describe('audit-comptable: num() helper', () => {
  it('returns 0 for null', () => {
    expect(num(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(num(undefined)).toBe(0);
  });

  it('returns the number itself for a valid number', () => {
    expect(num(42.5)).toBe(42.5);
  });

  it('parses string numbers correctly', () => {
    expect(num('123.45')).toBe(123.45);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(num('abc')).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(num(NaN)).toBe(0);
  });

  it('handles zero correctly', () => {
    expect(num(0)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(num(-50)).toBe(-50);
  });

  it('handles string "0"', () => {
    expect(num('0')).toBe(0);
  });
});

// ============================================================================
// round2() helper
// ============================================================================
describe('audit-comptable: round2() helper', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.2345)).toBe(1.23);
  });

  it('rounds up correctly', () => {
    expect(round2(1.235)).toBe(1.24);
  });

  it('handles integers', () => {
    expect(round2(5)).toBe(5);
  });

  it('handles negative numbers', () => {
    expect(round2(-1.2345)).toBe(-1.23);
  });

  it('preserves two decimal places', () => {
    expect(round2(10.1)).toBe(10.1);
  });
});

// ============================================================================
// gradeFromScore()
// ============================================================================
describe('audit-comptable: gradeFromScore()', () => {
  it('returns A+ for score >= 95', () => {
    expect(gradeFromScore(95)).toBe('A+');
    expect(gradeFromScore(100)).toBe('A+');
    expect(gradeFromScore(99.5)).toBe('A+');
  });

  it('returns A for score >= 90 and < 95', () => {
    expect(gradeFromScore(90)).toBe('A');
    expect(gradeFromScore(94.99)).toBe('A');
  });

  it('returns B+ for score >= 85 and < 90', () => {
    expect(gradeFromScore(85)).toBe('B+');
    expect(gradeFromScore(89)).toBe('B+');
  });

  it('returns B for score >= 80 and < 85', () => {
    expect(gradeFromScore(80)).toBe('B');
    expect(gradeFromScore(84)).toBe('B');
  });

  it('returns C for score >= 70 and < 80', () => {
    expect(gradeFromScore(70)).toBe('C');
    expect(gradeFromScore(79)).toBe('C');
  });

  it('returns D for score >= 60 and < 70', () => {
    expect(gradeFromScore(60)).toBe('D');
    expect(gradeFromScore(69)).toBe('D');
  });

  it('returns F for score < 60', () => {
    expect(gradeFromScore(59)).toBe('F');
    expect(gradeFromScore(0)).toBe('F');
    expect(gradeFromScore(-10)).toBe('F');
  });
});

// ============================================================================
// computeScore()
// ============================================================================
describe('audit-comptable: computeScore()', () => {
  it('returns 100 for empty checks array', () => {
    expect(computeScore([])).toBe(100);
  });

  it('returns 100 when all checks pass', () => {
    const checks = [
      { status: 'pass', severity: 'error' },
      { status: 'pass', severity: 'warning' },
      { status: 'pass', severity: 'info' },
    ];
    expect(computeScore(checks)).toBe(100);
  });

  it('penalizes failed error checks heavily', () => {
    const checks = [
      { status: 'fail', severity: 'error' },
      { status: 'pass', severity: 'error' },
    ];
    // total weight = 20, failed = 10, score = (20-10)/20 * 100 = 50
    expect(computeScore(checks)).toBe(50);
  });

  it('penalizes warnings at 50% of their weight', () => {
    const checks = [
      { status: 'warning', severity: 'warning' },
      { status: 'pass', severity: 'warning' },
    ];
    // total weight = 10, failed = 2.5, score = (10-2.5)/10 * 100 = 75
    expect(computeScore(checks)).toBe(75);
  });

  it('correctly combines mixed check results', () => {
    const checks = [
      { status: 'pass', severity: 'error' }, // w=10, penalty=0
      { status: 'fail', severity: 'error' }, // w=10, penalty=10
      { status: 'warning', severity: 'warning' }, // w=5, penalty=2.5
      { status: 'pass', severity: 'info' }, // w=2, penalty=0
    ];
    // total weight = 27, failed = 12.5, score = (27-12.5)/27 * 100 = 53.70
    expect(computeScore(checks)).toBe(53.7);
  });

  it('returns 0 when all checks fail with same severity', () => {
    const checks = [
      { status: 'fail', severity: 'error' },
      { status: 'fail', severity: 'error' },
    ];
    // total weight = 20, failed = 20, score = 0
    expect(computeScore(checks)).toBe(0);
  });

  it('handles info severity correctly', () => {
    const checks = [{ status: 'fail', severity: 'info' }];
    // total weight = 2, failed = 2, score = 0
    expect(computeScore(checks)).toBe(0);
  });
});

// ============================================================================
// VAT rate validation logic
// ============================================================================
describe('audit-comptable: VAT rate validation logic', () => {
  it('accepts all legal FR VAT rates', () => {
    const legalRates = LEGAL_VAT_RATES['FR'];
    for (const rate of legalRates) {
      expect(legalRates.includes(rate)).toBe(true);
    }
  });

  it('rejects 25% as invalid for FR', () => {
    const legalRates = LEGAL_VAT_RATES['FR'];
    expect(legalRates.includes(25)).toBe(false);
  });

  it('accepts 21% for Belgium', () => {
    expect(LEGAL_VAT_RATES['BE'].includes(21)).toBe(true);
  });

  it('rejects 20% for Belgium (not a legal rate there)', () => {
    expect(LEGAL_VAT_RATES['BE'].includes(20)).toBe(false);
  });

  it('supports OHADA countries with multiple rates', () => {
    const ohada = LEGAL_VAT_RATES['OHADA'];
    expect(ohada).toContain(18);
    expect(ohada).toContain(19.25);
    expect(ohada.length).toBeGreaterThan(3);
  });

  it('falls back to FR rates when country is not found', () => {
    const country = 'XX';
    const rates = LEGAL_VAT_RATES[country] || LEGAL_VAT_RATES['FR'];
    expect(rates).toEqual(LEGAL_VAT_RATES['FR']);
  });
});

// ============================================================================
// Debit/credit balance check logic
// ============================================================================
describe('audit-comptable: debit/credit balance check', () => {
  function checkBalanceDebitCredit(entries) {
    const totalDebit = entries.reduce((s, e) => s + num(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + num(e.credit), 0);
    const diff = round2(Math.abs(totalDebit - totalCredit));
    return { pass: diff < 0.01, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit), diff };
  }

  it('passes when debits equal credits', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    const result = checkBalanceDebitCredit(entries);
    expect(result.pass).toBe(true);
    expect(result.diff).toBe(0);
  });

  it('fails when debits and credits are unbalanced', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 50 },
    ];
    const result = checkBalanceDebitCredit(entries);
    expect(result.pass).toBe(false);
    expect(result.diff).toBe(50);
  });

  it('handles empty entries as balanced', () => {
    const result = checkBalanceDebitCredit([]);
    expect(result.pass).toBe(true);
    expect(result.diff).toBe(0);
  });

  it('treats null values as zero', () => {
    const entries = [
      { debit: null, credit: 100 },
      { debit: 100, credit: null },
    ];
    const result = checkBalanceDebitCredit(entries);
    expect(result.pass).toBe(true);
  });

  it('handles rounding correctly for near-zero differences', () => {
    const entries = [
      { debit: 100.005, credit: 0 },
      { debit: 0, credit: 100.004 },
    ];
    const result = checkBalanceDebitCredit(entries);
    // Difference is 0.001, which rounds to 0 at 2 decimals
    expect(result.diff).toBeLessThan(0.01);
    expect(result.pass).toBe(true);
  });
});

// ============================================================================
// Zero entries detection
// ============================================================================
describe('audit-comptable: zero entries detection', () => {
  function detectZeroEntries(entries) {
    return entries.filter((e) => num(e.debit) === 0 && num(e.credit) === 0);
  }

  it('detects entries where both debit and credit are zero', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 0 },
      { debit: 0, credit: 50 },
    ];
    expect(detectZeroEntries(entries)).toHaveLength(1);
  });

  it('returns empty array when no zero entries exist', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 50 },
    ];
    expect(detectZeroEntries(entries)).toHaveLength(0);
  });

  it('handles null values (treated as zero)', () => {
    const entries = [{ debit: null, credit: null }];
    expect(detectZeroEntries(entries)).toHaveLength(1);
  });
});

// ============================================================================
// Suspense accounts detection (47x)
// ============================================================================
describe('audit-comptable: suspense accounts (47x) detection', () => {
  function detectSuspenseAccounts(entries) {
    const suspenseBalances = {};
    for (const e of entries) {
      const code = e.account_code || '';
      if (code.startsWith('47')) {
        suspenseBalances[code] = (suspenseBalances[code] || 0) + num(e.debit) - num(e.credit);
      }
    }
    return Object.entries(suspenseBalances)
      .filter(([_, bal]) => Math.abs(bal) > 0.01)
      .map(([code, bal]) => ({ account_code: code, balance: round2(bal) }));
  }

  it('returns empty when no 47x accounts exist', () => {
    const entries = [{ account_code: '411', debit: 100, credit: 0 }];
    expect(detectSuspenseAccounts(entries)).toHaveLength(0);
  });

  it('detects non-zero balance on suspense account', () => {
    const entries = [{ account_code: '471', debit: 500, credit: 0 }];
    const result = detectSuspenseAccounts(entries);
    expect(result).toHaveLength(1);
    expect(result[0].account_code).toBe('471');
    expect(result[0].balance).toBe(500);
  });

  it('ignores balanced suspense accounts', () => {
    const entries = [
      { account_code: '471', debit: 200, credit: 0 },
      { account_code: '471', debit: 0, credit: 200 },
    ];
    expect(detectSuspenseAccounts(entries)).toHaveLength(0);
  });
});
