import { describe, expect, it } from 'vitest';
import { buildProjectBudgetVsActualInsights } from '@/services/projectBudgetVsActualInsights';

describe('buildProjectBudgetVsActualInsights', () => {
  it('computes budget vs actual profitability variances', () => {
    const project = { budget_hours: 100, hourly_rate: 150 };
    const profitability = {
      totalHours: 80,
      totalRevenue: 14000,
      totalCost: 9000,
      grossMargin: 5000,
    };

    const result = buildProjectBudgetVsActualInsights(project, profitability);

    expect(result.summary.hasBudget).toBe(true);
    expect(result.summary.budgetRevenue).toBe(15000);
    expect(result.summary.actualRevenue).toBe(14000);
    expect(result.summary.revenueVariance).toBe(-1000);
    expect(result.summary.marginVariance).toBeCloseTo(1250, 2);
    expect(result.summary.revenueAttainmentPct).toBeCloseTo(93.3, 1);
    expect(result.summary.status).toBe('at_risk');
  });

  it('returns no_budget status when budget baseline is missing', () => {
    const project = { budget_hours: null, hourly_rate: null };
    const profitability = {
      totalHours: 0,
      totalRevenue: 0,
      totalCost: 0,
      grossMargin: 0,
    };

    const result = buildProjectBudgetVsActualInsights(project, profitability);

    expect(result.summary.hasBudget).toBe(false);
    expect(result.summary.status).toBe('no_budget');
    expect(result.summary.revenueAttainmentPct).toBe(0);
    expect(result.summary.budgetRevenue).toBe(0);
  });
});
