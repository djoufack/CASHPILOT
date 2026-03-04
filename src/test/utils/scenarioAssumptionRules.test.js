import { describe, expect, it } from 'vitest';
import {
  getAllowedScenarioTypes,
  isScenarioAssumptionCompatible,
  sanitizeScenarioAssumptions,
} from '@/utils/scenarioAssumptionRules';

describe('scenarioAssumptionRules', () => {
  it('returns the allowed types for a category', () => {
    expect(getAllowedScenarioTypes('payment_terms')).toEqual(['payment_terms']);
    expect(getAllowedScenarioTypes('investment')).toEqual(['one_time']);
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
});
