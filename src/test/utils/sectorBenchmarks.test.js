import { describe, it, expect, vi } from 'vitest';

// Mock the referenceDataService to provide test data
vi.mock('@/services/referenceDataService', () => ({
  getSectorBenchmarksMetadata: vi.fn((sector) => {
    const benchmarks = {
      b2b_services: {
        currentRatio: { low: 1.2, target: 1.8, high: 2.5 },
        profitMargin: { low: 5, target: 12, high: 20 },
        debtToEquity: { low: 0.3, target: 0.8, high: 1.5 },
      },
      retail: {
        currentRatio: { low: 1.0, target: 1.5, high: 2.0 },
      },
    };
    return benchmarks[sector] || benchmarks.b2b_services;
  }),
  getSectorMultiplesMetadata: vi.fn((sector, region) => {
    return { low: 3, mid: 5, high: 8 };
  }),
  getRegionWaccMetadata: vi.fn((region) => {
    const data = {
      france: { riskFree: 0.03, premium: 0.06, beta: 1.0, wacc: 0.08 },
      usa: { riskFree: 0.04, premium: 0.05, beta: 1.1, wacc: 0.09 },
    };
    return data[region] || data.france;
  }),
}));

import {
  getSectorBenchmarks,
  getSectorMultiples,
  getWACCData,
  evaluateRatio,
} from '@/utils/sectorBenchmarks';

// ============================================================================
// getSectorBenchmarks
// ============================================================================
describe('getSectorBenchmarks', () => {
  it('should return benchmarks for known sector', () => {
    const result = getSectorBenchmarks('b2b_services');
    expect(result).toBeDefined();
    expect(result.currentRatio).toBeDefined();
    expect(result.profitMargin).toBeDefined();
  });

  it('should fall back for unknown sector', () => {
    const result = getSectorBenchmarks('unknown_sector');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// getSectorMultiples
// ============================================================================
describe('getSectorMultiples', () => {
  it('should return multiples for a sector and region', () => {
    const result = getSectorMultiples('b2b_services', 'france');
    expect(result).toBeDefined();
    expect(result.low).toBeDefined();
    expect(result.mid).toBeDefined();
    expect(result.high).toBeDefined();
  });
});

// ============================================================================
// getWACCData
// ============================================================================
describe('getWACCData', () => {
  it('should return WACC data for known region', () => {
    const result = getWACCData('france');
    expect(result.riskFree).toBe(0.03);
    expect(result.premium).toBe(0.06);
    expect(result.wacc).toBe(0.08);
  });

  it('should return fallback for unknown region', () => {
    const result = getWACCData('unknown');
    expect(result).toBeDefined();
    expect(result.wacc).toBeDefined();
  });
});

// ============================================================================
// evaluateRatio
// ============================================================================
describe('evaluateRatio', () => {
  const benchmark = { low: 1.0, target: 1.5, high: 2.0 };

  it('should return excellent for value >= high', () => {
    expect(evaluateRatio(2.5, benchmark)).toBe('excellent');
    expect(evaluateRatio(2.0, benchmark)).toBe('excellent');
  });

  it('should return good for value >= target but < high', () => {
    expect(evaluateRatio(1.7, benchmark)).toBe('good');
    expect(evaluateRatio(1.5, benchmark)).toBe('good');
  });

  it('should return average for value >= low but < target', () => {
    expect(evaluateRatio(1.2, benchmark)).toBe('average');
    expect(evaluateRatio(1.0, benchmark)).toBe('average');
  });

  it('should return poor for value >= low * 0.5 but < low', () => {
    expect(evaluateRatio(0.7, benchmark)).toBe('poor');
    expect(evaluateRatio(0.5, benchmark)).toBe('poor');
  });

  it('should return critical for value < low * 0.5', () => {
    expect(evaluateRatio(0.1, benchmark)).toBe('critical');
  });

  it('should return null for null benchmark', () => {
    expect(evaluateRatio(1.5, null)).toBeNull();
  });

  it('should return null for null value', () => {
    expect(evaluateRatio(null, benchmark)).toBeNull();
  });

  // Inverse mode (lower is better)
  it('should return excellent for inverse when value <= low', () => {
    expect(evaluateRatio(0.5, benchmark, true)).toBe('excellent');
    expect(evaluateRatio(1.0, benchmark, true)).toBe('excellent');
  });

  it('should return good for inverse when value <= target', () => {
    expect(evaluateRatio(1.3, benchmark, true)).toBe('good');
  });

  it('should return average for inverse when value <= high', () => {
    expect(evaluateRatio(1.8, benchmark, true)).toBe('average');
  });

  it('should return poor for inverse when value <= high * 1.5', () => {
    expect(evaluateRatio(2.5, benchmark, true)).toBe('poor');
  });

  it('should return critical for inverse when value > high * 1.5', () => {
    expect(evaluateRatio(5.0, benchmark, true)).toBe('critical');
  });
});
