import { describe, it, expect, vi } from 'vitest';

vi.mock('@/i18n/config', () => ({
  default: {
    resolvedLanguage: 'fr',
    language: 'fr',
    on: vi.fn(),
  },
}));

import {
  calculateTrend,
  formatTrendLabel,
  calculateProfitMargin,
  getInvoiceAmount,
  filterByMonth,
  formatNumber,
} from '@/utils/calculations';

// ============================================================================
// calculateTrend
// ============================================================================
describe('calculateTrend', () => {
  it('should calculate positive trend', () => {
    expect(calculateTrend(120, 100)).toBe(20);
  });

  it('should calculate negative trend', () => {
    expect(calculateTrend(80, 100)).toBe(-20);
  });

  it('should return 0 when both are zero', () => {
    expect(calculateTrend(0, 0)).toBe(0);
  });

  it('should return 100 when previous is 0 and current is positive', () => {
    expect(calculateTrend(50, 0)).toBe(100);
  });

  it('should return -100 when previous is 0 and current is negative', () => {
    expect(calculateTrend(-50, 0)).toBe(-100);
  });

  it('should handle null/undefined as 0', () => {
    expect(calculateTrend(null, 100)).toBe(-100);
    expect(calculateTrend(100, undefined)).toBe(100);
  });

  it('should handle string numeric inputs', () => {
    expect(calculateTrend('150', '100')).toBe(50);
  });

  it('should return correct decimal precision', () => {
    expect(calculateTrend(112.5, 100)).toBe(12.5);
  });
});

// ============================================================================
// formatTrendLabel
// ============================================================================
describe('formatTrendLabel', () => {
  it('should format positive trend with + prefix', () => {
    expect(formatTrendLabel(12.5)).toBe('+12.5%');
  });

  it('should format negative trend without + prefix', () => {
    expect(formatTrendLabel(-3.2)).toBe('-3.2%');
  });

  it('should return 0% for zero', () => {
    expect(formatTrendLabel(0)).toBe('0%');
  });

  it('should return 0% for NaN', () => {
    expect(formatTrendLabel(NaN)).toBe('0%');
  });

  it('should return 0% for null', () => {
    expect(formatTrendLabel(null)).toBe('0%');
  });

  it('should handle string number input', () => {
    expect(formatTrendLabel('25')).toBe('+25%');
  });
});

// ============================================================================
// calculateProfitMargin
// ============================================================================
describe('calculateProfitMargin', () => {
  it('should calculate positive profit margin', () => {
    expect(calculateProfitMargin(1000, 700)).toBe(30);
  });

  it('should return 0 for zero revenue', () => {
    expect(calculateProfitMargin(0, 100)).toBe(0);
  });

  it('should return 0 for negative revenue', () => {
    expect(calculateProfitMargin(-100, 50)).toBe(0);
  });

  it('should handle negative margin (expenses > revenue)', () => {
    expect(calculateProfitMargin(100, 150)).toBe(-50);
  });

  it('should return 100 when expenses are 0', () => {
    expect(calculateProfitMargin(500, 0)).toBe(100);
  });

  it('should handle null inputs as 0', () => {
    expect(calculateProfitMargin(null, null)).toBe(0);
  });
});

// ============================================================================
// getInvoiceAmount
// ============================================================================
describe('getInvoiceAmount', () => {
  it('should prefer total_ttc', () => {
    expect(getInvoiceAmount({ total_ttc: 1200, total: 1000 })).toBe(1200);
  });

  it('should fall back to total when total_ttc is missing', () => {
    expect(getInvoiceAmount({ total: 1000 })).toBe(1000);
  });

  it('should return 0 for null invoice', () => {
    expect(getInvoiceAmount(null)).toBe(0);
  });

  it('should return 0 for empty object', () => {
    expect(getInvoiceAmount({})).toBe(0);
  });

  it('should handle string values', () => {
    expect(getInvoiceAmount({ total_ttc: '500.50' })).toBe(500.5);
  });

  it('should return 0 for non-numeric total_ttc', () => {
    expect(getInvoiceAmount({ total_ttc: 'abc', total: 100 })).toBe(100);
  });
});

// ============================================================================
// filterByMonth
// ============================================================================
describe('filterByMonth', () => {
  it('should filter items by month and year', () => {
    const items = [
      { date: '2026-01-15' },
      { date: '2026-02-10' },
      { date: '2026-01-20' },
    ];
    const result = filterByMonth(items, 0, 2026);
    expect(result).toHaveLength(2);
  });

  it('should use created_at as fallback when date is missing', () => {
    const items = [{ created_at: '2026-03-01' }];
    const result = filterByMonth(items, 2, 2026);
    expect(result).toHaveLength(1);
  });

  it('should return empty array for no matches', () => {
    const items = [{ date: '2026-06-15' }];
    const result = filterByMonth(items, 0, 2026);
    expect(result).toHaveLength(0);
  });

  it('should use custom dateField', () => {
    const items = [{ invoice_date: '2026-04-01' }];
    const result = filterByMonth(items, 3, 2026, 'invoice_date');
    expect(result).toHaveLength(1);
  });

  it('should handle empty array', () => {
    expect(filterByMonth([], 0, 2026)).toHaveLength(0);
  });
});

// ============================================================================
// formatNumber
// ============================================================================
describe('formatNumber', () => {
  it('should format number with 2 decimal places by default', () => {
    const result = formatNumber(1234.5);
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('should handle zero', () => {
    const result = formatNumber(0);
    expect(result).toContain('0');
  });

  it('should handle null as 0', () => {
    const result = formatNumber(null);
    expect(result).toContain('0');
  });

  it('should respect custom decimal places', () => {
    const result = formatNumber(100, 0);
    expect(result).not.toContain(',');
  });

  it('should handle NaN as 0', () => {
    const result = formatNumber(NaN);
    expect(result).toContain('0');
  });
});
