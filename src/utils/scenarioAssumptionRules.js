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

export function getDefaultScenarioType(category) {
  return getAllowedScenarioTypes(category)[0] || '';
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

export function normalizeScenarioAssumption(assumption) {
  if (!assumption) {
    return {
      name: '',
      description: '',
      category: '',
      assumption_type: '',
      parameters: {},
      start_date: '',
      end_date: '',
      wasNormalized: false,
    };
  }

  const nextCategory = assumption.category || '';
  const isCompatible = isScenarioAssumptionCompatible(assumption);
  const nextType = isCompatible
    ? assumption.assumption_type
    : getDefaultScenarioType(nextCategory);

  let nextParameters = { ...(assumption.parameters || {}) };

  if (!isCompatible) {
    if (nextType === 'payment_terms') {
      nextParameters = {
        customer_days: Number.isFinite(Number(nextParameters.customer_days))
          ? Number(nextParameters.customer_days)
          : 45,
        supplier_days: Number.isFinite(Number(nextParameters.supplier_days))
          ? Number(nextParameters.supplier_days)
          : 30,
      };
    } else if (nextType === 'growth_rate' || nextType === 'percentage_change') {
      nextParameters = {
        rate: Number.isFinite(Number(nextParameters.rate))
          ? Number(nextParameters.rate)
          : 5,
      };
    } else if (nextType === 'one_time') {
      nextParameters = {
        amount: Number.isFinite(Number(nextParameters.amount))
          ? Number(nextParameters.amount)
          : 0,
        date: nextParameters.date || assumption.start_date || '',
      };
    } else {
      nextParameters = {
        amount: Number.isFinite(Number(nextParameters.amount))
          ? Number(nextParameters.amount)
          : 0,
      };
    }
  }

  return {
    ...assumption,
    category: nextCategory,
    assumption_type: nextType,
    parameters: nextParameters,
    description: assumption.description || '',
    start_date: assumption.start_date || '',
    end_date: assumption.end_date || '',
    wasNormalized: !isCompatible,
  };
}
