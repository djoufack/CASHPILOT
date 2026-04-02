import { describe, it, expect } from 'vitest';
import {
  parseFrenchDate,
  parseFrenchAmount,
  getBankStatementPreview,
} from '@/utils/bankStatementParser';

// ============================================================================
// parseFrenchDate
// ============================================================================
describe('parseFrenchDate', () => {
  it('should parse DD/MM/YYYY format', () => {
    expect(parseFrenchDate('15/01/2026')).toBe('2026-01-15');
  });

  it('should parse DD-MM-YYYY format', () => {
    expect(parseFrenchDate('15-01-2026')).toBe('2026-01-15');
  });

  it('should parse DD.MM.YYYY format', () => {
    expect(parseFrenchDate('15.01.2026')).toBe('2026-01-15');
  });

  it('should parse DD/MM/YY format (20xx)', () => {
    expect(parseFrenchDate('15/01/26')).toBe('2026-01-15');
  });

  it('should parse DD/MM/YY format (19xx for year > 50)', () => {
    expect(parseFrenchDate('15/01/99')).toBe('1999-01-15');
  });

  it('should return ISO date as-is', () => {
    expect(parseFrenchDate('2026-01-15')).toBe('2026-01-15');
  });

  it('should parse Excel numeric date', () => {
    // 44927 = 2023-01-01 in Excel serial format
    const result = parseFrenchDate('44927');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return null for empty string', () => {
    expect(parseFrenchDate('')).toBeNull();
  });

  it('should return null for null', () => {
    expect(parseFrenchDate(null)).toBeNull();
  });

  it('should return null for unparseable string', () => {
    expect(parseFrenchDate('not a date')).toBeNull();
  });

  it('should reject invalid day/month ranges', () => {
    expect(parseFrenchDate('32/13/2026')).toBeNull();
  });

  it('should handle whitespace in input', () => {
    expect(parseFrenchDate(' 15/01/2026 ')).toBe('2026-01-15');
  });
});

// ============================================================================
// parseFrenchAmount
// ============================================================================
describe('parseFrenchAmount', () => {
  it('should parse French format with comma decimal', () => {
    expect(parseFrenchAmount('1 234,56')).toBe(1234.56);
  });

  it('should parse European format with dot thousands and comma decimal', () => {
    expect(parseFrenchAmount('1.234,56')).toBe(1234.56);
  });

  it('should parse US format with comma thousands and dot decimal', () => {
    expect(parseFrenchAmount('1,234.56')).toBe(1234.56);
  });

  it('should parse simple number', () => {
    expect(parseFrenchAmount('100')).toBe(100);
  });

  it('should handle negative amounts', () => {
    expect(parseFrenchAmount('-500,00')).toBe(-500);
  });

  it('should strip currency symbols', () => {
    expect(parseFrenchAmount('100,50€')).toBe(100.5);
    expect(parseFrenchAmount('$50.00')).toBe(50);
    expect(parseFrenchAmount('£75,25')).toBe(75.25);
  });

  it('should return numeric input as-is', () => {
    expect(parseFrenchAmount(42.5)).toBe(42.5);
  });

  it('should return null for NaN number input', () => {
    expect(parseFrenchAmount(NaN)).toBeNull();
  });

  it('should return null for null', () => {
    expect(parseFrenchAmount(null)).toBeNull();
  });

  it('should return null for undefined', () => {
    expect(parseFrenchAmount(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseFrenchAmount('')).toBeNull();
  });

  it('should handle zero', () => {
    expect(parseFrenchAmount('0,00')).toBe(0);
  });

  it('should handle amount with spaces only as thousands separator', () => {
    expect(parseFrenchAmount('10 000,00')).toBe(10000);
  });
});

// ============================================================================
// getBankStatementPreview
// ============================================================================
describe('getBankStatementPreview', () => {
  it('should return preview with summary stats', () => {
    const parsed = {
      lines: [
        { amount: 1000, date: '2026-01-15' },
        { amount: -500, date: '2026-01-16' },
        { amount: 200, date: '2026-01-17' },
      ],
      errors: [],
      metadata: { bankName: 'Test Bank' },
    };

    const preview = getBankStatementPreview(parsed, 2);
    expect(preview.previewLines).toHaveLength(2);
    expect(preview.totalLines).toBe(3);
    expect(preview.totalCredits).toBe(1200);
    expect(preview.totalDebits).toBe(-500);
    expect(preview.netAmount).toBe(700);
    expect(preview.hasMore).toBe(true);
  });

  it('should handle empty lines', () => {
    const parsed = { lines: [], errors: [], metadata: {} };
    const preview = getBankStatementPreview(parsed);
    expect(preview.totalLines).toBe(0);
    expect(preview.totalCredits).toBe(0);
    expect(preview.totalDebits).toBe(0);
    expect(preview.netAmount).toBe(0);
    expect(preview.hasMore).toBe(false);
  });

  it('should limit errors to 10', () => {
    const errors = Array.from({ length: 15 }, (_, i) => ({ line: i, message: `Error ${i}` }));
    const parsed = { lines: [], errors, metadata: {} };
    const preview = getBankStatementPreview(parsed);
    expect(preview.errors.length).toBeLessThanOrEqual(10);
    expect(preview.errorCount).toBe(15);
  });

  it('should default to 15 preview rows', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      amount: 100,
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }));
    const parsed = { lines, errors: [], metadata: {} };
    const preview = getBankStatementPreview(parsed);
    expect(preview.previewLines).toHaveLength(15);
  });
});
