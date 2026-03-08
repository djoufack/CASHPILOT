import { describe, it, expect } from 'vitest';
import {
  filterByPeriod,
  estimateTax,
  DEFAULT_TAX_BRACKETS,
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
    expect(result.totalTax).toBe(4500);
    expect(result.effectiveRate).toBe(0.15);
    expect(result.details).toHaveLength(1);
    expect(result.quarterlyPayment).toBe(1125);
  });

  it('should apply both brackets for income above 42500', () => {
    const result = estimateTax(100000);
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
    expect(result.totalTax).toBe(6375);
    expect(result.details).toHaveLength(1);
  });

  it('should accept custom brackets', () => {
    const customBrackets = [
      { min: 0, max: 10000, rate: 0.10, label: '10%' },
      { min: 10000, max: Infinity, rate: 0.30, label: '30%' },
    ];
    const result = estimateTax(20000, customBrackets);
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
