import { describe, expect, it } from 'vitest';
import FinancialSimulationEngine from '@/utils/scenarioSimulationEngine';

const buildState = () => ({
  revenue: 120000,
  expenses: 72000,
  fixedExpenses: 36000,
  variableExpenses: 24000,
  salaries: 12000,
  avgPrice: 100,
  volume: 1200,
  cash: 50000,
  receivables: 10000,
  payables: 8000,
  inventory: 6000,
  fixedAssets: 40000,
  equity: 70000,
  debt: 15000,
  bfr: 12000,
});

const baseScenario = {
  base_date: '2026-01-01',
  end_date: '2026-03-31',
};

describe('FinancialSimulationEngine', () => {
  it('simulates monthly outputs with valid assumptions', async () => {
    const engine = new FinancialSimulationEngine();
    const results = await engine.simulateScenario(
      baseScenario,
      [
        { category: 'revenue', assumption_type: 'growth_rate', parameters: { rate: 5 } },
        { category: 'pricing', assumption_type: 'percentage_change', parameters: { rate: 2 } },
        {
          category: 'working_capital',
          assumption_type: 'payment_terms',
          parameters: { customer_days: 60, supplier_days: 45 },
        },
        {
          category: 'investment',
          assumption_type: 'one_time',
          start_date: '2026-02-01',
          parameters: { date: '2026-02-01', amount: 5000 },
        },
      ],
      buildState()
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      revenue: expect.any(Number),
      netIncome: expect.any(Number),
      cashBalance: expect.any(Number),
      customerPaymentDays: expect.any(Number),
      supplierPaymentDays: expect.any(Number),
    });
  });

  it('throws when required simulation inputs are missing', async () => {
    const engine = new FinancialSimulationEngine();
    await expect(engine.simulateScenario(null, [], buildState())).rejects.toThrow();
    await expect(engine.simulateScenario(baseScenario, [], null)).rejects.toThrow();
  });

  it('applies rate assumptions for all categories', () => {
    const engine = new FinancialSimulationEngine();
    const state = engine.initializeState(buildState());
    const baseline = {
      revenue: state.monthlyRevenue,
      fixed: state.monthlyFixedExpenses,
      salary: state.monthlySalaries,
      price: state.avgPrice,
      bfrAdj: state.bfrManualAdjustment,
    };

    engine.applyRateToCategory(state, 'pricing', 10);
    engine.applyRateToCategory(state, 'expense_reduction', 10);
    engine.applyRateToCategory(state, 'expense', 10);
    engine.applyRateToCategory(state, 'social_charges', 10);
    engine.applyRateToCategory(state, 'salaries', 10);
    engine.applyRateToCategory(state, 'working_capital', 10);
    engine.applyRateToCategory(state, 'revenue', 10);

    expect(state.avgPrice).toBeGreaterThan(baseline.price);
    expect(state.monthlyFixedExpenses).toBeGreaterThan(0);
    expect(state.monthlySalaries).toBeGreaterThan(baseline.salary);
    expect(state.bfrManualAdjustment).toBeGreaterThan(baseline.bfrAdj);
    expect(state.monthlyRevenue).toBeGreaterThan(0);
    expect(state.monthlyRevenue).not.toBe(baseline.revenue);
    expect(state.monthlyFixedExpenses).not.toBe(baseline.fixed);
  });

  it('applies amount assumptions for set and add modes', () => {
    const engine = new FinancialSimulationEngine();
    const state = engine.initializeState(buildState());

    engine.applyAmountToCategory(state, 'pricing', 200, 'set');
    engine.applyAmountToCategory(state, 'pricing', 1000, 'add');
    engine.applyAmountToCategory(state, 'expense_reduction', 200, 'set');
    engine.applyAmountToCategory(state, 'expense', 500, 'set');
    engine.applyAmountToCategory(state, 'expense', 100, 'add');
    engine.applyAmountToCategory(state, 'social_charges', 100, 'add');
    engine.applyAmountToCategory(state, 'salaries', 400, 'set');
    engine.applyAmountToCategory(state, 'salaries', 50, 'add');
    engine.applyAmountToCategory(state, 'working_capital', 300, 'set');
    engine.applyAmountToCategory(state, 'working_capital', 50, 'add');
    engine.applyAmountToCategory(state, 'revenue', 1000, 'set');
    engine.applyAmountToCategory(state, 'revenue', 100, 'add');

    expect(state.avgPrice).toBe(200);
    expect(state.monthlyRevenue).toBe(1100);
    expect(state.monthlyFixedExpenses).toBeGreaterThan(0);
    expect(state.monthlySalaries).toBe(450);
    expect(state.bfrManualAdjustment).toBe(350);
  });

  it('handles fixed amount ramps and one-time period impacts', () => {
    const engine = new FinancialSimulationEngine();
    const state = engine.initializeState(buildState());
    state.cashAdjustment = 0;
    const assumption = {
      category: 'revenue',
      start_date: '2026-01-01',
      end_date: '2026-03-01',
    };
    const date = new Date('2026-02-01');

    const target = engine.resolveFixedAmountTarget(state, assumption, 20000, date);
    expect(target).toBeGreaterThan(0);

    engine.applyFixedAmountToCategory(state, { ...assumption, category: 'expense_reduction' }, 1000, date);
    engine.applyOneTimePeriodImpact(state, 'working_capital', 500);
    engine.applyOneTimePeriodImpact(state, 'expense', 400);
    engine.applyOneTimePeriodImpact(state, 'social_charges', 50);
    engine.applyOneTimePeriodImpact(state, 'salaries', 250);
    engine.applyOneTimePeriodImpact(state, 'revenue', 700);
    engine.applyOneTimePeriodImpact(state, 'investment', 999);
    engine.applyOneTimePeriodImpact(state, 'equipment', 999);

    expect(state.cashAdjustment).toBeLessThan(0);
    expect(state.bfrManualAdjustment).toBeGreaterThan(0);
  });

  it('supports applicability checks and date helpers', () => {
    const engine = new FinancialSimulationEngine();
    expect(engine.isApplicable({}, new Date())).toBe(true);
    expect(engine.isApplicable({ start_date: '2026-01-01', end_date: '2026-12-31' }, new Date('2026-05-01'))).toBe(
      true
    );
    expect(engine.isApplicable({ start_date: '2027-01-01' }, new Date('2026-05-01'))).toBe(false);
    expect(engine.isApplicable({ end_date: '2025-12-31' }, new Date('2026-05-01'))).toBe(false);
    expect(engine.isSameMonth('2026-01-15', '2026-01-01')).toBe(true);
    expect(engine.isSameMonth('2026-01-15', '2026-02-01')).toBe(false);
    expect(engine.isSameMonth(null, '2026-02-01')).toBe(false);
  });

  it('calculates metrics and next state transitions', () => {
    const engine = new FinancialSimulationEngine();
    const state = engine.initializeState(buildState());
    state.customerPaymentDays = 50;
    state.supplierPaymentDays = 30;
    const metrics = engine.calculateMetrics(state, new Date('2026-01-01'));

    expect(metrics).toMatchObject({
      revenue: expect.any(Number),
      expenses: expect.any(Number),
      ebitda: expect.any(Number),
      cashBalance: expect.any(Number),
      currentRatio: expect.any(Number),
      roce: expect.any(Number),
    });

    const next = engine.updateStateForNextMonth(state, metrics, {
      customerPaymentDays: 55,
      supplierPaymentDays: 35,
    });
    expect(next.cash).toBe(metrics.cashBalance);
    expect(next.customerPaymentDays).toBe(55);
    expect(next.supplierPaymentDays).toBe(35);
  });

  it('compares scenarios and computes aggregate helpers', () => {
    const engine = new FinancialSimulationEngine();
    const a = [
      { date: '2026-01-01', revenue: 100, cashBalance: 10, netIncome: 5, operatingCashFlow: 7, netMargin: 5 },
      { date: '2026-02-01', revenue: 120, cashBalance: 20, netIncome: 8, operatingCashFlow: 9, netMargin: 6 },
    ];
    const b = [
      { date: '2026-01-01', revenue: 80, cashBalance: 12, netIncome: 4, operatingCashFlow: 5, netMargin: 4 },
      { date: '2026-02-01', revenue: 100, cashBalance: 15, netIncome: 6, operatingCashFlow: 6, netMargin: 5 },
    ];

    const comparison = engine.compareScenarios(a, b);
    expect(comparison.summary.finalRevenueDiff).toBe(20);
    expect(comparison.revenueDifference).toHaveLength(2);

    expect(engine.calculateAverageGrowth(a, 'revenue')).toBeGreaterThan(0);
    expect(engine.calculateAverageGrowth([{ revenue: 1 }], 'revenue')).toBe(0);
    expect(engine.sumMetric(a, 'operatingCashFlow')).toBe(16);
    expect(engine.calculateAverage(a, 'netMargin')).toBe(5.5);
    expect(engine.calculateAverage([], 'netMargin')).toBe(0);
  });

  it('runs sensitivity analysis with assumption mutations', async () => {
    const engine = new FinancialSimulationEngine();
    const scenario = { ...baseScenario, end_date: '2026-02-28' };
    const assumptions = [
      { category: 'revenue', assumption_type: 'growth_rate', parameters: { rate: 3 } },
      { category: 'pricing', assumption_type: 'percentage_change', parameters: { rate: 1 } },
    ];

    const output = await engine.sensitivityAnalysis(
      scenario,
      assumptions,
      buildState(),
      { category: 'revenue', type: 'growth_rate', field: 'rate' },
      [2, 5]
    );

    expect(output).toHaveLength(2);
    expect(output[0]).toMatchObject({
      parameterValue: 2,
      finalCash: expect.any(Number),
      finalRevenue: expect.any(Number),
      avgMargin: expect.any(Number),
    });
  });
});
