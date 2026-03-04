export const SCENARIO_ALLOWED_TYPES_BY_CATEGORY = {
  revenue: ['growth_rate', 'fixed_amount', 'recurring', 'one_time', 'percentage_change'],
  expense: ['fixed_amount', 'recurring', 'one_time', 'percentage_change'],
  salaries: ['fixed_amount', 'recurring', 'one_time', 'percentage_change'],
  social_charges: ['fixed_amount', 'recurring', 'one_time', 'percentage_change'],
  investment: ['one_time'],
  equipment: ['one_time'],
  pricing: ['growth_rate', 'fixed_amount', 'percentage_change'],
  expense_reduction: ['fixed_amount', 'recurring', 'percentage_change'],
  payment_terms: ['payment_terms'],
  working_capital: ['fixed_amount', 'recurring', 'one_time', 'percentage_change'],
};

export function getAllowedScenarioTypes(category) {
  return SCENARIO_ALLOWED_TYPES_BY_CATEGORY[category] || [];
}

export function isScenarioAssumptionCompatible(assumption) {
  if (!assumption?.category || !assumption?.assumption_type) {
    return false;
  }

  return getAllowedScenarioTypes(assumption.category).includes(assumption.assumption_type);
}

export function sanitizeScenarioAssumptions(assumptions = []) {
  return assumptions.reduce(
    (accumulator, assumption) => {
      if (isScenarioAssumptionCompatible(assumption)) {
        accumulator.validAssumptions.push(assumption);
      } else {
        accumulator.invalidAssumptions.push(assumption);
      }

      return accumulator;
    },
    {
      validAssumptions: [],
      invalidAssumptions: [],
    }
  );
}
