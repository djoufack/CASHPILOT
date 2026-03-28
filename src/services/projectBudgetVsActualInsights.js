const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const clampPct = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value > 999) return 999;
  if (value < -999) return -999;
  return value;
};

export function buildProjectBudgetVsActualInsights(project, profitability) {
  const budgetHours = toNumber(project?.budget_hours);
  const hourlyRate = toNumber(project?.hourly_rate);

  const totalHours = toNumber(profitability?.totalHours);
  const totalRevenue = toNumber(profitability?.totalRevenue);
  const totalCost = toNumber(profitability?.totalCost);
  const grossMargin = toNumber(profitability?.grossMargin);

  const budgetRevenue = budgetHours > 0 && hourlyRate > 0 ? budgetHours * hourlyRate : 0;
  const actualCostPerHour = totalHours > 0 ? totalCost / totalHours : 0;
  const budgetCost = budgetHours > 0 && actualCostPerHour > 0 ? budgetHours * actualCostPerHour : 0;
  const budgetMargin = budgetRevenue - budgetCost;

  const revenueVariance = totalRevenue - budgetRevenue;
  const costVariance = totalCost - budgetCost;
  const marginVariance = grossMargin - budgetMargin;
  const hoursVariance = totalHours - budgetHours;

  const revenueAttainmentPct = budgetRevenue > 0 ? (totalRevenue / budgetRevenue) * 100 : 0;
  const budgetMarginPct = budgetRevenue > 0 ? (budgetMargin / budgetRevenue) * 100 : 0;
  const actualMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
  const marginGapPct = actualMarginPct - budgetMarginPct;

  const hasBudget = budgetHours > 0 && hourlyRate > 0;

  const status = !hasBudget
    ? 'no_budget'
    : revenueAttainmentPct >= 95 && marginGapPct >= -3
      ? 'on_track'
      : revenueAttainmentPct >= 80 && marginGapPct >= -10
        ? 'at_risk'
        : 'critical';

  return {
    summary: {
      hasBudget,
      status,
      budgetHours: round(budgetHours, 1),
      hourlyRate: round(hourlyRate, 2),
      budgetRevenue: round(budgetRevenue, 2),
      budgetCost: round(budgetCost, 2),
      budgetMargin: round(budgetMargin, 2),
      actualRevenue: round(totalRevenue, 2),
      actualCost: round(totalCost, 2),
      actualMargin: round(grossMargin, 2),
      revenueVariance: round(revenueVariance, 2),
      costVariance: round(costVariance, 2),
      marginVariance: round(marginVariance, 2),
      hoursVariance: round(hoursVariance, 1),
      revenueAttainmentPct: round(clampPct(revenueAttainmentPct), 1),
      budgetMarginPct: round(clampPct(budgetMarginPct), 1),
      actualMarginPct: round(clampPct(actualMarginPct), 1),
      marginGapPct: round(clampPct(marginGapPct), 1),
    },
  };
}
