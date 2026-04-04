import { describe, expect, it } from 'vitest';
import {
  getDefaultScenarioType,
  getAllowedScenarioTypes,
  isScenarioAssumptionCompatible,
  normalizeScenarioAssumption,
  sanitizeScenarioAssumptions,
} from '@/utils/scenarioAssumptionRules';

describe('scenarioAssumptionRules', () => {
  it('returns the allowed types for a category', () => {
    expect(getAllowedScenarioTypes('payment_terms')).toEqual(['payment_terms']);
    expect(getAllowedScenarioTypes('investment')).toEqual(['one_time']);
    expect(getAllowedScenarioTypes('unknown')).toEqual([]);
    expect(getDefaultScenarioType('unknown')).toBe('');
  });

  it('rejects incompatible legacy assumptions', () => {
    expect(
      isScenarioAssumptionCompatible({
        category: 'payment_terms',
        assumption_type: 'fixed_amount',
      })
    ).toBe(false);
  });

  it('separates valid and invalid assumptions', () => {
    const { validAssumptions, invalidAssumptions } = sanitizeScenarioAssumptions([
      {
        category: 'revenue',
        assumption_type: 'growth_rate',
      },
      {
        category: 'payment_terms',
        assumption_type: 'fixed_amount',
      },
    ]);

    expect(validAssumptions).toHaveLength(1);
    expect(invalidAssumptions).toHaveLength(1);
  });

  it('normalizes null assumptions to a safe default payload', () => {
    expect(normalizeScenarioAssumption(null)).toEqual({
      name: '',
      description: '',
      category: '',
      assumption_type: '',
      parameters: {},
      start_date: '',
      end_date: '',
      wasNormalized: false,
    });
  });

  it('normalizes incompatible payment terms assumptions', () => {
    const result = normalizeScenarioAssumption({
      category: 'payment_terms',
      assumption_type: 'fixed_amount',
      parameters: { customer_days: 'foo' },
      start_date: '2026-01-01',
    });

    expect(result.assumption_type).toBe('payment_terms');
    expect(result.parameters).toEqual({
      customer_days: 45,
      supplier_days: 30,
    });
    expect(result.wasNormalized).toBe(true);
  });

  it('normalizes growth-rate and amount-based assumptions', () => {
    const growth = normalizeScenarioAssumption({
      category: 'pricing',
      assumption_type: 'one_time',
      parameters: {},
    });
    expect(growth.assumption_type).toBe('growth_rate');
    expect(growth.parameters).toEqual({ rate: 5 });

    const fixed = normalizeScenarioAssumption({
      category: 'expense',
      assumption_type: 'growth_rate',
      parameters: { amount: '12.5' },
      description: null,
    });
    expect(fixed.assumption_type).toBe('fixed_amount');
    expect(fixed.parameters).toEqual({ amount: 12.5 });
    expect(fixed.description).toBe('');
  });

  it('normalizes one-time assumptions with fallback date and keeps compatible assumptions intact', () => {
    const oneTime = normalizeScenarioAssumption({
      category: 'equipment',
      assumption_type: 'fixed_amount',
      parameters: { amount: 'x' },
      start_date: '2026-06-01',
    });
    expect(oneTime.assumption_type).toBe('one_time');
    expect(oneTime.parameters).toEqual({
      amount: 0,
      date: '2026-06-01',
    });
    expect(oneTime.wasNormalized).toBe(true);

    const compatible = normalizeScenarioAssumption({
      category: 'revenue',
      assumption_type: 'growth_rate',
      parameters: { rate: 7.5 },
      description: 'ok',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
    });
    expect(compatible.wasNormalized).toBe(false);
    expect(compatible.assumption_type).toBe('growth_rate');
    expect(compatible.parameters).toEqual({ rate: 7.5 });
  });
});
