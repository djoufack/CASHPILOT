import { describe, expect, it } from 'vitest';
import { FinancialSimulationEngine } from '@/utils/scenarioSimulationEngine';

const baseScenario = {
  base_date: '2026-01-01',
  end_date: '2026-03-01',
};

const baseFinancialState = {
  revenue: 120000,
  expenses: 60000,
  fixedExpenses: 36000,
  variableExpenses: 18000,
  salaries: 6000,
  cash: 10000,
  receivables: 5000,
  payables: 3000,
  inventory: 2000,
  fixedAssets: 12000,
  equity: 20000,
  debt: 5000,
  bfr: 4000,
  avgPrice: 100,
  volume: 1200,
};

describe('FinancialSimulationEngine', () => {
  it('compounds revenue growth month over month', async () => {
    const engine = new FinancialSimulationEngine();
    const results = await engine.simulateScenario(
      baseScenario,
      [
        {
          assumption_type: 'growth_rate',
          category: 'revenue',
          parameters: { rate: 10 },
          start_date: '2026-01-01',
          end_date: '2026-03-01',
        },
      ],
      baseFinancialState
    );

    expect(results).toHaveLength(3);
    expect(results[1].revenue).toBeGreaterThan(results[0].revenue);
    expect(results[2].revenue).toBeGreaterThan(results[1].revenue);
  });

  it('applies fixed monthly revenue and recurring expenses without cumulative drift', async () => {
    const engine = new FinancialSimulationEngine();
    const results = await engine.simulateScenario(
      baseScenario,
      [
        {
          assumption_type: 'fixed_amount',
          category: 'revenue',
          parameters: { amount: 15000 },
          start_date: '2026-01-01',
          end_date: '2026-03-01',
        },
        {
          assumption_type: 'recurring',
          category: 'expense',
          parameters: { amount: 2000 },
          start_date: '2026-01-01',
          end_date: '2026-03-01',
        },
      ],
      baseFinancialState
    );

    expect(results[0].revenue).toBe(15000);
    expect(results[0].expenses).toBeGreaterThan(7000);
    expect(results[1].expenses).toBeCloseTo(results[0].expenses, 5);
    expect(results[2].expenses).toBeCloseTo(results[1].expenses, 5);
  });

  it('keeps one-time investments on the balance sheet after the investment month', async () => {
    const engine = new FinancialSimulationEngine();
    const results = await engine.simulateScenario(
      baseScenario,
      [
        {
          assumption_type: 'one_time',
          category: 'investment',
          parameters: { amount: 12000, date: '2026-02-15' },
          start_date: '2026-01-01',
          end_date: '2026-03-01',
        },
      ],
      baseFinancialState
    );

    expect(results[1].fixedAssets).toBeGreaterThan(results[0].fixedAssets);
    expect(results[2].fixedAssets).toBeLessThan(results[1].fixedAssets);
  });
});
