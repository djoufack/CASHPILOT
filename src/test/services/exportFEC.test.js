import { describe, it, expect, vi } from 'vitest';

// Mock Supabase and document storage to avoid side effects
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  },
}));
vi.mock('@/services/documentStorage', () => ({
  uploadDocument: vi.fn().mockResolvedValue({}),
}));

import {
  generateFECFilename,
  validateEntry,
  checkBalance,
} from '@/services/exportFEC';

// ============================================================================
// generateFECFilename
// ============================================================================
describe('generateFECFilename', () => {
  it('should generate filename with SIREN and date', () => {
    const result = generateFECFilename('123456789', new Date(2026, 11, 31));
    expect(result).toBe('123456789FEC20261231.txt');
  });

  it('should handle string date', () => {
    const result = generateFECFilename('999888777', '2026-06-30');
    expect(result).toBe('999888777FEC20260630.txt');
  });

  it('should handle missing date', () => {
    const result = generateFECFilename('123456789', null);
    expect(result).toBe('123456789FEC.txt');
  });
});

// ============================================================================
// validateEntry
// ============================================================================
describe('validateEntry', () => {
  it('should validate a correct entry', () => {
    const entry = {
      transaction_date: '2026-01-15',
      account_code: '601000',
      debit: 100,
      credit: 0,
    };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report missing transaction_date', () => {
    const entry = { account_code: '601000', debit: 100 };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date transaction manquante');
  });

  it('should report missing account_code', () => {
    const entry = { transaction_date: '2026-01-15', debit: 100 };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Numero de compte manquant');
  });

  it('should report missing debit and credit', () => {
    const entry = { transaction_date: '2026-01-15', account_code: '601000' };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Montant debit ou credit requis');
  });

  it('should report both debit and credit present', () => {
    const entry = {
      transaction_date: '2026-01-15',
      account_code: '601000',
      debit: 100,
      credit: 50,
    };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('debit ET credit'))).toBe(true);
  });

  it('should accept entry with only credit', () => {
    const entry = {
      transaction_date: '2026-01-15',
      account_code: '401000',
      debit: 0,
      credit: 100,
    };
    const result = validateEntry(entry);
    expect(result.isValid).toBe(true);
  });

  it('should allow zero debit with positive credit', () => {
    const entry = {
      transaction_date: '2026-01-15',
      account_code: '701000',
      debit: 0,
      credit: 500,
    };
    expect(validateEntry(entry).isValid).toBe(true);
  });

  it('should accumulate multiple errors', () => {
    const entry = {}; // Missing everything
    const result = validateEntry(entry);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// checkBalance
// ============================================================================
describe('checkBalance', () => {
  it('should detect balanced entries', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    const result = checkBalance(entries);
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(100);
    expect(result.difference).toBeLessThan(0.01);
  });

  it('should detect unbalanced entries', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 80 },
    ];
    const result = checkBalance(entries);
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(20);
  });

  it('should handle entries with missing amounts', () => {
    const entries = [
      { debit: 50 },
      { credit: 50 },
    ];
    const result = checkBalance(entries);
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(50);
    expect(result.totalCredit).toBe(50);
  });

  it('should handle empty entries array', () => {
    const result = checkBalance([]);
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
  });

  it('should handle rounding tolerance', () => {
    const entries = [
      { debit: 33.33, credit: 0 },
      { debit: 33.33, credit: 0 },
      { debit: 33.34, credit: 0 },
      { debit: 0, credit: 100 },
    ];
    const result = checkBalance(entries);
    expect(result.balanced).toBe(true);
  });

  it('should compute correct totals for multiple entries', () => {
    const entries = [
      { debit: 1000, credit: 0 },
      { debit: 500, credit: 0 },
      { debit: 0, credit: 750 },
      { debit: 0, credit: 750 },
    ];
    const result = checkBalance(entries);
    expect(result.totalDebit).toBe(1500);
    expect(result.totalCredit).toBe(1500);
    expect(result.balanced).toBe(true);
  });
});
