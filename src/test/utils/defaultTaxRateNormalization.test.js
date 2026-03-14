import { describe, it, expect } from 'vitest';
import { normalizeTaxRatePercent } from '@/hooks/useDefaultTaxRate';

describe('normalizeTaxRatePercent', () => {
  it('converts decimal DB rates to percentage values', () => {
    expect(normalizeTaxRatePercent(0.2)).toBe(20);
    expect(normalizeTaxRatePercent(0.055)).toBe(5.5);
  });

  it('keeps percentage values as-is', () => {
    expect(normalizeTaxRatePercent(20)).toBe(20);
    expect(normalizeTaxRatePercent(5.5)).toBe(5.5);
  });

  it('returns 0 for non-numeric values', () => {
    expect(normalizeTaxRatePercent(undefined)).toBe(0);
    expect(normalizeTaxRatePercent('')).toBe(0);
    expect(normalizeTaxRatePercent(null)).toBe(0);
  });
});
