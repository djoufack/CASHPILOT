import { describe, expect, it } from 'vitest';

import {
  computeSupplierGlobalScore,
  getSupplierScoreBand,
  normalizeSupplierScore,
} from '@/services/supplierPerformanceScore';

describe('supplierPerformanceScore', () => {
  it('normalizes score in 0..100 range', () => {
    expect(normalizeSupplierScore(105)).toBe(100);
    expect(normalizeSupplierScore(-2)).toBe(0);
    expect(normalizeSupplierScore('87.5')).toBe(87.5);
    expect(normalizeSupplierScore(null)).toBe(0);
  });

  it('computes weighted global score (quality 40 / delivery 30 / cost 30)', () => {
    expect(
      computeSupplierGlobalScore({
        qualityScore: 90,
        deliveryScore: 80,
        costScore: 70,
      })
    ).toBe(81);
  });

  it('returns score bands', () => {
    expect(getSupplierScoreBand(92)).toBe('A');
    expect(getSupplierScoreBand(82)).toBe('B');
    expect(getSupplierScoreBand(72)).toBe('C');
    expect(getSupplierScoreBand(62)).toBe('D');
    expect(getSupplierScoreBand(30)).toBe('E');
  });
});
